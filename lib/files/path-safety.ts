import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export type PathErrorCode =
  | "invalid_path"
  | "not_absolute"
  | "not_found"
  | "not_directory"
  | "not_readable"
  | "protected_path"
  | "outside_root"
  | "unsafe_symlink";

/** A path validation failure with a safe, user-facing message. */
export class PathSafetyError extends Error {
  readonly code: PathErrorCode;

  constructor(code: PathErrorCode, message: string) {
    super(message);
    this.name = "PathSafetyError";
    this.code = code;
  }
}

export interface PathVerdict {
  allowed: boolean;
  reason: string | null;
}

const MAX_PATH_LENGTH = 4096;

function cleanInput(rawPath: string): string {
  let value = rawPath.trim();

  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1).trim();
  }

  if (!value) {
    throw new PathSafetyError("invalid_path", "Enter a folder path.");
  }
  if (value.length > MAX_PATH_LENGTH) {
    throw new PathSafetyError("invalid_path", "That folder path is too long.");
  }
  if (value.includes("\0")) {
    throw new PathSafetyError(
      "invalid_path",
      "That folder path contains an invalid character.",
    );
  }
  if (isUncPath(value)) {
    throw new PathSafetyError(
      "invalid_path",
      "Network and device paths are not supported. Choose a folder on this computer.",
    );
  }

  return value;
}

export function isUncPath(value: string): boolean {
  return process.platform === "win32" && /^[\\/]{2}/.test(value);
}

export function expandHome(rawPath: string): string {
  const value = cleanInput(rawPath);
  const home = safeHomeDirectory();

  if (!home) {
    throw new PathSafetyError(
      "invalid_path",
      "The home folder could not be determined on this machine.",
    );
  }

  if (value === "~") return home;
  if (value.startsWith("~/") || value.startsWith("~\\")) {
    return path.join(/*turbopackIgnore: true*/ home, value.slice(2));
  }
  if (!path.isAbsolute(value)) {
    return path.join(/*turbopackIgnore: true*/ home, value);
  }
  return value;
}

/**
 * Canonicalize a folder for browsing. Browsing does not approve a folder for
 * scanning; it only lists one readable level so the user can navigate.
 */
export async function resolveBrowsePath(rawPath?: string): Promise<string> {
  const target =
    rawPath === undefined || rawPath.trim() === ""
      ? safeHomeDirectory()
      : expandHome(rawPath);

  if (!target) {
    throw new PathSafetyError(
      "not_found",
      "The home folder could not be determined on this machine.",
    );
  }

  return canonicalizeDirectory(target);
}

/**
 * Canonicalize and approve a root folder. Filesystem roots, system folders, and
 * the user's whole home folder are rejected so a scan never starts at the top of
 * a drive by accident.
 */
export async function approveRoot(rawPath: string): Promise<string> {
  const cleaned = cleanInput(rawPath);

  if (!path.isAbsolute(cleaned)) {
    throw new PathSafetyError(
      "not_absolute",
      "Choose an absolute folder path, such as C:\\Users\\you\\Downloads.",
    );
  }

  const resolved = path.resolve(cleaned);
  const initialVerdict = inspectSelectablePath(resolved);
  if (!initialVerdict.allowed) {
    throw new PathSafetyError(
      "protected_path",
      initialVerdict.reason ?? "That folder cannot be used as a scan root.",
    );
  }

  const canonical = await canonicalizeDirectory(resolved);
  const canonicalVerdict = inspectSelectablePath(canonical);
  if (!canonicalVerdict.allowed) {
    throw new PathSafetyError(
      "protected_path",
      canonicalVerdict.reason ?? "That folder cannot be used as a scan root.",
    );
  }

  await assertDirectoryIsReadable(canonical);
  return canonical;
}

