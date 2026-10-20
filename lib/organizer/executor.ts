import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  executeMove,
  FileOperationError,
  preflightMove,
  sameRelativePath,
  toForwardSlashes,
  type PreparedMove,
} from "./file-operations";
import {
  saveStoredOperation,
  type StoredOperationItem,
  type StoredOperationRecord,
} from "@/lib/history/store";
import type {
  ApplyProgress,
  ApplyResult,
  OperationResultItem,
  RequestedOperation,
} from "@/lib/validation/operations";
import type { OperationKind } from "@/types";

/**
 * Orchestrates an approved batch. Preflight happens for every operation before
 * the first file changes. Execution then revalidates each operation immediately
 * before acting, updates a local history record after every file, and reports
 * exactly what succeeded and what did not.
 */

export type ExecutionErrorCode =
  | "root_unavailable"
  | "history_unavailable"
  | "invalid_request";

export class OrganizationExecutionError extends Error {
  readonly code: ExecutionErrorCode;

  constructor(code: ExecutionErrorCode, message: string) {
    super(message);
    this.name = "OrganizationExecutionError";
    this.code = code;
  }
}

export interface ApplyApprovedOptions {
  rootPath: string;
  folderName: string;
  operations: RequestedOperation[];
  signal?: AbortSignal;
  onProgress?: (progress: ApplyProgress) => void | Promise<void>;
}

interface Candidate {
  request: RequestedOperation;
  source: string;
  target: string;
  item: StoredOperationItem;
  prepared: PreparedMove | null;
  executable: boolean;
}

function classifyKind(from: string, to: string): OperationKind {
  const fromParts = toForwardSlashes(from).split("/");
  const toParts = toForwardSlashes(to).split("/");
  const fromName = fromParts.at(-1) ?? "";
  const toName = toParts.at(-1) ?? "";
  const fromFolder = fromParts.slice(0, -1).join("/").toLowerCase();
  const toFolder = toParts.slice(0, -1).join("/").toLowerCase();
  const moved = fromFolder !== toFolder;
  const renamed = fromName !== toName;

  if (moved && renamed) return "mixed";
  if (moved) return "move";
  if (renamed) return "rename";
  return "mixed";
}

function batchKind(candidates: Candidate[]): OperationKind {
  const kinds = new Set(
    candidates.map((candidate) =>
      classifyKind(candidate.source, candidate.target),
    ),
  );

  if (kinds.size === 1) {
    const [only] = kinds;
    return only ?? "mixed";
  }
  return "mixed";
}

function safeDisplay(value: string): string {
  return value.trim().replace(/\\/g, "/");
}

function failCandidate(candidate: Candidate, message: string): void {
  candidate.executable = false;
  candidate.item.status = "failed";
  candidate.item.error = message;
  candidate.item.completedAt = null;
}

function skipCandidate(candidate: Candidate): void {
  candidate.executable = false;
  candidate.item.status = "skipped";
  candidate.item.error = null;
  candidate.item.completedAt = null;
}

function errorMessage(error: unknown): string {
  if (error instanceof FileOperationError) return error.message;
  return "The operation could not be completed. The source was left in place.";
}

function isFatalRootError(error: unknown): boolean {
  return (
    error instanceof FileOperationError &&
    (error.code === "root_unavailable" || error.code === "outside_root")
  );
}

function isCancellation(error: unknown): boolean {
  return error instanceof FileOperationError && error.code === "cancelled";
}

function progressSnapshot(
  candidates: Candidate[],
  processed: number,
  currentRelativePath: string,
): ApplyProgress {
  return {
    processed,
    total: candidates.length,
    currentRelativePath,
    completed: candidates.filter((candidate) => candidate.item.status === "completed")
      .length,
    failed: candidates.filter((candidate) => candidate.item.status === "failed")
      .length,
  };
}

async function emitProgress(
  options: ApplyApprovedOptions,
  progress: ApplyProgress,
): Promise<void> {
  try {
    await options.onProgress?.({ ...progress });
  } catch {
    // A disconnected UI must not stop an already-approved batch.
  }
}

function buildNote(
  completed: number,
  failed: number,
  skipped: number,
  total: number,
): string {
  const parts: string[] = [];

  if (completed > 0) {
    parts.push(`${completed} file${completed === 1 ? "" : "s"} moved or renamed`);
  } else {
    parts.push("No file was changed");
  }

  if (failed > 0) {
    parts.push(
      `${failed} operation${failed === 1 ? "" : "s"} failed and ${
        failed === 1 ? "was" : "were"
      } not applied`,
    );
  }
  if (skipped > 0) {
    parts.push(
      `${skipped} selected item${skipped === 1 ? "" : "s"} needed no change`,
    );
  }

  parts.push(
    `Existing files were never overwritten, and no file was deleted. ${total} selected in this batch.`,
  );

  return `${parts.join(". ")}.`;
}

