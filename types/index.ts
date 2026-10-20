import type {
  AiSuggestion,
  FileCategory,
  Uncertainty,
} from "@/lib/validation/organization";

export type { AiSuggestion, FileCategory, Uncertainty };

export type FileKind = "document" | "image" | "archive" | "other";

/** Metadata collected during a read-only folder scan. */
export interface ScannedFile {
  id: string;
  name: string;
  /** Path relative to the approved root. Absolute paths stay on the server. */
  relativePath: string;
  extension: string;
  sizeBytes: number;
  /** ISO 8601 timestamp. */
  modifiedAt: string;
  kind: FileKind;
  /** SHA-256 of the file contents, used for exact duplicate detection. */
  sha256?: string;
  warnings: string[];
}

export interface DuplicateGroup {
  sha256: string;
  fileIds: string[];
}

export interface SkippedFile {
  relativePath: string;
  reason: string;
}

export interface ScanResult {
  rootName: string;
  /** ISO 8601 timestamp. */
  scannedAt: string;
  files: ScannedFile[];
  duplicateGroups: DuplicateGroup[];
  skipped: SkippedFile[];
}
