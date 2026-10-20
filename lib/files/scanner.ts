import { promises as fs } from "node:fs";
import type { Dirent, Stats } from "node:fs";
import path from "node:path";
import type {
  ScanProgress,
  ScanResult,
  ScannedFile,
  SkippedFile,
} from "@/types";
import { detectMimeType, isUnsupportedKind, kindForFile } from "./mime";

export type ScanErrorCode =
  | "root_unavailable"
  | "root_not_directory"
  | "scan_failed";

export class ScanError extends Error {
  readonly code: ScanErrorCode;

  constructor(code: ScanErrorCode, message: string) {
    super(message);
    this.name = "ScanError";
    this.code = code;
  }
}

export class ScanCancelledError extends Error {
  readonly progress: ScanProgress;

  constructor(progress: ScanProgress) {
    super("The scan was cancelled.");
    this.name = "ScanCancelledError";
    this.progress = progress;
  }
}

/** The smallest filesystem surface the scanner needs, injectable for tests. */
export interface ScannerFs {
  readdir(directory: string, options: { withFileTypes: true }): Promise<Dirent[]>;
  lstat(target: string): Promise<Stats>;
  realpath(target: string): Promise<string>;
}

const nodeScannerFs: ScannerFs = {
  readdir: (directory, options) => fs.readdir(directory, options),
  lstat: (target) => fs.lstat(target),
  realpath: (target) => fs.realpath(target),
};

export interface ScanOptions {
  /** Canonical root previously approved through the local folder API. */
  rootPath: string;
  signal?: AbortSignal;
  onProgress?: (progress: ScanProgress) => void | Promise<void>;
  /** Testing hook. Production callers should leave this undefined. */
  fs?: ScannerFs;
  maxFiles?: number;
  maxDirectories?: number;
  maxDepth?: number;
  maxSkippedDetails?: number;
}

const DEFAULT_MAX_FILES = 10_000;
const DEFAULT_MAX_DIRECTORIES = 2_000;
const DEFAULT_MAX_DEPTH = 12;
const DEFAULT_MAX_SKIPPED_DETAILS = 200;

const SYMLINK_REASON =
  "Symbolic link skipped. SlothSort never follows links during a scan.";

/**
 * Read-only folder scan. It traverses directory entries, reads metadata, and
 * never opens, renames, moves, or deletes a file. Symbolic links are skipped so
 * a scan cannot escape the approved root.
 */
