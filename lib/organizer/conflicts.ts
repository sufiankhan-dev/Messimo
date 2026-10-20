import { promises as fs } from "node:fs";
import path from "node:path";
import {
  isStrictlyInsidePath,
  resolveInsideRoot,
} from "@/lib/files/path-safety";

export type DestinationState = "clear" | "exists" | "blocked" | "unreadable";

export interface DestinationCheck {
  /** Canonical-ish relative path using forward slashes. */
  relativePath: string;
  state: DestinationState;
  reason: string | null;
}

function errorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
}

/**
 * Inspect a proposed destination without creating, renaming, or deleting
 * anything. Existing folders are allowed; an existing file, a symbolic link, a
 * path that escapes the approved root, or an unreadable ancestor blocks the
 * destination so it is never silently overwritten.
 */
export async function checkDestination(
  rootPath: string,
  relativeDestination: string,
): Promise<DestinationCheck> {
  const normalized = relativeDestination.replace(/\\/g, "/");

  try {
    resolveInsideRoot(rootPath, normalized);
  } catch {
    return {
      relativePath: normalized,
      state: "blocked",
      reason: "The destination is outside the approved folder.",
    };
  }

  let canonicalRoot: string;
  try {
    canonicalRoot = await fs.realpath(rootPath);
  } catch {
    return {
      relativePath: normalized,
      state: "unreadable",
      reason: "The approved folder is no longer available.",
    };
  }

  const segments = normalized.split("/");
  let current = canonicalRoot;

  for (const segment of segments.slice(0, -1)) {
    current = path.join(current, segment);

    try {
      const stats = await fs.lstat(current);

      if (stats.isSymbolicLink()) {
        return {
          relativePath: normalized,
          state: "blocked",
          reason:
            "A symbolic link is in the destination path. SlothSort will not follow it.",
        };
      }
      if (!stats.isDirectory()) {
        return {
          relativePath: normalized,
          state: "blocked",
          reason: `A file named "${segment}" blocks this destination folder.`,
        };
      }
    } catch (error) {
      if (errorCode(error) === "ENOENT") break;
      return {
        relativePath: normalized,
        state: "unreadable",
        reason:
          "A folder in the destination path could not be inspected. Check its permissions.",
      };
    }
  }

  const target = path.join(canonicalRoot, ...segments);

  // `path.join` above is safe because resolveInsideRoot already rejected
  // absolute paths and traversal segments. This assertion documents the bound.
  if (!isStrictlyInsidePath(canonicalRoot, target)) {
    return {
      relativePath: normalized,
      state: "blocked",
      reason: "The destination is outside the approved folder.",
    };
  }

  try {
    const stats = await fs.lstat(target);

    if (stats.isSymbolicLink()) {
      return {
        relativePath: normalized,
        state: "blocked",
        reason:
          "A symbolic link already exists at this destination. SlothSort will not follow it.",
      };
    }
    if (stats.isDirectory()) {
      return {
        relativePath: normalized,
        state: "blocked",
        reason: "A folder already exists where this file would go.",
      };
    }

    return {
      relativePath: normalized,
      state: "exists",
      reason:
        "A file already exists at this destination. It will never be overwritten.",
    };
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      return { relativePath: normalized, state: "clear", reason: null };
    }

    return {
      relativePath: normalized,
      state: "unreadable",
      reason:
        "The destination could not be inspected. Check its permissions before applying changes.",
    };
  }
}

export function destinationKey(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").toLowerCase();
}

/** A stable helper for tests and messages. */
export function pathSegments(relativePath: string): string[] {
  return relativePath.split(/[\\/]/).filter(Boolean);
}
