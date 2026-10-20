import { randomUUID } from "node:crypto";
import path from "node:path";
import type { ApprovedFolder } from "@/types";
import { platformLabel } from "./platform";

interface ApprovedFolderRecord {
  folder: ApprovedFolder;
  /** Canonical absolute path. Never sent to the browser on its own. */
  rootPath: string;
  approvedAtMs: number;
}

const FOLDER_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_FOLDER_RECORDS = 32;

/**
 * In-memory, process-local approvals. The browser receives an opaque id and
 * scan requests can only reference that id, never an arbitrary path. Approvals
 * expire when the server restarts or after 12 hours.
 */
const folders = new Map<string, ApprovedFolderRecord>();

function pruneExpired(now: number): void {
  for (const [id, record] of folders) {
    if (now - record.approvedAtMs > FOLDER_TTL_MS) {
      folders.delete(id);
    }
  }
}

function trimToLimit(): void {
  while (folders.size > MAX_FOLDER_RECORDS) {
    const oldestId = folders.keys().next().value;
    if (oldestId === undefined) return;
    folders.delete(oldestId);
  }
}

export function rememberApprovedFolder(canonicalRoot: string): ApprovedFolder {
  const now = Date.now();
  pruneExpired(now);

  const folder: ApprovedFolder = {
    id: randomUUID(),
    name: path.basename(canonicalRoot) || canonicalRoot,
    displayPath: canonicalRoot,
    platform: platformLabel(),
    selectedAt: new Date(now).toISOString(),
  };

  folders.set(folder.id, {
    folder,
    rootPath: canonicalRoot,
    approvedAtMs: now,
  });
  trimToLimit();

  return folder;
}

export function getApprovedFolder(
  id: string,
): { folder: ApprovedFolder; rootPath: string } | null {
  const now = Date.now();
  pruneExpired(now);

  const record = folders.get(id);
  if (!record) return null;

  return { folder: record.folder, rootPath: record.rootPath };
}
