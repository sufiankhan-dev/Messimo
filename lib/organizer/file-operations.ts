import { constants as fsConstants, promises as fs } from "node:fs";
import type { Stats } from "node:fs";
import path from "node:path";
import { hashFile } from "@/lib/files/hash";
import {
  assertSafeRelativePath,
  isSameOrInsidePath,
  isSamePath,
  isStrictlyInsidePath,
  PathSafetyError,
  resolveInsideRoot,
} from "@/lib/files/path-safety";
import { safeFileNameSchema } from "@/lib/validation/organization";
import { APPROVED_DESTINATIONS } from "./rules";

/**
 * Safe filesystem primitives for applying an approved organization plan.
 *
 * Nothing here trusts a path because it was validated earlier. Every operation
 * canonicalizes the approved root, rejects symbolic links at every segment,
 * refuses an existing destination, and verifies the file's identity before and
 * after it moves. A move is implemented with an exclusive hard link or an
 * exclusive copy followed by a source removal, so an existing file is never
 * overwritten and a failed operation leaves the source in place.
 */

export type FileOperationErrorCode =
  | "invalid_path"
  | "outside_root"
  | "root_unavailable"
  | "source_missing"
  | "source_changed"
  | "source_not_file"
  | "symlink"
  | "destination_exists"
  | "destination_blocked"
  | "permission_denied"
  | "file_locked"
  | "disk_full"
  | "cancelled"
  | "io_error";

export class FileOperationError extends Error {
  readonly code: FileOperationErrorCode;

  constructor(code: FileOperationErrorCode, message: string) {
    super(message);
    this.name = "FileOperationError";
    this.code = code;
  }
}

export type MoveMethod = "link" | "copy";

export interface ExpectedFileIdentity {
  sizeBytes?: number;
  modifiedAt?: string;
  sha256?: string;
}

export interface MoveIdentity {
  sizeBytes: number;
  modifiedAt: string;
  sha256: string;
  ino: number;
  dev: number;
}

export interface PreflightMoveRequest {
  rootPath: string;
  sourceRelativePath: string;
  targetRelativePath: string;
  /** Apply-time moves must land in the organization allowlist. Undo may not. */
  requireApprovedDestination: boolean;
  expected?: ExpectedFileIdentity;
  signal?: AbortSignal;
}

export interface PreparedMove {
  rootPath: string;
  canonicalRoot: string;
  sourceRelativePath: string;
  targetRelativePath: string;
  sourcePath: string;
  targetPath: string;
  sourceStats: Stats;
}

export interface MoveOutcome {
  sourceRelativePath: string;
  targetRelativePath: string;
  method: MoveMethod;
  identity: MoveIdentity;
}

interface ApprovedTarget {
  folder: string;
  fileName: string;
  relativePath: string;
}

function fsErrorCode(error: unknown): string {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : "";
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  return name.slice(dot + 1);
}

export function toForwardSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}

/** Validate a relative path and normalize its separators without resolving it. */
export function normalizeRelativePath(value: string): string {
  assertSafeRelativePath(value);
  return toForwardSlashes(value);
}

function pathKey(value: string): string {
  return toForwardSlashes(value).toLowerCase();
}

export function sameRelativePath(first: string, second: string): boolean {
  return pathKey(first) === pathKey(second);
}

function invalidPath(message: string): FileOperationError {
  return new FileOperationError("invalid_path", message);
}

/**
 * Validate a proposed destination against the fixed organization allowlist.
 * The filename must be a single safe segment and keep the source extension.
 */
