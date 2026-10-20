# SlothSort

**Drop the clutter. Let the sloth handle it.**

SlothSort is a privacy-first, local AI file organizer. It scans an approved
folder, detects exact duplicates with SHA-256, asks Gemma running in Ollama for
categories and filenames, and shows every proposed change for approval before
anything moves.

> **Status: local scanner shipped.** Folder selection and read-only scanning are
> real. Ollama classification, duplicate hashing, the review workflow, and safe
> file operations are not implemented yet. Review, duplicate, and history screens
> still use clearly labelled sample data.

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
- [Ollama](https://ollama.com) running locally (for the next milestone)

The model used by this project is **Gemma 3 4B**, quantized to Q4_K_M
(about 3.4 GB on disk). Pull it once with internet access:

```bash
ollama pull gemma3:4b
ollama list
```

After the model is installed, inference runs entirely on this machine. The app
does not fall back to a cloud AI provider.

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
components/           Reusable UI components
components/ui/        shadcn/ui components
components/scan/      Client scan workspace state
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

## Next steps

1. SHA-256 duplicate detection on top of the scanner results.
2. Ollama health check and schema-validated Gemma suggestions.
3. Review screen with real suggestions, approval, safe moves, and local undo
   history.
4. Accessibility, responsive, and offline verification pass.
