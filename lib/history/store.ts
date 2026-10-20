import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import type { MoveMethod } from "@/lib/organizer/file-operations";
import type {
  OperationItem,
  OperationKind,
  OperationRecord,
  OperationStatus,
} from "@/types";

/**
 * Local operation history.
 *
 * Records are stored in a single JSON file on this computer. Absolute root
 * paths are kept only in this server-side file so undo can revalidate them; the
 * browser receives relative paths only. Writes are atomic (temp file + rename)
 * and serialized inside the process, and no remote database is involved.
 */

const HISTORY_VERSION = 1;
const MAX_RECORDS = 200;

export type StoredItemStatus = "pending" | "completed" | "failed" | "skipped";
export type StoredUndoStatus =
  | "unavailable"
  | "available"
  | "in-progress"
  | "undone"
  | "partial"
  | "failed";

export interface StoredOperationItem {
  id: string;
  fromRelativePath: string;
  toRelativePath: string;
  status: StoredItemStatus;
  method: MoveMethod | null;
  error: string | null;
  sizeBytes: number | null;
  modifiedAt: string | null;
  sha256: string | null;
  ino: number | null;
  dev: number | null;
  completedAt: string | null;
}

export interface StoredOperationRecord {
  id: string;
  /** Canonical root at the time of the operation. Never sent to the browser. */
  rootPath: string;
  folderName: string;
  lifecycle: "executing" | "finished";
  status: Exclude<OperationStatus, "undone"> | "undone";
  kind: OperationKind;
  summary: string;
  note: string;
  appliedAt: string;
  updatedAt: string;
  items: StoredOperationItem[];
  undo: {
    status: StoredUndoStatus;
    reason: string | null;
    attemptedAt: string | null;
  };
}

const itemSchema = z.strictObject({
  id: z.string().min(1),
  fromRelativePath: z.string().min(1),
  toRelativePath: z.string().min(1),
  status: z.enum(["pending", "completed", "failed", "skipped"]),
  method: z.enum(["link", "copy"]).nullable(),
  error: z.string().min(1).nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  modifiedAt: z.iso.datetime().nullable(),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  ino: z.number().nonnegative().nullable(),
  dev: z.number().nonnegative().nullable(),
  completedAt: z.iso.datetime().nullable(),
});

const recordSchema = z.strictObject({
  id: z.uuid(),
  rootPath: z.string().min(1),
  folderName: z.string().min(1),
  lifecycle: z.enum(["executing", "finished"]),
  status: z.enum(["completed", "partial", "failed", "undone"]),
  kind: z.enum(["move", "rename", "mixed"]),
  summary: z.string().min(1),
  note: z.string(),
  appliedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  items: z.array(itemSchema),
  undo: z.strictObject({
    status: z.enum([
      "unavailable",
      "available",
      "in-progress",
      "undone",
      "partial",
      "failed",
    ]),
    reason: z.string().min(1).nullable(),
    attemptedAt: z.iso.datetime().nullable(),
  }),
});

const historyFileSchema = z.strictObject({
  version: z.literal(HISTORY_VERSION),
  records: z.array(recordSchema),
});

export type HistoryErrorCode =
  | "history_unavailable"
  | "history_corrupt"
  | "operation_not_found";

export class HistoryError extends Error {
  readonly code: HistoryErrorCode;

  constructor(code: HistoryErrorCode, message: string) {
    super(message);
    this.name = "HistoryError";
    this.code = code;
  }
}

function historyDirectory(): string {
  const configured = process.env.SLOTHSORT_HISTORY_DIR?.trim();
  if (configured) return path.resolve(configured);
  return path.join(os.homedir(), ".slothsort");
}

function historyFile(): string {
  return path.join(historyDirectory(), "history.json");
}

function unavailable(): HistoryError {
  return new HistoryError(
    "history_unavailable",
    "The local operation history could not be read or written. No files were changed.",
  );
}

async function readHistoryFile(): Promise<StoredOperationRecord[]> {
  let contents: string;
  try {
    contents = await fs.readFile(historyFile(), "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      return [];
    }
    throw unavailable();
  }

  let parsedJson: unknown;
  try {
    // A text editor may save the file with a UTF-8 byte-order mark. That is an
    // encoding artifact, not corruption, so it is ignored before parsing.
    parsedJson = JSON.parse(contents.replace(/^\uFEFF/, ""));
  } catch {
    throw new HistoryError(
      "history_corrupt",
      "The local operation history file is not valid JSON. It was left untouched so it can be inspected.",
    );
  }

  const parsed = historyFileSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new HistoryError(
      "history_corrupt",
      "The local operation history file does not match the expected format. It was left untouched.",
    );
  }

  return parsed.data.records;
}