export function resolveApprovedTarget(
  targetRelativePath: string,
  sourceFileName: string,
): ApprovedTarget {
  const normalized = normalizeRelativePath(targetRelativePath);
  const segments = normalized.split("/");
  const fileName = segments.at(-1) ?? "";
  const folderInput = segments.slice(0, -1).join("/");

  if (!folderInput) {
    throw invalidPath(
      "The destination must be one of the approved organization folders.",
    );
  }

  const parsedName = safeFileNameSchema.safeParse(fileName);
  if (!parsedName.success || parsedName.data !== fileName) {
    throw invalidPath(
      "The proposed filename is not a safe single filename. Review the suggestion.",
    );
  }

  const folder = APPROVED_DESTINATIONS.find(
    (destination) => destination.toLowerCase() === folderInput.toLowerCase(),
  );
  if (!folder) {
    throw invalidPath(
      "The destination is outside the approved organization folders. Review the suggestion.",
    );
  }

  const sourceExtension = extensionOf(sourceFileName);
  const targetExtension = extensionOf(fileName);

  if (sourceExtension.toLowerCase() !== targetExtension.toLowerCase()) {
    throw invalidPath(
      "The proposed filename changes the file extension. Messimo never converts files.",
    );
  }

  return {
    folder,
    fileName,
    relativePath: `${folder}/${fileName}`,
  };
}

function checkSignal(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new FileOperationError(
      "cancelled",
      "The batch was cancelled before this operation started.",
    );
  }
}

/**
 * The root must still be the same canonical directory that the user approved.
 * A root replaced by a link or moved elsewhere is refused rather than followed.
 */
export async function canonicalizeApprovedRoot(
  rootPath: string,
): Promise<string> {
  let stats: Stats;
  try {
    stats = await fs.lstat(rootPath);
  } catch {
    throw new FileOperationError(
      "root_unavailable",
      "The approved folder is no longer available. Choose it again. No files were changed.",
    );
  }

  if (stats.isSymbolicLink()) {
    throw new FileOperationError(
      "symlink",
      "The approved folder is now a symbolic link. Messimo will not follow it.",
    );
  }
  if (!stats.isDirectory()) {
    throw new FileOperationError(
      "root_unavailable",
      "The approved folder is no longer a folder. Choose it again.",
    );
  }

  let canonical: string;
  try {
    canonical = await fs.realpath(rootPath);
  } catch {
    throw new FileOperationError(
      "root_unavailable",
      "The approved folder could not be resolved. Choose it again.",
    );
  }

  if (!isSamePath(path.resolve(rootPath), canonical)) {
    throw new FileOperationError(
      "root_unavailable",
      "The approved folder changed after it was approved. Choose it again before applying changes.",
    );
  }

  return canonical;
}

/**
 * Walk directory segments one at a time. Symbolic links, junctions, and files
 * that block the path are refused. Missing folders are created only when
 * `create` is true, never with a recursive API that could follow a link.
 */
async function walkDirectories(
  canonicalRoot: string,
  segments: string[],
  create: boolean,
  signal?: AbortSignal,
): Promise<string> {
  let current = canonicalRoot;
  let lastExisting = canonicalRoot;

  for (const segment of segments) {
    checkSignal(signal);
    const next = path.join(current, segment);

    let stats: Stats | null = null;
    try {
      stats = await fs.lstat(next);
    } catch (error) {
      const code = fsErrorCode(error);
      if (code === "ENOENT") {
        // A missing ancestor is fine during validation; execution creates each
        // level separately with `create: true`.
        if (!create) return lastExisting;
        try {
          await fs.mkdir(next);
        } catch (mkdirError) {
          if (fsErrorCode(mkdirError) !== "EEXIST") {
            throw mapFsError(mkdirError, "destination");
          }
        }
        try {
          stats = await fs.lstat(next);
        } catch {
          throw new FileOperationError(
            "io_error",
            "The destination folder could not be created.",
          );
        }
      } else if (code === "ENOTDIR") {
        throw new FileOperationError(
          "destination_blocked",
          "A file blocks this destination folder.",
        );
      } else {
        throw mapFsError(error, "destination");
      }
    }

    if (!stats) continue;

    if (stats.isSymbolicLink()) {
      throw new FileOperationError(
        "symlink",
        "A symbolic link is in the destination path. Messimo will not follow it.",
      );
    }
    if (!stats.isDirectory()) {
      throw new FileOperationError(
        "destination_blocked",
        "A file is blocking the destination folder.",
      );
    }

    let resolved: string;
    try {
      resolved = await fs.realpath(next);
    } catch {
      throw new FileOperationError(
        "io_error",
        "The destination folder could not be resolved.",
      );
    }

    if (!isSameOrInsidePath(canonicalRoot, resolved)) {
      throw new FileOperationError(
        "outside_root",
        "The destination resolves outside the approved folder.",
      );
    }

    current = resolved;
    lastExisting = resolved;
  }

  return current;
}