async function canonicalizeDirectory(target: string): Promise<string> {
  let canonical: string;

  try {
    canonical = await fs.realpath(target);
  } catch (error) {
    throw pathErrorFromFs(error, "not_found", "That folder could not be found.");
  }

  try {
    const stats = await fs.stat(canonical);
    if (!stats.isDirectory()) {
      throw new PathSafetyError(
        "not_directory",
        "That path is a file, not a folder.",
      );
    }
  } catch (error) {
    if (error instanceof PathSafetyError) throw error;
    throw pathErrorFromFs(error, "not_readable", "That folder cannot be read.");
  }

  return canonical;
}

async function assertDirectoryIsReadable(folderPath: string): Promise<void> {
  let handle: Awaited<ReturnType<typeof fs.opendir>> | null = null;

  try {
    handle = await fs.opendir(folderPath);
  } catch (error) {
    throw pathErrorFromFs(
      error,
      "not_readable",
      "That folder cannot be read. Check its permissions and try again.",
    );
  } finally {
    if (handle) {
      await handle.close().catch(() => undefined);
    }
  }
}

function pathErrorFromFs(
  error: unknown,
  fallbackCode: PathErrorCode,
  fallbackMessage: string,
): PathSafetyError {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";

  if (code === "ENOENT") {
    return new PathSafetyError("not_found", "That folder could not be found.");
  }
  if (code === "ENOTDIR") {
    return new PathSafetyError(
      "not_directory",
      "That path is a file, not a folder.",
    );
  }
  if (code === "EACCES" || code === "EPERM") {
    return new PathSafetyError(
      "not_readable",
      "That folder cannot be read. Check its permissions and try again.",
    );
  }
  if (code === "ELOOP") {
    return new PathSafetyError(
      "unsafe_symlink",
      "That path contains a symbolic link loop.",
    );
  }

  return new PathSafetyError(fallbackCode, fallbackMessage);
}

/**
 * Decide whether a canonical path may be used as a scan root. This checks
 * whether the path is a drive root, a system folder, the home folder itself, or
 * a parent of the home folder.
 */
export function inspectSelectablePath(canonicalPath: string): PathVerdict {
  if (!path.isAbsolute(canonicalPath)) {
    return {
      allowed: false,
      reason: "Choose an absolute folder path.",
    };
  }
  if (isUncPath(canonicalPath)) {
    return {
      allowed: false,
      reason: "Network and device paths are not supported.",
    };
  }

  const resolved = path.resolve(canonicalPath);
  const root = path.parse(resolved).root;

  if (isSamePath(resolved, root)) {
    return {
      allowed: false,
      reason:
        "Scanning an entire drive is not allowed. Choose a specific folder inside it.",
    };
  }

  const home = safeHomeDirectory();
  if (home) {
    if (isSamePath(resolved, home)) {
      return {
        allowed: false,
        reason:
          "Choose a folder inside your home folder, not the whole home folder.",
      };
    }

    const homeParent = path.dirname(home);
    if (isSamePath(resolved, homeParent)) {
      return {
        allowed: false,
        reason: "Choose a specific folder, not the folder that contains it.",
      };
    }
  }

  for (const systemFolder of systemFolders()) {
    if (isSameOrInsidePath(systemFolder, resolved)) {
      return {
        allowed: false,
        reason:
          "System folders are protected. Choose a personal folder such as Downloads or Documents.",
      };
    }
  }

  return { allowed: true, reason: null };
}

function systemFolders(): string[] {
  if (process.platform === "win32") {
    const root = path.parse(safeHomeDirectory() ?? process.cwd()).root;
    const env = process.env;
    const folders = [
      env.SystemRoot,
      env.WINDIR,
      env.ProgramFiles,
      env["ProgramFiles(x86)"],
      env.ProgramW6432,
      env.ProgramData,
      env.CommonProgramFiles,
      path.join(root, "Windows"),
      path.join(root, "$Recycle.Bin"),
      path.join(root, "System Volume Information"),
    ];

    return uniqueResolvedPaths(folders);
  }

  return uniqueResolvedPaths([
    "/etc",
    "/usr",
    "/bin",
    "/sbin",
    "/proc",
    "/sys",
    "/dev",
    "/boot",
    "/System",
    "/Library",
    "/private",
    "/opt",
  ]);
}

