# SlothSort

**Drop the clutter. Let the sloth handle it.**

SlothSort is a privacy-first, local AI file organizer. It scans an approved
folder, detects exact duplicates with SHA-256, asks Gemma running in Ollama for
categories and filenames, and shows every proposed change for approval before
anything moves.

> **Status: scan, duplicate review, and organization preview shipped.** Folder
> selection, read-only scanning, deterministic SHA-256 duplicate detection with
> a live duplicate review screen, Ollama diagnostics, and local Gemma
> organization suggestions are real. Approved moves, renames, and undo are not
> implemented yet, so the review screen only records preview decisions. The
> history screen still uses clearly labelled sample data.

## Stack

- Next.js 16.4.2 (App Router, Turbopack, React 19)
- TypeScript 5 in strict mode
- Tailwind CSS 4 with shadcn/ui
- Zod 4 for runtime validation
- Ollama with `gemma3:4b` for local inference
- Vitest for tests

## Requirements

- Node.js 22.12 or newer (developed with Node.js 24.21.0)
- npm 11
- [Ollama](https://ollama.com) running locally

The model used by this project is **Gemma 3 4B**, quantized to Q4_K_M
(about 3.4 GB on disk). Pull it once with internet access:

```bash
ollama pull gemma3:4b
ollama list
```

After the model is installed, inference runs entirely on this machine. The app
does not fall back to a cloud AI provider.

The Ollama API integration in this repository was verified against **Ollama
0.40.4** on Windows. It uses `POST /api/chat` with `stream: false` and a JSON
Schema in `format`; the reply is read from `message.content` as a JSON string.
Older Ollama builds that do not support structured output will fail safely with
a visible error instead of producing an unvalidated suggestion.

## Getting started

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:3000>. The dev and start scripts bind to `127.0.0.1` on
purpose: folder APIs are available only to the local app.

Configuration is optional because the defaults point at local Ollama. To change
them, copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

| Variable           | Default                   | Purpose                    |
| ------------------ | ------------------------- | -------------------------- |
| `OLLAMA_BASE_URL`  | `http://127.0.0.1:11434`  | Local Ollama API endpoint  |
| `OLLAMA_MODEL`     | `gemma3:4b`               | Installed instruction model |

Never commit `.env.local` or any other environment file. Only
`.env.example` is tracked.

## Folder scanning and access

1. Open the dashboard or the **Folder scan** page and choose a folder. The app
   uses a local folder browser served by the app itself, not a browser file input
   pretending to grant filesystem access.
2. The server canonicalizes the folder with `realpath`, checks that it is a
   readable directory, and stores an opaque approval id in process memory. Scan
   requests reference that id, never an arbitrary client-supplied path.
3. The scanner walks the approved folder and its subfolders, reading directory
   entries and `lstat` metadata only.

Safety limits and rules:

- Drive roots, UNC/device paths, system folders, the whole home folder, and its
  immediate parent are refused.
- Requests must arrive on a loopback host with a same-origin JSON `POST`. The
  folder endpoints reject LAN and cross-site browser requests.
- Symbolic links and junctions are skipped, so a scan cannot escape the approved
  root.
- Unreadable files and folders are skipped and reported instead of aborting the
  scan.
- A scan stops at 10,000 files, 2,000 folders, or 12 levels of depth and reports
  why it stopped.
- File contents are read only after the metadata walk, and only for files that
  share a size with another file. That read is used solely to compute SHA-256
  duplicate hashes; MIME types still come from the file extension and are `null`
  when unknown.
- Scans never rename, move, or delete anything.

Progress streams back to the browser as newline-delimited JSON. **Cancel scan**
aborts both the HTTP request and the server-side walk.

## Duplicate detection

Duplicate detection is deterministic, local, and independent of Gemma. It runs
after the metadata walk and streams its own progress phase to the same scan
stream:

1. Files are bucketed by size. A file with a unique size cannot be an exact
   duplicate, so it is never read.
2. Only size-shared candidates are hashed with SHA-256, up to 16 MB per file,
   four at a time. Size is an optimization, never proof: equal sizes alone never
   produce a group.
3. Each candidate is revalidated immediately before it is read. Symbolic links,
   paths that resolve outside the approved folder, missing files, and files whose
   size or modification time changed after the scan are reported as hashing
   failures instead of being compared.
4. A file is re-checked after hashing. If it changed while being read, its digest
   is discarded.
5. Exact groups require both a matching SHA-256 and a matching size. Files with
   the same name but different contents are listed separately as **similar
   names**, never as duplicates.

The duplicate review screen uses the real scan result. It shows each group's
relative paths, size per file, modification dates, and hash, plus a separate
similar-name section. Nothing on that screen deletes, moves, or overwrites a
file, and choosing a copy to keep is only a preview.

## Local inference and diagnostics

All inference code is server-side in `lib/ai/`. Browser components only call the
app's own Route Handlers; no React component imports or calls Ollama directly.

- `GET /api/ollama/status` reads `/api/tags` and `/api/version` from the local
  runtime. It reports `connected`, `model-missing`, or `unreachable`, plus the
  installed model list and the Ollama version.
- `POST /api/ollama/diagnostic` sends one fixed, synthetic classification prompt
  to the selected model. The browser cannot choose the prompt or endpoint.

Safety properties of the diagnostic:

- It uses `POST /api/chat` with `stream: false` and a JSON Schema derived from the
  same Zod schema used to validate the reply. There is no hand-written schema to
  drift out of sync.
- The reply must parse as JSON, match `aiSuggestionSchema`, keep a safe single
  filename, and use a relative destination. Anything else is rejected and shown
  as an error; it is never partially applied.
- If the model omits the original `.pdf` extension, SlothSort restores it
  deterministically and says so in the result. A different extension is rejected.
- Requests time out after 60 seconds. Status checks time out after 2.5 seconds.
- The endpoint must be loopback (`localhost`, `127.0.0.1`, or `::1`). A remote
  `OLLAMA_BASE_URL` is refused before any prompt is sent.
- The diagnostic Route Handler accepts only a same-origin request from the local
  app and does not read a request body.
- Prompt text, model replies, filenames, and paths are never logged.

### Verify local inference manually

1. Confirm the runtime and model:

   ```bash
   ollama --version        # verified here with 0.40.4
   ollama list             # gemma3:4b should be listed
   curl http://127.0.0.1:11434/api/version
   ```

2. Start the app and open <http://127.0.0.1:3000/settings>.

3. The **Ollama connection** card should show **Connected**, the model name, and
   the Ollama version. If not, start Ollama and use **Check again**.

4. Click **Run test prompt** in the **Local inference test** card. The first run
   can take several seconds while the model loads. A successful result shows the
   category, suggested filename, destination, reason, uncertainty, model, and
   duration.

5. Confirm the result is reported as validated. The fields come from local
   inference; nothing was moved, renamed, or deleted.

To see the failure states without breaking anything:

- Quit Ollama and refresh the status card: it shows **Unreachable**.
- Set `OLLAMA_MODEL=gemma3:12b` in `.env.local` and restart: it shows **Model
  missing** with the pull command.
- Point `OLLAMA_BASE_URL` at a non-loopback host: the diagnostic refuses the
  endpoint before sending a prompt.

## Organization suggestions (preview only)

After a scan, open the **Review** page and click **Generate suggestions**.
SlothSort asks the local model for one suggestion per supported file and returns
a read-only preview plan. This step never moves, renames, or deletes anything.

The plan is served by `POST /api/organize` as newline-delimited JSON with
`progress`, `complete`, `cancelled`, and `error` events. Cancelling aborts both
the request and in-flight inference.

- Up to 24 supported files per run, two requests in flight, two attempts per
  file, and a 90-second timeout per request.
- The server rebuilds each file's metadata from disk instead of trusting the
  browser. Requested paths must stay inside the approved folder; symlinks and
  files that disappeared after the scan are skipped.
- Only supported types are sent. Executables, unknown binaries, and other
  unsupported files are skipped without a model call.
- The model receives the filename, extension, size, modified date, detected
  kind, MIME type, extraction status, and at most 3,000 characters of extracted
  text. Images and archives are classified from metadata only.
- The fixed system prompt in `lib/organizer/prompt.ts` marks file data as
  untrusted, and the model has no tools, filesystem access, or command ability.

### Text extraction limits

- Plain text formats (`.txt`, `.md`, `.csv`, `.json`, `.log`, `.yml`, `.yaml`,
  `.toml`, `.xml`, `.html`) are read as UTF-8 up to 3,000 characters.
- PDFs are limited to the first 6 pages and 3,000 characters.
- DOCX body text is read with Mammoth.

Extraction is refused for files larger than 10 MB, stops after 8 seconds, and
reports `extracted`, `empty`, `not-needed`, `unsupported`, `too-large`, or
`failed`. A failed extraction is reported to the user, not treated as empty
content.

### Validation and safety

- The approved categories and destination folders are a fixed allowlist in
  `lib/organizer/rules.ts`. The model must copy one of those destinations;
  matching is case-insensitive and stored in canonical spelling. Anything else
  is rejected.
- Replies must match the strict Zod schema in
  `lib/validation/organization.ts`: exactly five fields, a valid category, a
  single safe filename, a relative destination, and low/medium/high uncertainty.
  Extra fields, absolute paths, drive letters, and `..` are rejected.
- Filenames are sanitized deterministically. The original extension is
  preserved, and a changed or missing extension is rejected.
- SHA-256 hashes, extension handling, destination conflict checks, and duplicate
  grouping are plain code. The model never decides those.
- Each entry ends as `ready` (low uncertainty and no warnings), `needs-review`
  (medium/high uncertainty, missing text, duplicates, or conflicts), `skipped`,
  or `failed`. Only `ready` entries are eligible for bulk approval.
- Exact duplicates are reported from content hashes, not filenames.

## Scripts

| Command             | Purpose                              |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Start the development server         |
| `npm run build`     | Production build                     |
| `npm run start`     | Run the production build             |
| `npm run lint`      | ESLint                               |
| `npm run typecheck` | TypeScript strict type check         |
| `npm test`          | Run the Vitest suite once            |
| `npm run test:watch`| Run tests in watch mode              |

## Safety and privacy rules

- File contents, names, and paths never leave this machine.
- Folder scans read metadata only, then read size-matched candidates to compute
  SHA-256 duplicate hashes. Document text is opened only during an explicit
  suggestion run, and only for supported formats.
- Duplicate detection uses file hashes computed by code, never model output, and
  is kept independent of AI classification.
- Extracted text and filenames are treated as untrusted data. Instructions found
  inside a document are never executed or allowed to override application rules.
- The model cannot choose absolute paths, run commands, or touch the filesystem.
  Destinations must come from the approved allowlist and stay inside the
  user-approved folder.
- The model only suggests changes; the user approves them one by one or in a
  batch. Approval in this version records a preview decision only.
- Suggested filenames and destinations are validated with Zod. Absolute paths
  and `..` traversal are rejected.
- Existing files are never overwritten silently, and files are never deleted
  automatically.
- Prompts, model replies, filenames, and full paths are never logged.
- Applied operations will be recorded locally so supported actions can be undone.

## Project structure

```text
app/                  Pages and Route Handlers
app/api/folders/      Local browse, approval, and streaming scan endpoints
app/api/organize/     Streaming, read-only organization preview endpoint
app/api/ollama/       Local health check and validated diagnostic endpoint
components/           Reusable UI components
components/ui/        shadcn/ui components
components/scan/      Client scan and plan workspace state
components/review/    Review workspace and per-file suggestion cards
components/ollama/    Client status and diagnostic UI
lib/ai/               Ollama client, prompts, response parsing
lib/files/            Scanner, metadata, hashing, extraction, path safety
lib/organizer/        Suggestion rules, prompt, sanitization, conflicts, planner
lib/workspace/        Review state, plan mapping, summaries
lib/history/          Local operation history and undo
lib/validation/       Shared Zod schemas
lib/config/           Server environment configuration
lib/server/           Local-request protection and API responses
types/                Shared TypeScript types
tests/                Vitest tests
```

## Tests

```bash
npm test
```

The Ollama suite covers model-name matching, connected/model-missing/unreachable
states, runtime version reporting, a successful structured completion, malformed
JSON, schema violations, extension preservation, unreachable Ollama, model
missing, unexpected response envelopes, and timeouts. The non-loopback endpoint
test confirms the client never prompts a remote host.

The organization suite covers the allowlist and destination canonicalization,
filename sanitization and path traversal, malformed and misleading model
replies, retries and failures, duplicate detection by hash, destination
conflicts, cancellation, bounded text extraction, and the plan-to-review
mapping. The duplicate suite exercises identical files, same-size files with
different contents, same-name files with different contents, numbered variants,
files that disappear after a scan, unreadable files, and files modified between
scan and hashing. A real-model integration test is opt-in and skipped by
default:

```bash
SLOTHSORT_OLLAMA_INTEGRATION=1 npx vitest run tests/integration-ollama-planner.test.ts
```

On PowerShell, set `$env:SLOTHSORT_OLLAMA_INTEGRATION = "1"` first. The test
requires Ollama with `gemma3:4b` installed and takes about a minute.

## Next steps

1. Approve and execute safe moves and renames, with collision handling and
   partial-failure reporting.
2. Local operation history and undo.
3. Accessibility, responsive, and offline verification pass.