async function assertWritable(directory: string): Promise<void> {
  try {
    await fs.access(directory, fsConstants.W_OK);
  } catch {
    throw new FileOperationError(
      "permission_denied",
      "Messimo does not have permission to write to this folder. Check its permissions.",
    );
  }
}

async function assertReadable(filePath: string): Promise<void> {
  try {
    await fs.access(filePath, fsConstants.R_OK);
  } catch {
    throw new FileOperationError(
      "permission_denied",
      "This file cannot be read. Check its permissions.",
    );
  }
}

function identityMismatch(
  before: Stats,
  current: Stats,
  expected?: ExpectedFileIdentity,
): boolean {
  if (before.size !== current.size || before.mtimeMs !== current.mtimeMs) {
    return true;
  }
  if (before.ino !== 0 && current.ino !== 0 && before.ino !== current.ino) {
    return true;
  }
  if (expected?.sizeBytes !== undefined && current.size !== expected.sizeBytes) {
    return true;
  }
  if (
    expected?.modifiedAt !== undefined &&
    current.mtime.toISOString() !== expected.modifiedAt
  ) {
    return true;
  }
  return false;
}

async function hashFileForMove(
  filePath: string,
  role: "source" | "destination",
): Promise<string> {
  const result = await hashFile(filePath, {
    maxBytes: Number.MAX_SAFE_INTEGER,
  });

  if (result.status === "hashed") return result.sha256;

  throw new FileOperationError(
    result.reason === "changed" ? "source_changed" : "io_error",
    role === "source"
      ? "The file could not be read completely. It was not moved."
      : "The copied file could not be verified. The source was left in place.",
  );
}

function mapFsError(
  error: unknown,
  role: "source" | "destination",
): FileOperationError {
  const code = fsErrorCode(error);

  if (code === "ENOENT") {
    return new FileOperationError(
      "source_missing",
      role === "source"
        ? "The file no longer exists. Generate a new preview."
        : "A folder in the destination path disappeared.",
    );
  }
  if (code === "EEXIST") {
    return new FileOperationError(
      "destination_exists",
      "A file already exists at this destination. Messimo never overwrites files.",
    );
  }
  if (code === "EACCES" || code === "EPERM") {
    return new FileOperationError(
      code === "EPERM"
        ? "file_locked"
        : "permission_denied",
      code === "EPERM"
        ? "The file is locked or permission was denied. Close the application using it and try again."
        : "Messimo does not have permission to change this file or folder.",
    );
  }
  if (code === "EBUSY") {
    return new FileOperationError(
      "file_locked",
      "The file is in use by another application. Close it and try again.",
    );
  }
  if (code === "ENOSPC") {
    return new FileOperationError(
      "disk_full",
      "There is not enough disk space to complete the operation. The source was kept.",
    );
  }
  if (code === "ENAMETOOLONG" || code === "EINVAL") {
    return new FileOperationError(
      "invalid_path",
      "The proposed path is not valid on this system.",
    );
  }

  return new FileOperationError(
    "io_error",
    role === "source"
      ? "The file could not be moved. It was left in place."
      : "The destination could not be prepared.",
  );
}

/**
 * Read-only validation immediately before a move. This is called before the
 * batch record is written and again inside `executeMove`, so a path or file that
 * changed in between is rejected instead of trusted.
 */
