import type {
  DuplicateGroup,
  HashingFailure,
  ScannedFile,
  SimilarNameGroup,
} from "@/types";
import { promises as fs } from "node:fs";
import { DEFAULT_HASH_MAX_BYTES, hashFile } from "./hash";
import type { HashFileOptions, HashFileResult } from "./hash";
import {
  isStrictlyInsidePath,
  resolveInsideRoot,
} from "./path-safety";

export interface DuplicateProgress {
  hashedFiles: number;
  filesToHash: number;
  /** Path relative to the approved root. Never absolute. */
  currentRelativePath: string;
}

export interface DuplicateDetectionResult {
  groups: DuplicateGroup[];
  similarNameGroups: SimilarNameGroup[];
  /** SHA-256 values keyed by scanned file id. */
  hashes: Record<string, string>;
  hashingFailures: HashingFailure[];
  hashedFiles: number;
  filesToHash: number;
}

export type FileHasher = (
  filePath: string,
  options: HashFileOptions,
) => Promise<HashFileResult>;

export interface DetectDuplicatesOptions {
  /** Canonical root previously approved through the local folder API. */
  rootPath: string;
  files: ScannedFile[];
  signal?: AbortSignal;
  concurrency?: number;
  maxBytes?: number;
  onProgress?: (progress: DuplicateProgress) => void | Promise<void>;
  /** Testing hook. Production callers should leave this undefined. */
  hasher?: FileHasher;
}

export class DuplicateDetectionCancelledError extends Error {
  constructor() {
    super("Duplicate detection was cancelled.");
    this.name = "DuplicateDetectionCancelledError";
  }
}

const DEFAULT_CONCURRENCY = 4;
const MAX_CONCURRENCY = 8;
/** Bound fuzzy name work so a folder of numbered files cannot stall a scan. */
const MAX_SIMILAR_NAME_BUCKET = 200;

function comparePaths(first: string, second: string): number {
  return first.localeCompare(second, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

function uniqueFiles(files: ScannedFile[]): ScannedFile[] {
  const byId = new Map<string, ScannedFile>();

  for (const file of files) {
    if (!file.relativePath.trim()) continue;
    byId.set(file.id, file);
  }

  return Array.from(byId.values()).sort((first, second) =>
    comparePaths(first.relativePath, second.relativePath),
  );
}

function clampConcurrency(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_CONCURRENCY;
  }
  return Math.min(MAX_CONCURRENCY, Math.max(1, Math.floor(value)));
}

/**
 * Hash candidate files with a small worker pool. Awaiting each stream keeps the
 * Node event loop free, so streaming scan progress and cancellation still work
 * while a large folder is being checked.
 */
async function hashCandidates(
  candidates: ScannedFile[],
  concurrency: number,
  worker: (file: ScannedFile) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;

  const run = async (): Promise<void> => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= candidates.length) return;
      await worker(candidates[index]);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, Math.max(1, candidates.length)) },
      () => run(),
    ),
  );
}

/**
 * Re-check the file immediately before hashing. A path that passed an earlier
 * scan is not trusted: it may now be a link, may resolve outside the approved
 * root, or may no longer be the same file.
 */
async function revalidateCandidate(
  rootPath: string,
  canonicalRoot: string | null,
  file: ScannedFile,
): Promise<
  { ok: true; absolutePath: string } | { ok: false; reason: string }
> {
  try {
    const absolutePath = resolveInsideRoot(rootPath, file.relativePath);
    const stats = await fs.lstat(absolutePath);

    if (stats.isSymbolicLink()) {
      return {
        ok: false,
        reason:
          "The entry is now a symbolic link. SlothSort never follows links.",
      };
    }
    if (!stats.isFile()) {
      return {
        ok: false,
        reason: "The entry is no longer a regular file.",
      };
    }

    const resolvedRoot = canonicalRoot ?? (await fs.realpath(rootPath));
    const canonicalPath = await fs.realpath(absolutePath);

    if (!isStrictlyInsidePath(resolvedRoot, canonicalPath)) {
      return {
        ok: false,
        reason:
          "The path now resolves outside the approved folder, so it was not read.",
      };
    }

    if (
      stats.size !== file.sizeBytes ||
      stats.mtime.toISOString() !== file.modifiedAt
    ) {
      return {
        ok: false,
        reason:
          "The file changed after the scan, so its contents were not compared.",
      };
    }

    return { ok: true, absolutePath };
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : "";

    if (code === "ENOENT") {
      return { ok: false, reason: "The file disappeared after the scan." };
    }
    if (code === "EACCES" || code === "EPERM") {
      return {
        ok: false,
        reason: "The file could not be read (permission denied).",
      };
    }

    return {
      ok: false,
      reason: "The file could not be inspected immediately before hashing.",
    };
  }
}

