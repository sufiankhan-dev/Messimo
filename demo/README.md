# Demo folder

`scripts/create-demo-folder.mjs` creates a synthetic, safe-to-organize folder at
`demo/messimo-demo/` by default. The generated folder is ignored by git.

```bash
node scripts/create-demo-folder.mjs
```

The folder contains only made-up text and synthetic documents:

- two exact duplicate invoices
- two exact duplicate receipts in different subfolders
- two similar-name SVG images with different contents
- a valid DOCX, PDF, CSV, Markdown file, and two ZIP archives
- one unknown `.xyz` file that Messimo reports as unsupported

For a recording or screenshots, create the demo outside your home folder so a
personal path is not visible, for example:

```powershell
node scripts/create-demo-folder.mjs C:\Users\Public\MessimoDemo
```

```bash
# macOS (a /tmp path resolves under the protected /private folder)
node scripts/create-demo-folder.mjs /Users/Shared/MessimoDemo
# Linux
node scripts/create-demo-folder.mjs /tmp/messimo-demo
```

Never point the demo at a real Downloads folder or any folder containing
personal files. See `docs/DEMO.md` for the walkthrough and
`docs/DEMO-CHECKLIST.md` for the capture checklist.