export async function preflightMove(
  request: PreflightMoveRequest,
): Promise<PreparedMove> {
  checkSignal(request.signal);

  let canonicalRoot: string;
  let sourceRelativePath: string;
  let targetRelativePath: string;
  let sourcePath: string;
  let targetPath: string;

  try {
    canonicalRoot = await canonicalizeApprovedRoot(request.rootPath);
    sourceRelativePath = normalizeRelativePath(request.sourceRelativePath);
    targetRelativePath = normalizeRelativePath(request.targetRelativePath);

    if (sameRelativePath(sourceRelativePath, targetRelativePath)) {
      throw new FileOperationError(
        "invalid_path",
        "The file is already at this destination, so there is nothing to move.",
      );
    }

    sourcePath = resolveInsideRoot(canonicalRoot, sourceRelativePath);
    targetPath = resolveInsideRoot(canonicalRoot, targetRelativePath);

    const sourceName = path.basename(sourcePath);
    if (request.requireApprovedDestination) {
      const approved = resolveApprovedTarget(targetRelativePath, sourceName);
      targetRelativePath = approved.relativePath;
      targetPath = resolveInsideRoot(canonicalRoot, approved.relativePath);
    }
  } catch (error) {
    if (error instanceof FileOperationError) throw error;
    if (error instanceof PathSafetyError) {
      throw new FileOperationError("invalid_path", error.message);
    }
    throw new FileOperationError(
      "invalid_path",
      "The requested path is not valid.",
    );
  }

  const sourceSegments = sourceRelativePath.split("/");
  const sourceParent = await walkDirectories(
    canonicalRoot,
    sourceSegments.slice(0, -1),
    false,
    request.signal,
  );

  let sourceStats: Stats;
  try {
    sourceStats = await fs.lstat(sourcePath);
  } catch (error) {
    if (fsErrorCode(error) === "ENOENT") {
      throw new FileOperationError(
        "source_missing",
        "The file no longer exists. Generate a new preview.",
      );
    }
    throw mapFsError(error, "source");
  }

  if (sourceStats.isSymbolicLink()) {
    throw new FileOperationError(
      "symlink",
      "The file is now a symbolic link. Messimo never follows links.",
    );
  }
  if (!sourceStats.isFile()) {
    throw new FileOperationError(
      "source_not_file",
      "The entry is no longer a regular file.",
    );
  }

  let canonicalSource: string;
  try {
    canonicalSource = await fs.realpath(sourcePath);
  } catch {
    throw new FileOperationError(
      "source_missing",
      "The file could not be resolved. Generate a new preview.",
    );
  }
  if (!isStrictlyInsidePath(canonicalRoot, canonicalSource)) {
    throw new FileOperationError(
      "outside_root",
      "The file resolves outside the approved folder. It was not moved.",
    );
  }

  await assertReadable(canonicalSource);
  await assertWritable(sourceParent);

  if (
    request.expected?.sizeBytes !== undefined &&
    sourceStats.size !== request.expected.sizeBytes
  ) {
    throw new FileOperationError(
      "source_changed",
      "The file changed after the preview was generated. Generate a new preview.",
    );
  }
  if (
    request.expected?.modifiedAt !== undefined &&
    sourceStats.mtime.toISOString() !== request.expected.modifiedAt
  ) {
    throw new FileOperationError(
      "source_changed",
      "The file changed after the preview was generated. Generate a new preview.",
    );
  }
  if (request.expected?.sha256) {
    const digest = await hashFileForMove(canonicalSource, "source");
    if (digest !== request.expected.sha256) {
      throw new FileOperationError(
        "source_changed",
        "The file contents changed after the preview was generated. Generate a new preview.",
      );
    }
  }

  const targetSegments = targetRelativePath.split("/");
  const targetParent = await walkDirectories(
    canonicalRoot,
    targetSegments.slice(0, -1),
    false,
    request.signal,
  );

  try {
    const targetStats = await fs.lstat(targetPath);
    if (targetStats.isSymbolicLink()) {
      throw new FileOperationError(
        "destination_blocked",
        "A symbolic link exists at the destination. Messimo will not follow it.",
      );
    }
    if (targetStats.isDirectory()) {
      throw new FileOperationError(
        "destination_blocked",
        "A folder exists where this file would go.",
      );
    }
    throw new FileOperationError(
      "destination_exists",
      `A file already exists at "${targetRelativePath}". Messimo never overwrites files. Review the destination or choose another name.`,
    );
  } catch (error) {
    if (error instanceof FileOperationError) throw error;
    if (fsErrorCode(error) !== "ENOENT") {
      throw mapFsError(error, "destination");
    }
  }

  await assertWritable(targetParent);

  if (!isStrictlyInsidePath(canonicalRoot, targetPath)) {
    throw new FileOperationError(
      "outside_root",
      "The destination is outside the approved folder.",
    );
  }

  return {
    rootPath: request.rootPath,
    canonicalRoot,
    sourceRelativePath,
    targetRelativePath,
    sourcePath,
    targetPath,
    sourceStats,
  };
}

