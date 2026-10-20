#!/usr/bin/env node

/**
 * Create a small, fully synthetic "messy Downloads" folder for the SlothSort
 * demo. It uses only Node built-ins and never deletes anything.
 *
 * Usage:
 *   node scripts/create-demo-folder.mjs
 *   node scripts/create-demo-folder.mjs path/to/another-demo --force
 *
 * The default target is demo/slothsort-demo and is ignored by git.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const args = process.argv.slice(2);
const force = args.includes("--force");
const targetArg = args.find((arg) => !arg.startsWith("--"));
const target = path.resolve(
  targetArg ?? path.join(repoRoot, "demo", "slothsort-demo"),
);

const GENERATED_FILES = new Set([
  "invoice_acme_march.txt",
  "invoice_acme_march (1).txt",
  "meeting-notes-2026-04-18.md",
  "q2-budget.csv",
  "resume_latest.docx",
  "tax-return-2025.pdf",
  "IMG_2043.svg",
  "IMG_2044.svg",
  "project-alpha-v2.zip",
  "archive-2025.zip",
  "vendor-export.xyz",
  "receipts/2024-12-coffee.txt",
  "old/2024-12-coffee.txt",
]);

const GENERATED_DIRS = new Set(["receipts", "old"]);

function fail(message) {
  console.error(`\nCannot create the demo folder: ${message}\n`);
  process.exit(1);
}

function assertSafeTarget() {
  const filesystemRoot = path.parse(target).root;
  if (target === filesystemRoot) {
    fail("the filesystem root is not a demo folder.");
  }
  if (target === repoRoot || target === path.dirname(repoRoot)) {
    fail("choose a folder below the repository, not the repository itself.");
  }
  if (target === os.homedir()) {
    fail("the home folder is too broad. Use a dedicated demo folder.");
  }
}

async function findUnexpectedEntries() {
  const unexpected = [];

  async function walk(directory, prefix) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isSymbolicLink()) {
        unexpected.push(relativePath);
        continue;
      }

      if (entry.isDirectory()) {
        if (!GENERATED_DIRS.has(relativePath)) {
          unexpected.push(relativePath);
          continue;
        }
        await walk(path.join(directory, entry.name), relativePath);
        continue;
      }

      if (!entry.isFile() || !GENERATED_FILES.has(relativePath)) {
        unexpected.push(relativePath);
      }
    }
  }

  await walk(target, "");
  return unexpected;
}

async function checkExistingContents() {
  let stats;
  try {
    stats = await fs.lstat(target);
  } catch (error) {
    if (error && error.code === "ENOENT") return;
    throw error;
  }

  if (stats.isSymbolicLink()) {
    fail("the target is a symbolic link. Choose a real folder instead.");
  }
  if (!stats.isDirectory()) {
    fail("the target exists but is not a folder.");
  }

  const entries = await fs.readdir(target);
  if (entries.length === 0) return;

  const unexpected = await findUnexpectedEntries();
  if (unexpected.length > 0) {
    fail(
      `the target already contains entries this script did not create (${unexpected
        .slice(0, 5)
        .join(", ")}). Choose an empty folder or a new --target path.`,
    );
  }
  if (!force) {
    fail(
      "the target already contains a demo. Re-run with --force to overwrite the generated files, or choose a new path.",
    );
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function zip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.isBuffer(entry.data)
      ? entry.data
      : Buffer.from(entry.data, "utf8");
    const checksum = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function escapePdfText(value) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createPdf(lines) {
  const content = lines
    .map(
      (line, index) =>
        `BT /F1 12 Tf 72 ${720 - index * 20} Td (${escapePdfText(line)}) Tj ET`,
    )
    .join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

function createDocx(paragraphs) {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const relationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const body = paragraphs
    .map(
      (paragraph) =>
        `<w:p><w:r><w:t xml:space="preserve">${paragraph
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</w:t></w:r></w:p>`,
    )
    .join("");
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;

  return zip([
    { name: "[Content_Types].xml", data: contentTypes },
    { name: "_rels/.rels", data: relationships },
    { name: "word/document.xml", data: document },
  ]);
}

const invoice = `SYNTHETIC DEMO FILE - this is not a real invoice.

Acme Studio
Invoice 2026-03
Bill to: Sample User
Design retainer: 1,200.00
Hosting: 45.00
Total due: 1,245.00
Payment due: 2026-04-15
`;

const meetingNotes = `# Meeting notes - 18 April 2026

Synthetic sample for the SlothSort demo.

- Review the spring launch checklist.
- Ask the design team for the final banner.
- Move the budget review to Friday.
`;

const budgetCsv = `category,planned,actual
software,1200,1140
travel,800,615
hardware,2400,2299
`;

const resumeDocx = createDocx([
  "SAMPLE USER - SYNTHETIC RESUME",
  "This document exists only to demonstrate local DOCX text extraction.",
  "Experience: sample project coordination and community support.",
  "Skills: planning, writing, and careful file organization.",
]);

const taxPdf = createPdf([
  "SYNTHETIC SAMPLE - NOT A REAL TAX DOCUMENT",
  "2025 tax return summary",
  "Prepared for: Sample User",
  "Income: 42,000",
  "Deductions: 6,500",
  "This file is generated for the SlothSort demo.",
]);

const projectZip = zip([
  {
    name: "project-alpha/README.txt",
    data: "Synthetic project archive for the SlothSort demo.\n",
  },
  {
    name: "project-alpha/notes.md",
    data: "# Project Alpha\n\nOne fake milestone, one fake checklist.\n",
  },
]);

const archiveZip = zip([
  {
    name: "archive-2025/summary.txt",
    data: "Synthetic archive from 2025. No real data is inside.\n",
  },
]);

const receipt = `SYNTHETIC DEMO RECEIPT

Corner Cafe
2024-12-03
Coffee and a sandwich
Total: 14.50
Thank you!
`;

function svgImage(label, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
  <rect width="640" height="480" fill="${color}"/>
  <circle cx="320" cy="220" r="110" fill="#ffffff" fill-opacity="0.85"/>
  <text x="320" y="235" font-family="sans-serif" font-size="42" text-anchor="middle" fill="#1f2937">${label}</text>
  <text x="320" y="410" font-family="sans-serif" font-size="22" text-anchor="middle" fill="#1f2937">Synthetic image for the SlothSort demo</text>
</svg>
`;
}

const files = new Map([
  ["invoice_acme_march.txt", invoice],
  ["invoice_acme_march (1).txt", invoice],
  ["meeting-notes-2026-04-18.md", meetingNotes],
  ["q2-budget.csv", budgetCsv],
  ["resume_latest.docx", resumeDocx],
  ["tax-return-2025.pdf", taxPdf],
  ["IMG_2043.svg", svgImage("IMG 2043", "#dbeafe")],
  ["IMG_2044.svg", svgImage("IMG 2044", "#fef3c7")],
  ["project-alpha-v2.zip", projectZip],
  ["archive-2025.zip", archiveZip],
  ["receipts/2024-12-coffee.txt", receipt],
  ["old/2024-12-coffee.txt", receipt],
  [
    "vendor-export.xyz",
    "An unknown extension so the scanner can report an unsupported file.\n",
  ],
]);

async function main() {
  assertSafeTarget();
  await checkExistingContents();

  for (const [relativePath, contents] of files) {
    const destination = path.join(target, relativePath);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, contents);
  }

  console.log(`\nCreated ${files.size} synthetic files in:\n  ${target}\n`);
  console.log("What the demo folder contains:");
  console.log("  - two exact duplicate invoices");
  console.log("  - two exact duplicate receipts in different folders");
  console.log("  - two similar-name SVG images with different contents");
  console.log("  - a valid DOCX, PDF, CSV, Markdown file, and two ZIP archives");
  console.log("  - one unknown .xyz file that SlothSort reports as unsupported");
  console.log("\nNext steps:");
  console.log("  1. npm run dev");
  console.log("  2. Open http://127.0.0.1:3000");
  console.log("  3. Choose the folder above in the folder picker");
  console.log("  4. Follow docs/DEMO.md for the full walkthrough\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