export async function scanFolder(options: ScanOptions): Promise<ScanResult> {
  const io = options.fs ?? nodeScannerFs;
  const maxFiles = positiveInteger(options.maxFiles, DEFAULT_MAX_FILES);
  const maxDirectories = positiveInteger(
    options.maxDirectories,
    DEFAULT_MAX_DIRECTORIES,
  );
  const maxDepth = positiveInteger(options.maxDepth, DEFAULT_MAX_DEPTH);
  const maxSkippedDetails = nonNegativeInteger(
    options.maxSkippedDetails,
    DEFAULT_MAX_SKIPPED_DETAILS,
  );
  const signal = options.signal;
  const startedAt = Date.now();

  let rootPath: string;
  try {
    rootPath = await io.realpath(options.rootPath);
  } catch {
    throw new ScanError(
      "root_unavailable",
      "The approved folder is no longer available. Choose it again.",
    );
  }

  try {
    const rootStats = await io.lstat(rootPath);
    if (!rootStats.isDirectory()) {
      throw new ScanError(
        "root_not_directory",
        "The approved path is no longer a folder.",
      );
    }
  } catch (error) {
    if (error instanceof ScanError) throw error;
    throw new ScanError(
      "root_unavailable",
      "The approved folder could not be read. Check its permissions and try again.",
    );
  }

  const files: ScannedFile[] = [];
  const skipped: SkippedFile[] = [];
  let skippedCount = 0;
  let directoriesScanned = 0;
  let truncated = false;
  let truncationReason: string | null = null;
  let currentRelativePath = "";

  function makeProgress(): ScanProgress {
    return {
      scannedFiles: files.length,
      directoriesScanned,
      skippedCount,
      currentRelativePath,
    };
  }

  async function emitProgress(): Promise<void> {
    await options.onProgress?.(makeProgress());
  }

  function checkCancelled(): void {
    if (signal?.aborted) {
      throw new ScanCancelledError(makeProgress());
    }
  }

  function addSkipped(relativePath: string, reason: string): void {
    skippedCount += 1;
    if (skipped.length < maxSkippedDetails) {
      skipped.push({
        relativePath: relativePath || ".",
        reason,
      });
    }
  }

  function stopBecause(reason: string): void {
    if (truncated) return;
    truncated = true;
    truncationReason = reason;
  }

  async function walk(
    directoryPath: string,
    relativeDirectory: string,
    depth: number,
  ): Promise<void> {
    checkCancelled();
    if (truncated) return;

    if (depth > maxDepth) {
      addSkipped(
        relativeDirectory,
        "Maximum folder depth reached; this folder was not scanned.",
      );
      stopBecause(`Folder depth limit reached at ${maxDepth} levels.`);
      return;
    }

    if (directoriesScanned >= maxDirectories) {
      stopBecause(`Scan stopped after ${maxDirectories} folders.`);
      return;
    }

    let entries: Dirent[];
    try {
      entries = await io.readdir(directoryPath, { withFileTypes: true });
    } catch (error) {
      const reason =
        relativeDirectory === ""
          ? reasonForReadError(error, "root")
          : reasonForReadError(error, "folder");
      addSkipped(relativeDirectory, reason);
      await emitProgress();
      return;
    }

    directoriesScanned += 1;
    currentRelativePath = relativeDirectory;
    entries.sort((first, second) =>
      first.name.localeCompare(second.name, undefined, {
        sensitivity: "base",
        numeric: true,
      }),
    );

    for (const entry of entries) {
      checkCancelled();
      if (truncated) return;

      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const fullPath = path.join(directoryPath, entry.name);

      if (entry.isSymbolicLink()) {
        addSkipped(relativePath, SYMLINK_REASON);
        await emitProgress();
        continue;
      }

      let stats: Stats;
      try {
        stats = await io.lstat(fullPath);
      } catch (error) {
        addSkipped(relativePath, reasonForReadError(error, "entry"));
        await emitProgress();
        continue;
      }

      if (stats.isSymbolicLink()) {
        addSkipped(relativePath, SYMLINK_REASON);
        await emitProgress();
        continue;
      }

      if (stats.isDirectory()) {
        await walk(fullPath, relativePath, depth + 1);
        await emitProgress();
        continue;
      }

      if (!stats.isFile()) {
        addSkipped(relativePath, "Special filesystem entry skipped.");
        await emitProgress();
        continue;
      }

      if (files.length >= maxFiles) {
        stopBecause(`Scan stopped after ${maxFiles} files.`);
        return;
      }

      files.push(toScannedFile(entry.name, relativePath, stats));
      currentRelativePath = relativePath;
      await emitProgress();
    }
  }

  checkCancelled();
  await emitProgress();
  await walk(rootPath, "", 0);
  checkCancelled();

  files.sort((first, second) =>
    first.relativePath.localeCompare(second.relativePath, undefined, {
      sensitivity: "base",
      numeric: true,
    }),
  );
  skipped.sort((first, second) =>
    first.relativePath.localeCompare(second.relativePath, undefined, {
      sensitivity: "base",
      numeric: true,
    }),
  );

  return {
    rootName: path.basename(rootPath) || rootPath,
    scannedAt: new Date().toISOString(),
    files,
    // Hashing and duplicate grouping are a later milestone.
    duplicateGroups: [],
    skipped,
    skippedCount,
    directoriesScanned,
    truncated,
    truncationReason,
    durationMs: Math.max(0, Date.now() - startedAt),
  };
}

function toScannedFile(
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

function extensionOf(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === name.length - 1) return "";
  return name.slice(dotIndex + 1);
}

function reasonForReadError(
  error: unknown,
  target: "root" | "folder" | "entry",
): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";

  if (code === "EACCES" || code === "EPERM") {
    if (target === "root") {
      return "The approved folder could not be read (permission denied).";
    }
    return target === "folder"
      ? "Folder could not be opened (permission denied)."
      : "File metadata could not be read (permission denied).";
  }
  if (code === "ENOENT") {
    return "Entry disappeared while scanning.";
  }
  if (code === "ELOOP") {
    return "Symbolic link loop skipped.";
  }
  if (code === "ENOTDIR") {
    return "That path is no longer a folder.";
  }
  if (code === "EBUSY") {
    return "Entry is in use by another application.";
  }

  if (target === "root") {
    return "The approved folder could not be read.";
  }
  return target === "folder"
    ? "Folder could not be read."
    : "Metadata could not be read.";
}

function positiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value));
}

function nonNegativeInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}
