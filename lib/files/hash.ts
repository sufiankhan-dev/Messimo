import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";

/**
 * Deterministic content hashing. The model never sees or chooses a hash; this
 * module is the only place a SHA-256 value is produced.
 */
export const DEFAULT_HASH_MAX_BYTES = 16 * 1024 * 1024;

export interface HashOptions {
  maxBytes?: number;
}

/**
 * Return the SHA-256 of a file's bytes, or null when the file is missing,
 * unreadable, or larger than the configured limit. Hashing is read-only.
 */
export async function hashFileSha256(
  filePath: string,
  { maxBytes = DEFAULT_HASH_MAX_BYTES }: HashOptions = {},
): Promise<string | null> {
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile() || stats.size > maxBytes) return null;

    const hash = createHash("sha256");
    for await (const chunk of createReadStream(filePath)) {
      hash.update(chunk as Buffer);
    }
    return hash.digest("hex");
  } catch {
    return null;
  }
}