function uniqueResolvedPaths(values: Array<string | undefined>): string[] {
  const result = new Set<string>();

  for (const value of values) {
    if (!value) continue;
    try {
      result.add(path.resolve(value));
    } catch {
      // Ignore malformed environment values.
    }
  }

  return Array.from(result);
}

function safeHomeDirectory(): string | null {
  try {
    return os.homedir() || null;
  } catch {
    return null;
  }
}

function comparablePath(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function isSamePath(first: string, second: string): boolean {
  return comparablePath(first) === comparablePath(second);
}

/** True when `candidate` is inside `parent` (or is the parent itself). */
export function isSameOrInsidePath(parent: string, candidate: string): boolean {
  const relative = path.relative(
    comparablePath(parent),
    comparablePath(candidate),
  );

  return (
    relative === "" ||
    (!path.isAbsolute(relative) &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`))
  );
}

/** True only when `candidate` is strictly inside `parent`. */
export function isStrictlyInsidePath(
  parent: string,
  candidate: string,
): boolean {
  return !isSamePath(parent, candidate) && isSameOrInsidePath(parent, candidate);
}

/**
 * Validate a path relative to an approved root. Rejects absolute paths, drive
 * letters, path traversal, and unsafe segments before resolving.
 */
export function resolveInsideRoot(
  rootPath: string,
  relativePath: string,
): string {
  assertSafeRelativePath(relativePath);

  const root = path.resolve(rootPath);
  const candidate = path.resolve(root, relativePath);

  if (!isStrictlyInsidePath(root, candidate)) {
    throw new PathSafetyError(
      "outside_root",
      "That path is outside the approved folder.",
    );
  }

  return candidate;
}

/**
 * Validate an existing path and ensure its real target is still inside the root.
 * This blocks symbolic-link escapes for any future file operation.
 */
export async function resolveExistingPathInsideRoot(
  rootPath: string,
  relativePath: string,
): Promise<string> {
  const candidate = resolveInsideRoot(rootPath, relativePath);

  let canonicalRoot: string;
  let canonicalCandidate: string;

  try {
    canonicalRoot = await fs.realpath(rootPath);
    canonicalCandidate = await fs.realpath(candidate);
  } catch (error) {
    throw pathErrorFromFs(
      error,
      "not_found",
      "That file or folder could not be found.",
    );
  }

  if (!isStrictlyInsidePath(canonicalRoot, canonicalCandidate)) {
    throw new PathSafetyError(
      "unsafe_symlink",
      "That path resolves outside the approved folder through a symbolic link.",
    );
  }

  return canonicalCandidate;
}

export function assertSafeRelativePath(relativePath: string): void {
  if (typeof relativePath !== "string" || relativePath.trim() === "") {
    throw new PathSafetyError("outside_root", "A relative path is required.");
  }
  if (relativePath.length > MAX_PATH_LENGTH) {
    throw new PathSafetyError("outside_root", "That path is too long.");
  }
  if (relativePath.includes("\0")) {
    throw new PathSafetyError(
      "outside_root",
      "That path contains an invalid character.",
    );
  }
  if (
    relativePath.startsWith("/") ||
    relativePath.startsWith("\\") ||
    path.isAbsolute(relativePath) ||
    /^[a-zA-Z]:/.test(relativePath)
  ) {
    throw new PathSafetyError(
      "outside_root",
      "That path must be relative to the approved folder.",
    );
  }

  const segments = relativePath.split(/[\\/]/);
  if (
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    throw new PathSafetyError(
      "outside_root",
      "That path contains an unsafe segment.",
    );
  }
}
