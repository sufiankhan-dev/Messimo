# SlothSort demo script

This walkthrough takes a synthetic messy folder through the complete workflow:

**Scan -> detect duplicates -> generate local Gemma suggestions -> review -> approve -> organize -> undo**

The model is a 4B local model. It may choose different categories, names, or
destinations on different runs. The demo is about the safety workflow, not a
fixed answer. Only approve suggestions that make sense to you.

## 1. Prepare the environment

```bash
npm ci
ollama --version
ollama list
```

`ollama list` must include `gemma3:4b`. If it does not:

```bash
ollama pull gemma3:4b
```

Start Ollama if it is not already running, then start SlothSort:

```bash
npm run dev
```

Open <http://127.0.0.1:3000>.

## 2. Create the synthetic demo folder

For a normal run:

```bash
node scripts/create-demo-folder.mjs
```

The script prints the absolute path. The default is
`demo/slothsort-demo/`.

For screenshots or a recording, use a neutral path that does not contain your
user name:

```powershell
node scripts/create-demo-folder.mjs C:\Users\Public\SlothSortDemo
```

```bash
# macOS
node scripts/create-demo-folder.mjs /Users/Shared/SlothSortDemo
# Linux
node scripts/create-demo-folder.mjs /tmp/slothsort-demo
```

The folder contains 13 synthetic files:

| What it demonstrates | Files |
| --- | --- |
| Exact duplicate pair | `invoice_acme_march.txt` and `invoice_acme_march (1).txt` |
| Exact duplicate pair across folders | `receipts/2024-12-coffee.txt` and `old/2024-12-coffee.txt` |
| Similar names, different contents | `IMG_2043.svg` and `IMG_2044.svg` |
| Text/document extraction | `.md`, `.csv`, `.docx`, `.pdf` |
| Metadata-only classification | two `.zip` archives and two `.svg` images |
| Unsupported type | `vendor-export.xyz` |

The script never deletes anything. It refuses a non-empty folder unless every
entry is one of its own generated names, and `--force` only overwrites those
generated files.

## 3. Verify local inference (optional, recommended for a recording)

1. Open **Settings**.
2. The **Ollama connection** card should show **Connected**, `gemma3:4b`, and the
   installed Ollama version.
3. Click **Run test prompt** in the **Local inference test** card.
4. Show the validated category, suggested filename, destination, reason,
   uncertainty, model, and duration.

This diagnostic uses a fixed synthetic sample. It does not read the demo folder.

## 4. Scan the demo folder

1. Open the dashboard or **Folder scan**.
2. Click **Choose folder**.
3. Navigate to the path printed by the script and approve it. The scan starts
   automatically; **Scan again** repeats it if needed.

Show the read-only results:

- 13 files, 8 documents, 2 images, 2 archives, and 1 unsupported file
- 2 exact duplicate groups
- 1 similar-name group
- 0 hashing failures
- the scan is not truncated

Open **Duplicates** and show the two sections:

- **Exact duplicate groups**: the invoice pair and the receipt pair, with
  matching SHA-256 values.
- **Similar names**: the two SVGs are listed separately because their contents
  are different. A similar name is not treated as a duplicate.

The duplicate screen is a preview. It does not delete or move anything.

## 5. Generate suggestions with local Gemma

1. Open **Review**.
2. Click **Generate suggestions** (or **Generate with local Gemma** on the
   empty state).
3. Wait for the progress card. The first model load can take longer than later
   requests.
4. When the plan arrives, show the summary and the per-file cards.

For each card, point out:

- original filename and relative path
- category
- suggested filename
- suggested destination
- the model's short reason
- uncertainty badge
- warnings for duplicates, collisions, missing text, or unsupported files

The `.xyz` file is skipped without a model call. Images and archives are
classified from metadata only; SlothSort does not inspect their contents. The
`.docx`, `.pdf`, `.md`, and `.csv` files can provide extracted text, bounded to
3,000 characters.

If a suggestion is wrong, reject it. A low-confidence or warning-bearing
suggestion is intentionally not eligible for batch approval. The model is a
helper, not an authority.

## 6. Review and approve

1. Use the filters **Needs review**, **Pending**, **Approved**, and **Rejected**
   to inspect the plan.
2. For a safe low-risk suggestion, use **Approve** on the card.
3. For several safe suggestions, select them and click **Approve selected**.
   Batch approval only includes low-uncertainty suggestions with no warnings.
4. Click **Apply approved changes**.
5. The confirmation dialog lists every source and destination. Nothing runs
   until you confirm.
6. Click **Apply approved (N)** and then **Apply N changes**.

Show the progress and the result. The result reports completed, failed, and
skipped operations separately. A failed operation leaves its source in place.

The apply step revalidates the approved root, every path, the destination, and
the file identity. It never overwrites an existing file and never uses
`fs.rename`, because that can replace a destination on some platforms. It moves
with an exclusive hard link, or an exclusive copy plus a hash check, and removes
the source only after the new file is verified.

## 7. Show history and undo

1. Open **History**.
2. Show the recorded batch, its per-file outcome, and the undo availability.
3. Click **Undo** (or use **Review and undo** on the apply result card).
4. Confirm the undo dialog.
5. Show that the file returned to its original name and location.

Undo is conservative. It refuses the whole batch if a moved file changed,
disappeared, or its original path is now occupied by newer data. It never
deletes newer data to make room. A refusal changes nothing and explains why.

## 8. Verify the folder after undo

The demo folder should again contain all 13 original files. Only the test move
was applied and reversed; no file content was lost, and the duplicate copies
remain.

To reset for a repeat demo, use a new path:

```bash
node scripts/create-demo-folder.mjs demo/demo-run-2
```

or remove the generated folder yourself after checking that it contains only
synthetic files.

## Optional failure demo

To show a safe failure state:

1. Stop Ollama.
2. Return to **Review** and click **Generate again**.
3. Show the visible **Local Ollama is offline** or **Unreachable** message.
4. Confirm that no files changed and that SlothSort does not fall back to a
   cloud provider.
5. Start Ollama again and retry.

## What not to do

- Do not use a real Downloads folder in a public recording.
- Do not show a path containing your personal user name.
- Do not claim a fixed model accuracy or speed. SlothSort does not benchmark the
  model.
- Do not apply duplicate files on top of each other; SlothSort will refuse a
  destination collision rather than overwrite.
- Do not promise that offline operation has been proven. The code is local-only
  by design, but an air-gapped verification has not been recorded in this
  repository.

See `docs/DEMO-CHECKLIST.md` for screenshots, recording shots, and privacy
checks.
