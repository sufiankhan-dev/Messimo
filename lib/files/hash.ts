import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import type { Stats } from "node:fs";

/**
 * Deterministic content hashing. The model never sees or chooses a hash; this
 * module is the only place a SHA-256 value is produced.
 */
export const DEFAULT_HASH_MAX_BYTES = 16 * 1024 * 1024;

export type HashFailureReason =
  | "missing"
  | "not_a_file"
  | "too_large"
  | "unreadable"
  | "changed"
  | "cancelled";

export interface HashIdentity {
  sizeBytes: number;
  /** ISO 8601 timestamp captured by the scanner. */
  modifiedAt: string;
}

export interface HashFileOptions {
  maxBytes?: number;
  signal?: AbortSignal;
  /**
   * Identity captured during the scan. When present, hashing is refused if the
   * file is no longer the same size or has a newer modification time.
   */
  expected?: HashIdentity;
}

export type HashFileResult =
  | {
      status: "hashed";
      sha256: string;
      sizeBytes: number;
      modifiedAt: string;
    }
  | {
      status: "failed";
      reason: HashFailureReason;
      message: string;
    };

function failed(
  reason: HashFailureReason,
  message: string,
): HashFileResult {
  return { status: "failed", reason, message };
}

function fsErrorCode(error: unknown): string {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : "";
}

/**
 * Hash one regular file, returning a structured result instead of throwing.
 * The file is inspected before and after reading so a file that changes while it
 * is being hashed is never reported as a trustworthy duplicate.
 */
export async function hashFile(
  filePath: string,
  {
    maxBytes = DEFAULT_HASH_MAX_BYTES,
    signal,
    expected,
  }: HashFileOptions = {},
): Promise<HashFileResult> {
  if (signal?.aborted) {
    return failed("cancelled", "Duplicate detection was cancelled.");
  }

  let before: Stats;
  try {
    before = await fs.stat(filePath);
  } catch (error) {
    const code = fsErrorCode(error);
    if (code === "ENOENT") {
      return failed("missing", "The file disappeared after the scan.");
    }
    return failed("unreadable", "The file could not be inspected.");
  }

  if (!before.isFile()) {
    return failed("not_a_file", "This entry is no longer a regular file.");
  }
  if (before.size > maxBytes) {
    return failed(
      "too_large",
      "The file is larger than the duplicate-detection size limit.",
    );
  }
  if (
    expected &&
    (before.size !== expected.sizeBytes ||
      before.mtime.toISOString() !== expected.modifiedAt)
  ) {
    return failed(
      "changed",
      "The file changed after the scan, so its contents were not compared.",
    );
  }

  const hash = createHash("sha256");

  try {
    for await (const chunk of createReadStream(filePath)) {
      if (signal?.aborted) {
        return failed("cancelled", "Duplicate detection was cancelled.");
      }
      hash.update(chunk as Buffer);
    }
  } catch {
    if (signal?.aborted) {
      return failed("cancelled", "Duplicate detection was cancelled.");
    }
    return failed("unreadable", "The file contents could not be read.");
  }

  let after: Stats;
  try {
    after = await fs.stat(filePath);
  } catch {
    return failed(
      "changed",
      "The file disappeared while its contents were being read.",
    );
  }

  if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
    return failed(
      "changed",
      "The file changed while its contents were being read.",
    );
  }

  return {
    status: "hashed",
    sha256: hash.digest("hex"),
    sizeBytes: before.size,
    modifiedAt: before.mtime.toISOString(),
  };
}

/**
 * Return the SHA-256 of a file's bytes, or null when the file is missing,
 * unreadable, changed, or larger than the configured limit. Hashing is
 * read-only. Prefer `hashFile` when the failure reason matters.
 */
export async function hashFileSha256(
  filePath: string,
  options: Omit<HashFileOptions, "expected"> = {},
): Promise<string | null> {
  const result = await hashFile(filePath, options);
  return result.status === "hashed" ? result.sha256 : null;
}