async function writeHistoryFile(records: StoredOperationRecord[]): Promise<void> {
  const directory = historyDirectory();
  const target = historyFile();
  const temp = path.join(directory, `.history-${process.pid}-${randomUUID()}.tmp`);

  try {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.writeFile(
      temp,
      `${JSON.stringify({ version: HISTORY_VERSION, records }, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    await fs.rename(temp, target);
  } catch {
    await fs.rm(temp, { force: true }).catch(() => undefined);
    throw unavailable();
  }
}

let writeChain: Promise<unknown> = Promise.resolve();

/** Serialize writes so two batches cannot lose one another's records. */
function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
  const next = writeChain.then(task, task);
  writeChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export async function listStoredOperations(): Promise<StoredOperationRecord[]> {
  const records = await readHistoryFile();
  return [...records].sort((first, second) =>
    second.appliedAt.localeCompare(first.appliedAt),
  );
}

export async function getStoredOperation(
  id: string,
): Promise<StoredOperationRecord | null> {
  const records = await readHistoryFile();
  return records.find((record) => record.id === id) ?? null;
}

/**
 * Insert or replace one record. A record is written before the first file move
 * and updated after each operation, so an interrupted batch still leaves an
 * accurate, clearly incomplete record behind.
 */
export async function saveStoredOperation(
  record: StoredOperationRecord,
): Promise<void> {
  const validated = recordSchema.safeParse(record);
  if (!validated.success) {
    throw new HistoryError(
      "history_unavailable",
      "The operation record was not valid and could not be saved locally.",
    );
  }

  await enqueueWrite(async () => {
    const records = await readHistoryFile();
    const next = [validated.data, ...records.filter((item) => item.id !== record.id)]
      .sort((first, second) => second.appliedAt.localeCompare(first.appliedAt))
      .slice(0, MAX_RECORDS);

    await writeHistoryFile(next);
  });
}

function toPublicItem(item: StoredOperationItem): OperationItem {
  return {
    from: item.fromRelativePath,
    to: item.toRelativePath,
    status: item.status as OperationItem["status"],
    ...(item.error ? { error: item.error } : {}),
  };
}

function publicStatus(record: StoredOperationRecord): OperationStatus {
  if (record.lifecycle === "executing") return "partial";
  return record.status;
}

function undoReason(record: StoredOperationRecord): string | null {
  const completed = record.items.filter((item) => item.status === "completed");

  if (record.lifecycle === "executing") {
    return "The batch was interrupted before it finished. Its state is uncertain, so undo is disabled.";
  }
  if (record.status === "undone") {
    return "This operation has already been undone.";
  }
  if (record.undo.status === "unavailable") {
    return record.undo.reason ?? "Undo is not available for this operation.";
  }
  if (record.undo.status === "in-progress") {
    return "An undo is already in progress for this operation.";
  }
  if (record.undo.status === "undone") {
    return "This operation has already been undone.";
  }
  if (record.undo.status === "partial" || record.undo.status === "failed") {
    return (
      record.undo.reason ??
      "A previous undo attempt did not finish, so undo is disabled."
    );
  }
  if (completed.length === 0) {
    return "No file was actually changed, so there is nothing to undo.";
  }

  return null;
}

/** Shape a stored record for the browser. Absolute paths never cross this line. */
export function toPublicOperationRecord(
  record: StoredOperationRecord,
): OperationRecord {
  const completed = record.items.filter((item) => item.status === "completed");
  const reason = undoReason(record);

  return {
    id: record.id,
    kind: record.kind,
    summary: record.summary,
    appliedAt: record.appliedAt,
    status: publicStatus(record),
    itemCount: completed.length,
    items: record.items
      .filter((item) => item.status === "completed" || item.status === "failed")
      .map(toPublicItem),
    note:
      record.lifecycle === "executing"
        ? `${record.note} The batch did not finish cleanly; check the items below.`
        : record.note,
    undoable: reason === null && completed.length > 0,
    ...(reason ? { undoUnavailableReason: reason } : {}),
  };
}

export async function listOperationRecords(): Promise<OperationRecord[]> {
  return (await listStoredOperations()).map(toPublicOperationRecord);
}