/**
 * Find exact duplicates from file contents. File size is only used to narrow the
 * candidates that need hashing; it is never treated as proof of equality.
 *
 * This module is deterministic and independent of the local model. It never
 * modifies, moves, or deletes a file.
 */
export async function detectDuplicates(
  options: DetectDuplicatesOptions,
): Promise<DuplicateDetectionResult> {
  const files = uniqueFiles(options.files);
  const signal = options.signal;
  const maxBytes = options.maxBytes ?? DEFAULT_HASH_MAX_BYTES;
  const hasher = options.hasher ?? hashFile;
  const concurrency = clampConcurrency(options.concurrency);
  let canonicalRoot: string | null = null;
  try {
    canonicalRoot = await fs.realpath(options.rootPath);
  } catch {
    canonicalRoot = null;
  }

  const hashingFailures: HashingFailure[] = [];
  const hashes: Record<string, string> = {};

  // Size is an inexpensive first pass: a file with a unique size cannot have an
  // exact duplicate, so it never needs to be read.
  const filesBySize = new Map<number, ScannedFile[]>();

  for (const file of files) {
    if (file.sizeBytes > maxBytes) {
      hashingFailures.push({
        relativePath: file.relativePath,
        reason:
          "The file is larger than the duplicate-detection size limit. Its contents were not compared.",
      });
      continue;
    }

    const bucket = filesBySize.get(file.sizeBytes) ?? [];
    bucket.push(file);
    filesBySize.set(file.sizeBytes, bucket);
  }

  const candidates = Array.from(filesBySize.values())
    .filter((bucket) => bucket.length > 1)
    .flat()
    .sort((first, second) =>
      comparePaths(first.relativePath, second.relativePath),
    );

  const filesToHash = candidates.length;
  let hashedFiles = 0;

  if (signal?.aborted) {
    throw new DuplicateDetectionCancelledError();
  }

  const emitProgress = async (relativePath: string): Promise<void> => {
    await options.onProgress?.({
      hashedFiles,
      filesToHash,
      currentRelativePath: relativePath,
    });
  };

  await hashCandidates(candidates, concurrency, async (file) => {
    if (signal?.aborted) {
      throw new DuplicateDetectionCancelledError();
    }

    const revalidated = await revalidateCandidate(
      options.rootPath,
      canonicalRoot,
      file,
    );
    if (!revalidated.ok) {
      hashingFailures.push({
        relativePath: file.relativePath,
        reason: revalidated.reason,
      });
      await emitProgress(file.relativePath);
      return;
    }
    const absolutePath = revalidated.absolutePath;

    const result = await hasher(absolutePath, {
      maxBytes,
      signal,
      expected: {
        sizeBytes: file.sizeBytes,
        modifiedAt: file.modifiedAt,
      },
    });

    if (
      signal?.aborted ||
      (result.status === "failed" && result.reason === "cancelled")
    ) {
      throw new DuplicateDetectionCancelledError();
    }

    if (result.status === "hashed") {
      // A custom hasher must not smuggle in a hash for different bytes.
      if (result.sizeBytes !== file.sizeBytes) {
        hashingFailures.push({
          relativePath: file.relativePath,
          reason:
            "The file size changed while it was being read. It was left out of duplicate detection.",
        });
      } else {
        hashes[file.id] = result.sha256;
        hashedFiles += 1;
      }
    } else {
      hashingFailures.push({
        relativePath: file.relativePath,
        reason: result.message,
      });
    }

    await emitProgress(file.relativePath);
  });

  if (signal?.aborted) {
    throw new DuplicateDetectionCancelledError();
  }

  const groups = buildExactGroups(files, hashes);
  const similarNameGroups = buildSimilarNameGroups(files, hashes);

  return {
    groups,
    similarNameGroups,
    hashes,
    hashingFailures: hashingFailures.sort((first, second) =>
      comparePaths(first.relativePath, second.relativePath),
    ),
    hashedFiles,
    filesToHash,
  };
}

/**
 * Group by both size and SHA-256. Matching hashes already imply matching bytes;
 * including the size keeps the group metadata honest and makes a collision
 * across different byte lengths impossible to present as a duplicate.
 */