function sameInode(first: Stats, second: Stats): boolean {
  if (first.ino === 0 || second.ino === 0) return true;
  return first.ino === second.ino && first.dev === second.dev;
}

async function removeCreatedTarget(
  targetPath: string,
  expected: Stats | null,
): Promise<void> {
  if (!expected) return;

  try {
    const current = await fs.lstat(targetPath);
    if (current.isSymbolicLink() || !current.isFile()) return;
    if (!sameInode(current, expected)) return;
    await fs.unlink(targetPath);
  } catch {
    // Best-effort rollback. The source is never removed until verification
    // succeeds, so a leftover target is a duplicate, not lost data.
  }
}

function linkFallbackAllowed(error: unknown): boolean {
  const code = fsErrorCode(error);
  return (
    code === "EXDEV" ||
    code === "EPERM" ||
    code === "EACCES" ||
    code === "ENOSYS" ||
    code === "ENOTSUP" ||
    code === "EINVAL" ||
    code === "UNKNOWN"
  );
}

/**
 * Execute one preflighted move. The request is validated again at entry, then
 * directories are created one segment at a time, an exclusive hard link or copy
 * is created, contents are verified, and only then is the source removed.
 */
export async function executeMove(
  request: PreflightMoveRequest,
): Promise<MoveOutcome> {
  const prepared = await preflightMove(request);
  checkSignal(request.signal);

  const targetSegments = prepared.targetRelativePath.split("/");
  const targetParent = await walkDirectories(
    prepared.canonicalRoot,
    targetSegments.slice(0, -1),
    true,
    request.signal,
  );
  await assertWritable(targetParent);
  checkSignal(request.signal);

  // Creating folders can race with another process. Re-check the target.
  try {
    await fs.lstat(prepared.targetPath);
    throw new FileOperationError(
      "destination_exists",
      `A file already exists at "${prepared.targetRelativePath}". Messimo never overwrites files. Review the destination or choose another name.`,
    );
  } catch (error) {
    if (error instanceof FileOperationError) throw error;
    if (fsErrorCode(error) !== "ENOENT") {
      throw mapFsError(error, "destination");
    }
  }

  const sourceDigest = await hashFileForMove(prepared.sourcePath, "source");
  if (request.expected?.sha256 && sourceDigest !== request.expected.sha256) {
    throw new FileOperationError(
      "source_changed",
      "The file contents changed after the preview was generated. Generate a new preview.",
    );
  }

  const beforeMove = await fs.lstat(prepared.sourcePath);
  if (identityMismatch(prepared.sourceStats, beforeMove, request.expected)) {
    throw new FileOperationError(
      "source_changed",
      "The file changed while Messimo was preparing the move. It was left in place.",
    );
  }
  checkSignal(request.signal);

  let linked = false;
  try {
    await fs.link(prepared.sourcePath, prepared.targetPath);
    linked = true;
  } catch (error) {
    if (!linkFallbackAllowed(error)) {
      throw mapFsError(error, "destination");
    }
  }

  if (linked) {
    let linkedStats: Stats;
    try {
      linkedStats = await fs.lstat(prepared.targetPath);
    } catch (error) {
      await removeCreatedTarget(prepared.targetPath, beforeMove);
      throw mapFsError(error, "destination");
    }

    let sourceAfterLink: Stats;
    try {
      sourceAfterLink = await fs.lstat(prepared.sourcePath);
    } catch {
      await removeCreatedTarget(prepared.targetPath, linkedStats);
      throw new FileOperationError(
        "source_missing",
        "The file disappeared while it was being moved. The new link was removed.",
      );
    }

    if (
      !linkedStats.isFile() ||
      linkedStats.isSymbolicLink() ||
      linkedStats.size !== beforeMove.size ||
      !sameInode(linkedStats, beforeMove) ||
      identityMismatch(beforeMove, sourceAfterLink, request.expected)
    ) {
      await removeCreatedTarget(prepared.targetPath, linkedStats);
      throw new FileOperationError(
        "source_changed",
        "The file changed while it was being moved. It was left in place.",
      );
    }

    // A cancellation after the link exists must not leave the new name behind:
    // history would report a failure while the file also appeared at the
    // destination. Removing the link keeps the original file exactly as it was.
    try {
      checkSignal(request.signal);
    } catch (error) {
      await removeCreatedTarget(prepared.targetPath, linkedStats);
      throw error;
    }

    try {
      await fs.unlink(prepared.sourcePath);
    } catch (error) {
      await removeCreatedTarget(prepared.targetPath, linkedStats);
      throw mapFsError(error, "source");
    }

    const finalStats = await fs.lstat(prepared.targetPath);

    return {
      sourceRelativePath: prepared.sourceRelativePath,
      targetRelativePath: prepared.targetRelativePath,
      method: "link",
      identity: {
        sizeBytes: finalStats.size,
        modifiedAt: finalStats.mtime.toISOString(),
        sha256: sourceDigest,
        ino: finalStats.ino,
        dev: finalStats.dev,
      },
    };
  }

  let created: Stats | null = null;
  try {
    await fs.copyFile(
      prepared.sourcePath,
      prepared.targetPath,
      fsConstants.COPYFILE_EXCL,
    );
    created = await fs.lstat(prepared.targetPath);
  } catch (error) {
    await removeCreatedTarget(prepared.targetPath, created);
    throw mapFsError(error, "destination");
  }

  checkSignal(request.signal);

  const copiedDigest = await hashFileForMove(prepared.targetPath, "destination");
  let sourceAfterCopy: Stats;
  try {
    sourceAfterCopy = await fs.lstat(prepared.sourcePath);
  } catch {
    await removeCreatedTarget(prepared.targetPath, created);
    throw new FileOperationError(
      "source_missing",
      "The file disappeared while it was being copied. The copy was removed.",
    );
  }

  if (
    copiedDigest !== sourceDigest ||
    identityMismatch(beforeMove, sourceAfterCopy, request.expected)
  ) {
    await removeCreatedTarget(prepared.targetPath, created);
    throw new FileOperationError(
      "source_changed",
      "The file changed while it was being copied. The source was kept and the copy was removed.",
    );
  }

  try {
    await fs.utimes(
      prepared.targetPath,
      prepared.sourceStats.atime,
      prepared.sourceStats.mtime,
    );
  } catch {
    // Timestamp preservation is best-effort. Contents were already verified.
  }

  // Same rule as the link path: if the batch is cancelled after the verified
  // copy exists, remove the copy so the source is the only copy of the file.
  try {
    checkSignal(request.signal);
  } catch (error) {
    await removeCreatedTarget(prepared.targetPath, created);
    throw error;
  }

  try {
    await fs.unlink(prepared.sourcePath);
  } catch (error) {
    await removeCreatedTarget(prepared.targetPath, created);
    throw mapFsError(error, "source");
  }

  const finalStats = await fs.lstat(prepared.targetPath);

  return {
    sourceRelativePath: prepared.sourceRelativePath,
    targetRelativePath: prepared.targetRelativePath,
    method: "copy",
    identity: {
      sizeBytes: finalStats.size,
      modifiedAt: finalStats.mtime.toISOString(),
      sha256: sourceDigest,
      ino: finalStats.ino,
      dev: finalStats.dev,
    },
  };
}
