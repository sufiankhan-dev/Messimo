import type { Stats } from "node:fs";
import type { ScannedFile } from "@/types";
import { detectMimeType, isUnsupportedKind, kindForFile } from "./mime";

/**
 * Build the deterministic metadata record for one file. Shared by the folder
 * scanner and the organization planner so both describe a file the same way.
 * This only uses `lstat` data and the file extension; it never opens contents.
 */
export function describeFile(
  name: string,
  relativePath: string,
  stats: Stats,
): ScannedFile {
  const extension = extensionOf(name);
  const mimeType = detectMimeType(extension);
  const kind = kindForFile(extension, mimeType);
  const warnings: string[] = [];

  if (!mimeType) {
    warnings.push(
      "MIME type could not be determined from the file extension.",
    );
  }
  if (isUnsupportedKind(kind)) {
    warnings.push("This file type is not supported for organization yet.");
  }
  if (stats.size === 0) {
    warnings.push("This file is empty.");
  }

  return {
    id: relativePath,
    name,
    relativePath,
    extension,
    sizeBytes: stats.size,
    modifiedAt: stats.mtime.toISOString(),
    kind,
    mimeType,
    warnings,
  };
}

/** Extension without the leading dot, preserving the original case. */
export function extensionOf(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === name.length - 1) return "";
  return name.slice(dotIndex + 1);
}
