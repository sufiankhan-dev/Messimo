import { promises as fs } from "node:fs";
import type {
  ExtractionInfo,
  ScannedFile,
  TextExtractionStatus,
} from "@/types";

/**
 * Conservative document text extraction.
 *
 * Only a small, explicit set of formats is read. Every read is bounded by file
 * size, page count, output characters, and a wall-clock timeout. Extraction is
 * read-only, and a failure is reported instead of being treated as empty text.
 */
export const TEXT_EXTRACTION_LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxCharacters: 3_000,
  maxPdfPages: 6,
  timeoutMs: 8_000,
} as const;

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "json",
  "log",
  "yml",
  "yaml",
  "toml",
  "xml",
  "html",
  "htm",
]);

const TEXT_MIME_TYPES = new Set([
  "application/json",
  "application/xml",
  "application/yaml",
  "application/toml",
  "application/sql",
]);

export interface ExtractedDocument {
  info: ExtractionInfo;
  /** Only populated when text was actually extracted. */
  text: string | null;
}

function extractionInfo(
  status: TextExtractionStatus,
  message: string | null,
  characters = 0,
  truncated = false,
): ExtractionInfo {
  return { status, characters, truncated, message };
}

function normalizeText(raw: string): { text: string; truncated: boolean } {
  const cleaned = raw
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned.length <= TEXT_EXTRACTION_LIMITS.maxCharacters) {
    return { text: cleaned, truncated: false };
  }

  return {
    text: cleaned.slice(0, TEXT_EXTRACTION_LIMITS.maxCharacters).trimEnd(),
    truncated: true,
  };
}

function isTextLike(file: ScannedFile): boolean {
  const extension = file.extension.toLowerCase();
  return (
    TEXT_EXTENSIONS.has(extension) ||
    (file.mimeType?.startsWith("text/") ?? false) ||
    (file.mimeType ? TEXT_MIME_TYPES.has(file.mimeType) : false)
  );
}

async function withTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      task,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          onTimeout?.();
          reject(new Error("Text extraction timed out."));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Extract text for one file. Files that are not supported return a status
 * rather than throwing, so a batch can continue without losing the file.
 */
export async function extractDocumentText(
  absolutePath: string,
  file: ScannedFile,
): Promise<ExtractedDocument> {
  if (file.kind === "image") {
    return {
      info: extractionInfo(
        "not-needed",
        "Images are classified from metadata only. Messimo does not analyze image contents.",
      ),
      text: null,
    };
  }

  if (file.kind === "archive") {
    return {
      info: extractionInfo(
        "not-needed",
        "Archive contents are not opened. The suggestion uses the archive name and metadata only.",
      ),
      text: null,
    };
  }

  const extension = file.extension.toLowerCase();
  const supported =
    isTextLike(file) || extension === "pdf" || extension === "docx";

  if (!supported) {
    return {
      info: extractionInfo(
        "unsupported",
        `Text extraction is not supported for .${extension || "unknown"} files.`,
      ),
      text: null,
    };
  }

  if (file.sizeBytes > TEXT_EXTRACTION_LIMITS.maxFileBytes) {
    return {
      info: extractionInfo(
        "too-large",
        `The file is larger than ${Math.round(
          TEXT_EXTRACTION_LIMITS.maxFileBytes / (1024 * 1024),
        )} MB, so its contents were not read.`,
      ),
      text: null,
    };
  }

  let raw: string;
  try {
    if (extension === "pdf") {
      raw = await extractPdf(absolutePath);
    } else if (extension === "docx") {
      raw = await extractDocx(absolutePath);
    } else {
      raw = await fs.readFile(absolutePath, "utf8");
    }
  } catch (error) {
    const message =
      error instanceof Error && /timed out/i.test(error.message)
        ? "Reading this document took too long, so its contents were not used."
        : "The document's contents could not be read. The suggestion uses metadata only.";

    return {
      info: extractionInfo("failed", message),
      text: null,
    };
  }

  const normalized = normalizeText(raw);
  if (!normalized.text) {
    return {
      info: extractionInfo(
        "empty",
        "No readable text was found. The suggestion uses metadata only.",
      ),
      text: null,
    };
  }

  return {
    info: extractionInfo(
      "extracted",
      normalized.truncated
        ? `Text was truncated to the first ${TEXT_EXTRACTION_LIMITS.maxCharacters} characters.`
        : null,
      normalized.text.length,
      normalized.truncated,
    ),
    text: normalized.text,
  };
}

async function extractPdf(absolutePath: string): Promise<string> {
  const data = await fs.readFile(absolutePath);
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data, verbosity: 0 });

  try {
    const result = await withTimeout(
      parser.getText({
        first: TEXT_EXTRACTION_LIMITS.maxPdfPages,
        pageJoiner: "\n",
      }),
      TEXT_EXTRACTION_LIMITS.timeoutMs,
      () => {
        void parser.destroy().catch(() => undefined);
      },
    );

    return result.text;
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function extractDocx(absolutePath: string): Promise<string> {
  const buffer = await fs.readFile(absolutePath);
  const mammoth = await import("mammoth");
  const extract = mammoth.default ?? mammoth;

  const result = await withTimeout(
    extract.extractRawText({ buffer }),
    TEXT_EXTRACTION_LIMITS.timeoutMs,
  );

  return result.value;
}
