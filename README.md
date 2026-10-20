# SlothSort

**Drop the clutter. Let the sloth handle it.**

SlothSort is a privacy-first, local AI file organizer. It scans an approved
folder, detects exact duplicates with SHA-256, asks Gemma running in Ollama for
categories and filenames, and shows every proposed change for approval before
anything moves.

> **Status: scanner and local AI diagnostics shipped.** Folder selection,
> read-only scanning, SHA-256 duplicate detection, and a validated Ollama
> diagnostic are real. Gemma classification of scanned files, the review
> workflow, and safe file operations are not implemented yet. Review, duplicate,
> and history screens still use clearly labelled sample data.

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
- File **contents are not opened** during a scan. MIME types come from the file
  extension and are `null` when unknown.
- Scans never rename, move, or delete anything.

Progress streams back to the browser as newline-delimited JSON. **Cancel scan**
aborts both the HTTP request and the server-side walk.

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
- Folder scans read metadata only and do not open file contents.
- The model only suggests changes; the user approves them one by one or in a
  batch.
- Suggested filenames and destinations are validated with Zod. Absolute paths
  and `..` traversal are rejected.
- Existing files are never overwritten silently, and files are never deleted
  automatically.
- Destination paths must stay inside the user-approved folder.
- Applied operations will be recorded locally so supported actions can be undone.

## Project structure

```text
app/                  Pages and Route Handlers
app/api/folders/      Local browse, approval, and streaming scan endpoints
app/api/ollama/       Local health check and validated diagnostic endpoint
components/           Reusable UI components
components/ui/        shadcn/ui components
components/scan/      Client scan workspace state
components/ollama/    Client status and diagnostic UI
lib/ai/               Ollama client, prompts, response parsing
lib/files/            Scanner, MIME lookup, path validation, folder store
lib/organizer/        Planning and safe execution of moves
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

## Next steps

1. Gemma classification of real scanned metadata, one file at a time.
2. Review screen with real suggestions, approval, safe moves, and local undo
   history.
3. Accessibility, responsive, and offline verification pass.
