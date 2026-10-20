import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  extractDocumentText,
  TEXT_EXTRACTION_LIMITS,
} from "@/lib/files/text-extraction";
import { describeFile } from "@/lib/files/metadata";
import type { ScannedFile } from "@/types";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "slothsort-extract-"));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

async function scannedFile(relativePath: string): Promise<ScannedFile> {
  const absolute = path.join(root, relativePath);
  const stats = await fs.stat(absolute);
  return describeFile(path.basename(relativePath), relativePath, stats);
}

describe("text extraction", () => {
  it("extracts plain text", async () => {
    const filePath = path.join(root, "notes.txt");
    await fs.writeFile(filePath, "Quarterly invoice notes for March.");

    const result = await extractDocumentText(filePath, await scannedFile("notes.txt"));

    expect(result.info.status).toBe("extracted");
    expect(result.text).toContain("Quarterly invoice");
  });

  it("truncates long text to the character limit", async () => {
    const filePath = path.join(root, "long.txt");
    await fs.writeFile(filePath, "x".repeat(TEXT_EXTRACTION_LIMITS.maxCharacters + 50));

    const result = await extractDocumentText(filePath, await scannedFile("long.txt"));

    expect(result.info.status).toBe("extracted");
    expect(result.info.truncated).toBe(true);
    expect(result.info.characters).toBe(TEXT_EXTRACTION_LIMITS.maxCharacters);
    expect(result.text).toHaveLength(TEXT_EXTRACTION_LIMITS.maxCharacters);
  });

  it("does not read a file above the size limit", async () => {
    const filePath = path.join(root, "large.txt");
    await fs.writeFile(filePath, "small");
    const file = await scannedFile("large.txt");

    const result = await extractDocumentText(filePath, {
      ...file,
      sizeBytes: TEXT_EXTRACTION_LIMITS.maxFileBytes + 1,
    });

    expect(result.info.status).toBe("too-large");
    expect(result.text).toBeNull();
  });

  it("marks images and archives as metadata-only", async () => {
    const imagePath = path.join(root, "photo.jpg");
    await fs.writeFile(imagePath, "not really a jpeg");
    const image = await scannedFile("photo.jpg");

    const result = await extractDocumentText(imagePath, image);

    expect(result.info.status).toBe("not-needed");
    expect(result.text).toBeNull();
  });

  it("reports unsupported document formats without failing the batch", async () => {
    const filePath = path.join(root, "old.doc");
    await fs.writeFile(filePath, "legacy document");
    const file = await scannedFile("old.doc");

    const result = await extractDocumentText(filePath, file);

    expect(result.info.status).toBe("unsupported");
    expect(result.info.message).toContain(".doc");
  });

  it("extracts text from a simple PDF", async () => {
    const filePath = path.join(root, "invoice.pdf");
    await fs.writeFile(filePath, buildPdf("Invoice March 2026 total 42 dollars"));

    const result = await extractDocumentText(filePath, await scannedFile("invoice.pdf"));

    expect(result.info.status).toBe("extracted");
    expect(result.text).toContain("Invoice March 2026");
  });

  it("reports a malformed PDF as a failed extraction", async () => {
    const filePath = path.join(root, "broken.pdf");
    await fs.writeFile(filePath, "this is not a pdf");

    const result = await extractDocumentText(filePath, await scannedFile("broken.pdf"));

    expect(result.info.status).toBe("failed");
    expect(result.text).toBeNull();
  });

  it("extracts text from a DOCX file", async () => {
    const filePath = path.join(root, "budget.docx");
    await fs.writeFile(filePath, buildDocx("Quarterly budget review"));

    const result = await extractDocumentText(filePath, await scannedFile("budget.docx"));

    expect(result.info.status).toBe("extracted");
    expect(result.text).toContain("Quarterly budget review");
  });

  it("reports a malformed DOCX as a failed extraction", async () => {
    const filePath = path.join(root, "broken.docx");
    await fs.writeFile(filePath, "not a zip");

    const result = await extractDocumentText(filePath, await scannedFile("broken.docx"));

    expect(result.info.status).toBe("failed");
  });
});

/** Minimal valid PDF with one page and one text run. */
function buildPdf(text: string): Buffer {
  const content = `BT /F1 18 Tf 50 200 Td (${text.replace(/[()\\]/g, "\\$&")}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 400] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "utf8");
}

/** Minimal uncompressed DOCX package for mammoth to read. */
function buildDocx(text: string): Buffer {
  return buildZip([
    {
      name: "[Content_Types].xml",
      data: Buffer.from(
        [
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
          '<Default Extension="xml" ContentType="application/xml"/>',
          '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
          "</Types>",
        ].join(""),
      ),
    },
    {
      name: "_rels/.rels",
      data: Buffer.from(
        [
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>',
          "</Relationships>",
        ].join(""),
      ),
    },
    {
      name: "word/document.xml",
      data: Buffer.from(
        [
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
          '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
          `<w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body>`,
          "</w:document>",
        ].join(""),
      ),
    },
  ]);
}

interface ZipEntry {
  name: string;
  data: Buffer;
}

function buildZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);
    const local = Buffer.alloc(30);

    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    localParts.push(local, name, entry.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);

    centralParts.push(central, name);
    offset += local.length + name.length + entry.data.length;
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

function crc32(data: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}