function buildExactGroups(
  files: ScannedFile[],
  hashes: Record<string, string>,
): DuplicateGroup[] {
  const byContent = new Map<string, ScannedFile[]>();

  for (const file of files) {
    const sha256 = hashes[file.id];
    if (!sha256) continue;

    const key = `${file.sizeBytes}:${sha256}`;
    const group = byContent.get(key) ?? [];
    group.push(file);
    byContent.set(key, group);
  }

  return Array.from(byContent.entries())
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => {
      const separator = key.indexOf(":");
      const sizeBytes = Number(key.slice(0, separator));
      const sha256 = key.slice(separator + 1);
      const sorted = [...group].sort((first, second) =>
        comparePaths(first.relativePath, second.relativePath),
      );

      return {
        id: `duplicate-${sha256.slice(0, 16)}-${sizeBytes}`,
        sha256,
        sizeBytes,
        fileIds: sorted.map((file) => file.id),
      };
    })
    .sort((first, second) =>
      comparePaths(first.fileIds[0] ?? "", second.fileIds[0] ?? ""),
    );
}

/** Lowercase filename without copy markers, punctuation, or its extension. */
function normalizedNameKey(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;

  return base
    .toLowerCase()
    .replace(/\bcopy\s+of\b/g, " ")
    .replace(/\b(copy|kopie|duplicate)\b/g, " ")
    .replace(/[([{]\s*\d+\s*[)\]}]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** `img 2043` and `img 2044` share the stem `img`; plain names keep their key. */
function similarNameStem(nameKey: string): string | null {
  if (!/\s\d+$/.test(nameKey)) return null;
  const stem = nameKey.replace(/(?:\s+\d+)+$/, "").trim();
  return stem.length >= 2 ? stem : null;
}

function contentsDiffer(
  first: ScannedFile,
  second: ScannedFile,
  hashes: Record<string, string>,
): boolean {
  const firstHash = hashes[first.id] ?? first.sha256;
  const secondHash = hashes[second.id] ?? second.sha256;

  if (firstHash && secondHash) return firstHash !== secondHash;
  if (first.sizeBytes !== second.sizeBytes) return true;
  // Same size with no hashes is unknown, so it is not reported as different.
  return false;
}

/**
 * Split a bucket of similarly named files into groups whose members all have
 * different contents. This is why a copy and its original never appear here:
 * they belong in the exact-duplicate section instead.
 */
function splitByContent(
  bucket: ScannedFile[],
  hashes: Record<string, string>,
): ScannedFile[][] {
  const clusters: ScannedFile[][] = [];

  for (const file of bucket) {
    const cluster = clusters.find((members) =>
      members.every((member) => contentsDiffer(member, file, hashes)),
    );

    if (cluster) {
      cluster.push(file);
    } else {
      clusters.push([file]);
    }
  }

  return clusters.filter((cluster) => cluster.length > 1);
}

/**
 * Deterministically detect files whose names look alike but whose contents
 * differ. Two conservative signals are used:
 *
 * - the same normalized filename in different folders, and
 * - numbered variants such as `IMG_2043` / `IMG_2044`.
 *
 * Exact duplicates are excluded, so the UI can present the two lists apart.
 */
function buildSimilarNameGroups(
  files: ScannedFile[],
  hashes: Record<string, string>,
): SimilarNameGroup[] {
  const buckets = new Map<string, ScannedFile[]>();

  for (const file of files) {
    const nameKey = normalizedNameKey(file.name);
    if (!nameKey) continue;

    const stem = similarNameStem(nameKey);
    if (stem) {
      // Numbered variants are handled by their shared stem, which also covers
      // two files whose normalized names are identical.
      const stemKey = `stem:${stem}`;
      const stemBucket = buckets.get(stemKey) ?? [];
      stemBucket.push(file);
      buckets.set(stemKey, stemBucket);
      continue;
    }

    const exactKey = `name:${nameKey}`;
    const exactBucket = buckets.get(exactKey) ?? [];
    exactBucket.push(file);
    buckets.set(exactKey, exactBucket);
  }

  const clusters: ScannedFile[][] = [];

  for (const bucket of buckets.values()) {
    if (bucket.length < 2 || bucket.length > MAX_SIMILAR_NAME_BUCKET) continue;
    const sorted = [...bucket].sort((first, second) =>
      comparePaths(first.relativePath, second.relativePath),
    );
    clusters.push(...splitByContent(sorted, hashes));
  }

  const seen = new Set<string>();
  const groups: SimilarNameGroup[] = [];

  for (const cluster of clusters.sort((first, second) =>
    comparePaths(first[0]?.relativePath ?? "", second[0]?.relativePath ?? ""),
  )) {
    const members = cluster
      .filter((file) => {
        if (seen.has(file.id)) return false;
        seen.add(file.id);
        return true;
      })
      .sort((first, second) =>
        comparePaths(first.relativePath, second.relativePath),
      );

    if (members.length < 2) continue;

    groups.push({
      id: `similar-name-${groups.length + 1}`,
      fileIds: members.map((file) => file.id),
      note: "The names are similar, but the content hashes differ. These are separate files, not exact duplicates.",
    });
  }

  return groups;
}
