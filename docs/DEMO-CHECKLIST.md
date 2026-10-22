# Demo screenshot and recording checklist

Use this with `docs/DEMO.md`. Capture only the synthetic demo folder.

## Before capturing

- [ ] Run `npm ci` and `npm run build` successfully.
- [ ] Start Ollama and confirm `ollama list` shows `gemma3:4b`.
- [ ] Start the app with `npm run dev` or `npm run start`.
- [ ] Use a neutral demo path with no personal user name:
  - Windows: `C:\Users\Public\SlothSortDemo`
  - macOS: `/Users/Shared/SlothSortDemo`
  - Linux: `/tmp/slothsort-demo`
- [ ] Create it with `node scripts/create-demo-folder.mjs <path>`.
- [ ] Confirm the folder contains only synthetic files.
- [ ] Use a clean browser profile or hide bookmarks and extensions.
- [ ] Close notifications, chat apps, and any window that shows personal files.
- [ ] Set the browser zoom to a readable level, preferably 100-125%.
- [ ] Choose light or dark theme deliberately; do not switch mid-recording.
- [ ] Check that the visible folder path contains no real user name or private
      folder.
- [ ] Confirm the screen resolution is at least 1280 x 720.

## Screenshot set

Save screenshots in `docs/screenshots/` (create it if needed) with these names:

| File | What to show |
| --- | --- |
| `01-dashboard-empty.png` | Dashboard before a folder is approved |
| `02-folder-picker.png` | Folder picker at the neutral demo path |
| `03-scan-results.png` | Scanned file table with metadata |
| `04-duplicate-groups.png` | Exact duplicate groups with SHA-256 values |
| `05-similar-names.png` | Similar-name group, clearly separate from duplicates |
| `06-ollama-connected.png` | Settings showing connected `gemma3:4b` |
| `07-diagnostic-result.png` | Validated local inference test result |
| `08-review-cards.png` | Review cards with category, destination, reason, uncertainty |
| `09-review-warnings.png` | A duplicate or warning-bearing suggestion |
| `10-approval-confirmation.png` | Confirmation dialog listing sources and destinations |
| `11-apply-result.png` | Completed batch result with counts |
| `12-history.png` | History record with per-file outcome and undo action |
| `13-undo-confirmation.png` | Undo confirmation dialog |
| `14-undo-result.png` | Restored file and updated history |
| `15-before-folder.png` | Demo folder in File Explorer/Finder before organizing |
| `16-after-folder.png` | Same view after organizing, before or after undo |

Screenshot rules:

- [ ] Crop out the browser chrome if it shows a personal profile name.
- [ ] Do not include the Windows user name, macOS home name, or a real path.
- [ ] Do not include real filenames, documents, email, or notifications.
- [ ] Keep the UI text legible; avoid extreme downscaling.
- [ ] Use PNG or WebP, not screenshots of a screenshot.

## Short recording (3-5 minutes)

Recommended shot list:

1. **0:00-0:20** - Title card or dashboard. Say what SlothSort does and that
   everything runs locally.
2. **0:20-0:40** - Show the synthetic folder in the file manager. Point out the
   duplicate invoices, receipts, similar images, and unknown file.
3. **0:40-1:10** - Open Settings. Show **Connected**, `gemma3:4b`, and run the
   test prompt. Do not claim a benchmark.
4. **1:10-1:40** - Choose the demo folder. Show the automatic scan and the
   read-only file table.
5. **1:40-2:10** - Open **Duplicates**. Show two exact groups and the separate
   similar-name group. Explain that the hash, not the name, proves a duplicate.
6. **2:10-2:50** - Open **Review** and click **Generate suggestions**. Show
   progress, then the cards. Point out category, filename, destination, reason,
   uncertainty, and warnings.
7. **2:50-3:20** - Approve one safe suggestion or a small safe batch. Open
   **Apply approved changes** and show the confirmation dialog. Confirm.
8. **3:20-3:40** - Show the result and the file in its new folder.
9. **3:40-4:10** - Open **History**, show the record, click **Undo** (or use
   **Review and undo** from the apply result), confirm, and show the restored
   file.
10. **4:10-4:30** - Closing shot: no cloud provider, no automatic deletion, no
    overwrite, human approval. Mention the limitations: 4B model, metadata-only
    for images and archives, no OCR, no benchmark claims.

Recording rules:

- [ ] Record at 1080p or 720p, 30 fps if possible.
- [ ] Keep the mouse movement deliberate; pause briefly on each important state.
- [ ] Use a neutral demo path from the list above.
- [ ] Do not show terminal output containing a personal home path.
- [ ] Do not show a real Downloads folder, even for a second.
- [ ] If the model gives a poor suggestion, keep it and reject it. That is a
      useful honest moment, not a failure.
- [ ] Do not speed up the model wait so much that the progress state disappears.
- [ ] Add captions for the workflow steps if the recording has no voiceover.
- [ ] Keep the final video under five minutes unless the challenge asks for more.

## After capturing

- [ ] Verify no personal paths, names, files, or notifications are visible.
- [ ] Confirm the screenshots match the current UI labels.
- [ ] Confirm the recording shows the undo/restore step, not only the move.
- [ ] Add the screenshots to the README or submission page.
- [ ] Keep the synthetic demo folder out of git; `demo/slothsort-demo/` is
      ignored.
- [ ] Re-run `npm test`, `npm run typecheck`, `npm run lint`, and
      `npm run build` after any UI copy changes.
