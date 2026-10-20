# SlothSort

**Drop the clutter. Let the sloth handle it.**

SlothSort is a privacy-first, local AI file organizer. It will scan an approved
folder, ask Gemma running in Ollama for categories and filenames, detect exact
duplicates with SHA-256, and show every proposed change for approval before
anything moves.

> **Status: foundation only.** The scanner, Ollama client, duplicate detection,
> review workflow, and safe file operations are not implemented yet. The current
> app is a shell plus shared types, validation schemas, and project tooling.

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

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

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
components/           Reusable UI components
components/ui/        shadcn/ui components
lib/ai/               Ollama client, prompts, response parsing
lib/files/            Scanning, metadata, hashing, path validation
lib/organizer/        Planning and safe execution of moves
lib/history/          Local operation history and undo
lib/validation/       Shared Zod schemas
lib/config/           Server environment configuration
types/                Shared TypeScript types
tests/                Vitest tests
```

## Next steps

1. Read-only folder scanner with metadata and safe path handling.
2. SHA-256 duplicate detection.
3. Ollama health check and schema-validated Gemma suggestions.
4. Review screen, approval, safe moves, and local undo history.
