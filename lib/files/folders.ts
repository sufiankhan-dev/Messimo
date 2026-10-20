import { promises as fs } from "node:fs";
import type { Dirent } from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  FolderBrowseResult,
  FolderShortcut,
} from "@/types";
import {
  PathSafetyError,
  inspectSelectablePath,
  resolveBrowsePath,
} from "./path-safety";
import { platformLabel } from "./platform";

const MAX_BROWSE_ENTRIES = 500;

function shortcutCandidates(): Array<{ label: string; path: string }> {
  let home: string | null = null;

  try {
    home = os.homedir() || null;
  } catch {
    home = null;
  }

  if (!home) return [];

  return [
    { label: "Home", path: home },
    { label: "Downloads", path: path.join(home, "Downloads") },
    { label: "Desktop", path: path.join(home, "Desktop") },
    { label: "Documents", path: path.join(home, "Documents") },
  ];
}

async function existingShortcuts(): Promise<FolderShortcut[]> {
  const candidates = shortcutCandidates();
  const checks = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const stats = await fs.stat(candidate.path);
        return stats.isDirectory() ? candidate : null;
      } catch {
        return null;
      }
    }),
  );

  return checks.filter((entry): entry is FolderShortcut => entry !== null);
}

/**
 * List one level of folders for the local picker. Only directories are
 * returned, symbolic links are not followed, and the list is capped.
 */
export async function browseFolders(
  rawPath?: string,
): Promise<FolderBrowseResult> {
  const currentPath = await resolveBrowsePath(rawPath);

  let entries: Dirent[];
  try {
    entries = await fs.readdir(currentPath, { withFileTypes: true });
  } catch (error) {
    throw readErrorFromFs(error);
  }

  const directories = entries
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => ({
      name: entry.name,
      path: path.join(currentPath, entry.name),
    }))
    .sort((first, second) =>
      first.name.localeCompare(second.name, undefined, {
        sensitivity: "base",
        numeric: true,
      }),
    );

  const verdict = inspectSelectablePath(currentPath);
  const shortcuts = await existingShortcuts();
  const parent = path.dirname(currentPath);

  return {
    currentPath,
    parentPath: parent === currentPath ? null : parent,
    directories: directories.slice(0, MAX_BROWSE_ENTRIES),
    shortcuts,
    platform: platformLabel(),
    selectable: verdict.allowed,
    selectionBlockedReason: verdict.reason,
    truncated: directories.length > MAX_BROWSE_ENTRIES,
    directoryCount: directories.length,
  };
}

function readErrorFromFs(error: unknown): PathSafetyError {
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

  return new PathSafetyError(
    "not_readable",
    "That folder could not be opened.",
  );
}