export async function applyApprovedOperations(
  options: ApplyApprovedOptions,
): Promise<ApplyResult> {
  if (options.operations.length === 0) {
    throw new OrganizationExecutionError(
      "invalid_request",
      "Select at least one approved operation.",
    );
  }

  const now = new Date().toISOString();
  const operationId = randomUUID();
  const candidates: Candidate[] = options.operations.map((request) => {
    const source = safeDisplay(request.sourceRelativePath);
    const target = safeDisplay(request.targetRelativePath);

    return {
      request,
      source,
      target,
      prepared: null,
      executable: true,
      item: {
        id: randomUUID(),
        fromRelativePath: source,
        toRelativePath: target,
        status: "pending",
        method: null,
        error: null,
        sizeBytes: null,
        modifiedAt: null,
        sha256: null,
        ino: null,
        dev: null,
        completedAt: null,
      },
    };
  });

  const sourceGroups = new Map<string, Candidate[]>();
  const targetGroups = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const sourceKey = candidate.source.toLowerCase();
    const targetKey = candidate.target.toLowerCase();
    sourceGroups.set(sourceKey, [...(sourceGroups.get(sourceKey) ?? []), candidate]);
    targetGroups.set(targetKey, [...(targetGroups.get(targetKey) ?? []), candidate]);
  }

  for (const group of sourceGroups.values()) {
    if (group.length < 2) continue;
    for (const candidate of group) {
      failCandidate(
        candidate,
        "The same file was selected more than once. Review the batch so each file is moved once.",
      );
    }
  }

  for (const group of targetGroups.values()) {
    if (group.length < 2) continue;
    for (const candidate of group) {
      failCandidate(
        candidate,
        "Another selected operation targets this same destination. None of these will run until the collision is resolved.",
      );
    }
  }

  const sourceKeys = new Set(candidates.map((candidate) => candidate.source.toLowerCase()));
  for (const candidate of candidates) {
    if (!candidate.executable) continue;
    if (sourceKeys.has(candidate.target.toLowerCase())) {
      failCandidate(
        candidate,
        "This destination is also the source of another selected operation. Apply that operation separately so the order is explicit.",
      );
    }
  }

  for (const candidate of candidates) {
    if (!candidate.executable) continue;
    if (sameRelativePath(candidate.source, candidate.target)) {
      skipCandidate(candidate);
    }
  }

  // Validate every remaining operation before writing a history record or
  // changing anything. A failure here means no file has been touched.
  let preflightStopped = false;
  for (const candidate of candidates) {
    if (!candidate.executable) continue;

    if (options.signal?.aborted) {
      skipCandidate(candidate);
      preflightStopped = true;
      continue;
    }
    if (preflightStopped) {
      failCandidate(
        candidate,
        "The approved folder changed or became unavailable during validation. This operation was not attempted.",
      );
      continue;
    }

    try {
      candidate.prepared = await preflightMove({
        rootPath: options.rootPath,
        sourceRelativePath: candidate.source,
        targetRelativePath: candidate.target,
        requireApprovedDestination: true,
        expected: {
          sizeBytes: candidate.request.expectedSizeBytes,
          modifiedAt: candidate.request.expectedModifiedAt,
          sha256: candidate.request.expectedSha256,
        },
        signal: options.signal,
      });
      candidate.item.toRelativePath = candidate.prepared.targetRelativePath;
      candidate.target = candidate.prepared.targetRelativePath;
    } catch (error) {
      failCandidate(candidate, errorMessage(error));
      if (isFatalRootError(error)) preflightStopped = true;
    }
  }

  const record: StoredOperationRecord = {
    id: operationId,
    rootPath: options.rootPath,
    folderName: options.folderName || path.basename(options.rootPath),
    lifecycle: "executing",
    status: "partial",
    kind: batchKind(candidates),
    summary: `Organizing ${candidates.length} selected file${
      candidates.length === 1 ? "" : "s"
    } from ${options.folderName || path.basename(options.rootPath)}`,
    note: "In progress. The batch record is updated after each file.",
    appliedAt: now,
    updatedAt: now,
    items: candidates.map((candidate) => candidate.item),
    undo: {
      status: "unavailable",
      reason: "The batch is still running.",
      attemptedAt: null,
    },
  };

  try {
    await saveStoredOperation(record);
  } catch {
    throw new OrganizationExecutionError(
      "history_unavailable",
      "The local operation history could not be recorded, so no file was moved. Check that the history folder is writable and try again.",
    );
  }

  let processed = 0;
  let historyError: string | null = null;
  let stoppedMessage: string | null = null;
  await emitProgress(options, progressSnapshot(candidates, processed, ""));

  for (const candidate of candidates) {
    if (candidate.item.status !== "pending") {
      processed += 1;
      continue;
    }

    if (stoppedMessage) {
      failCandidate(candidate, stoppedMessage);
      processed += 1;
      await emitProgress(
        options,
        progressSnapshot(candidates, processed, candidate.source),
      );
      continue;
    }

    if (options.signal?.aborted) {
      skipCandidate(candidate);
      processed += 1;
      await emitProgress(
        options,
        progressSnapshot(candidates, processed, candidate.source),
      );
      continue;
    }

    try {
      const outcome = await executeMove({
        rootPath: options.rootPath,
        sourceRelativePath: candidate.source,
        targetRelativePath: candidate.target,
        requireApprovedDestination: true,
        expected: {
          sizeBytes: candidate.request.expectedSizeBytes,
          modifiedAt: candidate.request.expectedModifiedAt,
          sha256: candidate.request.expectedSha256,
        },
        signal: options.signal,
      });

      candidate.item.status = "completed";
      candidate.item.method = outcome.method;
      candidate.item.error = null;
      candidate.item.sizeBytes = outcome.identity.sizeBytes;
      candidate.item.modifiedAt = outcome.identity.modifiedAt;
      candidate.item.sha256 = outcome.identity.sha256;
      candidate.item.ino = outcome.identity.ino;
      candidate.item.dev = outcome.identity.dev;
      candidate.item.completedAt = new Date().toISOString();
    } catch (error) {
      if (isCancellation(error)) {
        skipCandidate(candidate);
      } else {
        failCandidate(candidate, errorMessage(error));
        if (isFatalRootError(error)) {
          stoppedMessage =
            "The batch stopped because the approved folder changed or became unavailable. Remaining operations were not attempted.";
        }
      }

      if (!(error instanceof FileOperationError)) {
        stoppedMessage =
          "The batch stopped after an unexpected error. Remaining operations were not attempted.";
      }
    }

    processed += 1;
    await emitProgress(
      options,
      progressSnapshot(candidates, processed, candidate.source),
    );

    record.updatedAt = new Date().toISOString();
    record.items = candidates.map((item) => item.item);
    try {
      await saveStoredOperation(record);
    } catch {
      historyError =
        "The local history could not be updated after an operation. Remaining operations were stopped to keep the batch recoverable.";
      stoppedMessage = historyError;
    }
  }

  record.items = candidates.map((candidate) => candidate.item);
  const completedCount = candidates.filter(
    (candidate) => candidate.item.status === "completed",
  ).length;
  const failedCount = candidates.filter(
    (candidate) => candidate.item.status === "failed",
  ).length;
  const skippedCount = candidates.filter(
    (candidate) => candidate.item.status === "skipped",
  ).length;

  const status =
    failedCount === 0 ? "completed" : completedCount > 0 ? "partial" : "failed";

  record.lifecycle = "finished";
  record.status =
    options.signal?.aborted && completedCount > 0 && failedCount === 0
      ? "partial"
      : status;
  record.kind = batchKind(candidates);
  record.summary =
    completedCount > 0
      ? `${
          status === "completed" ? "Organized" : "Partially organized"
        } ${completedCount} of ${candidates.length} selected file${
          candidates.length === 1 ? "" : "s"
        } from ${record.folderName}`
      : `No files were changed in ${record.folderName}`;
  record.note = buildNote(
    completedCount,
    failedCount,
    skippedCount,
    candidates.length,
  );
  record.updatedAt = new Date().toISOString();
  record.undo = historyError
    ? {
        status: "unavailable",
        reason: historyError,
        attemptedAt: null,
      }
    : completedCount > 0
      ? { status: "available", reason: null, attemptedAt: null }
      : {
          status: "unavailable",
          reason: "No file was changed, so there is nothing to undo.",
          attemptedAt: null,
        };

  try {
    await saveStoredOperation(record);
  } catch {
    historyError ??=
      "The final local history update could not be written. Check History before attempting another batch.";
  }

  const items: OperationResultItem[] = candidates
    .filter((candidate) => candidate.item.status !== "pending")
    .map((candidate) => ({
      sourceRelativePath: candidate.item.fromRelativePath,
      targetRelativePath: candidate.item.toRelativePath,
      status:
        candidate.item.status === "completed"
          ? "completed"
          : candidate.item.status === "skipped"
            ? "skipped"
            : "failed",
      method: candidate.item.method,
      error: candidate.item.error,
    }));

  return {
    operationId,
    total: candidates.length,
    completed: completedCount,
    failed: failedCount,
    skipped: skippedCount,
    items,
    historyRecorded: historyError === null,
    historyError,
    undoable: historyError === null && completedCount > 0,
    note: record.note,
  };
}
