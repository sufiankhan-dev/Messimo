import {
  executeMove,
  FileOperationError,
  preflightMove,
} from "@/lib/organizer/file-operations";
import { approveRoot, PathSafetyError } from "@/lib/files/path-safety";
import type { UndoResult, UndoResultItem } from "@/lib/validation/operations";
import {
  getStoredOperation,
  HistoryError,
  saveStoredOperation,
  type StoredOperationItem,
  type StoredOperationRecord,
} from "./store";

/**
 * Safe undo for supported moves and renames.
 *
 * Undo is refused as a whole unless every changed file still matches the
 * identity recorded after the original operation and every original path is
 * free. Nothing is overwritten, and a changed file is never moved back.
 */

export class UndoRefusedError extends Error {
  readonly code: "operation_not_found" | "undo_refused";

  constructor(code: "operation_not_found" | "undo_refused", message: string) {
    super(message);
    this.name = "UndoRefusedError";
    this.code = code;
  }
}

function failureItem(
  item: StoredOperationItem,
  error: string,
): UndoResultItem {
  return {
    relativePath: item.toRelativePath,
    targetRelativePath: item.fromRelativePath,
    status: "failed",
    error,
  };
}

function refuseReason(error: unknown): string {
  if (error instanceof FileOperationError) return error.message;
  if (error instanceof PathSafetyError) return error.message;
  return "The original file state could not be verified, so undo was refused.";
}

function itemIdentity(item: StoredOperationItem): {
  sizeBytes?: number;
  modifiedAt?: string;
  sha256?: string;
} {
  return {
    sizeBytes: item.sizeBytes ?? undefined,
    modifiedAt: item.modifiedAt ?? undefined,
    sha256: item.sha256 ?? undefined,
  };
}

async function markUndoUnavailable(
  record: StoredOperationRecord,
  reason: string,
): Promise<void> {
  record.undo = {
    status: "unavailable",
    reason,
    attemptedAt: new Date().toISOString(),
  };
  record.updatedAt = new Date().toISOString();
  try {
    await saveStoredOperation(record);
  } catch {
    // The refusal is still returned to the user. History keeps its previous
    // record rather than losing it.
  }
}

export async function undoOperation(
  operationId: string,
): Promise<UndoResult> {
  const record = await getStoredOperation(operationId);

  if (!record) {
    throw new UndoRefusedError(
      "operation_not_found",
      "That operation is not in the local history.",
    );
  }

  const changed = record.items.filter((item) => item.status === "completed");

  if (record.lifecycle === "executing") {
    const message =
      "The original batch was interrupted before it finished. Its state is uncertain, so undo was refused.";
    await markUndoUnavailable(record, message);
    return {
      operationId,
      status: "refused",
      restored: 0,
      failed: changed.length,
      skipped: 0,
      items: changed.map((item) => failureItem(item, message)),
      message,
    };
  }

  if (record.undo.status === "undone" || record.status === "undone") {
    return {
      operationId,
      status: "refused",
      restored: 0,
      failed: changed.length,
      skipped: 0,
      items: changed.map((item) =>
        failureItem(item, "This operation has already been undone."),
      ),
      message: "This operation has already been undone.",
    };
  }

  if (record.undo.status !== "available") {
    const message =
      record.undo.reason ?? "Undo is not available for this operation.";
    return {
      operationId,
      status: "refused",
      restored: 0,
      failed: changed.length,
      skipped: 0,
      items: changed.map((item) => failureItem(item, message)),
      message,
    };
  }

  if (changed.length === 0) {
    const message = "No file was actually changed, so there is nothing to undo.";
    await markUndoUnavailable(record, message);
    return {
      operationId,
      status: "refused",
      restored: 0,
      failed: 0,
      skipped: 0,
      items: [],
      message,
    };
  }

  let canonicalRoot: string;
  try {
    canonicalRoot = await approveRoot(record.rootPath);
  } catch (error) {
    const message = `The approved folder is no longer safe to use: ${refuseReason(
      error,
    )} Undo was refused.`;
    await markUndoUnavailable(record, message);
    return {
      operationId,
      status: "refused",
      restored: 0,
      failed: changed.length,
      skipped: 0,
      items: changed.map((item) => failureItem(item, message)),
      message,
    };
  }

  // Preflight every reverse move before anything is changed. One changed file,
  // one occupied original path, or one link refuses the whole undo.
  const preflightErrors = new Map<string, string>();
  const ordered = [...changed].reverse();

  for (const item of ordered) {
    if (
      item.sizeBytes === null ||
      item.modifiedAt === null ||
      item.sha256 === null
    ) {
      preflightErrors.set(
        item.id,
        "The original file identity was not fully recorded, so undo cannot be verified.",
      );
      continue;
    }

    try {
      await preflightMove({
        rootPath: canonicalRoot,
        sourceRelativePath: item.toRelativePath,
        targetRelativePath: item.fromRelativePath,
        requireApprovedDestination: false,
        expected: itemIdentity(item),
      });
    } catch (error) {
      preflightErrors.set(item.id, refuseReason(error));
    }
  }

  if (preflightErrors.size > 0) {
    const firstReason = preflightErrors.values().next().value;
    const message = `Undo was not applied because the original state changed: ${
      firstReason ?? "the files could not be verified."
    } Existing files were preserved.`;
    await markUndoUnavailable(record, message);

    return {
      operationId,
      status: "refused",
      restored: 0,
      failed: changed.length,
      skipped: 0,
      items: changed.map((item) =>
        failureItem(
          item,
          preflightErrors.get(item.id) ??
            "Undo was refused so newer data would not be overwritten.",
        ),
      ),
      message,
    };
  }

  record.undo = {
    status: "in-progress",
    reason: null,
    attemptedAt: new Date().toISOString(),
  };
  record.updatedAt = new Date().toISOString();

  try {
    await saveStoredOperation(record);
  } catch {
    throw new HistoryError(
      "history_unavailable",
      "Undo could not be recorded safely, so no file was changed. Check the history folder and try again.",
    );
  }

  const results: UndoResultItem[] = [];
  let fatal: string | null = null;

  for (const item of ordered) {
    if (fatal) {
      results.push({
        relativePath: item.toRelativePath,
        targetRelativePath: item.fromRelativePath,
        status: "skipped",
        error: fatal,
      });
      continue;
    }

    try {
      await executeMove({
        rootPath: canonicalRoot,
        sourceRelativePath: item.toRelativePath,
        targetRelativePath: item.fromRelativePath,
        requireApprovedDestination: false,
        expected: itemIdentity(item),
      });

      results.push({
        relativePath: item.toRelativePath,
        targetRelativePath: item.fromRelativePath,
        status: "restored",
        error: null,
      });
    } catch (error) {
      const message = refuseReason(error);
      results.push(failureItem(item, message));

      if (
        error instanceof FileOperationError &&
        (error.code === "root_unavailable" || error.code === "outside_root")
      ) {
        fatal =
          "Undo stopped because the approved folder changed or became unavailable.";
      }
    }
  }

  const restored = results.filter((item) => item.status === "restored").length;
  const failed = results.filter((item) => item.status === "failed").length;
  const skipped = results.filter((item) => item.status === "skipped").length;
  const timestamp = new Date().toISOString();

  record.updatedAt = timestamp;

  if (restored === changed.length) {
    record.status = "undone";
    record.undo = {
      status: "undone",
      reason: null,
      attemptedAt: timestamp,
    };
    record.note = `Undone on ${timestamp}. ${restored} file${
      restored === 1 ? "" : "s"
    } were restored to their previous names and locations.`;
  } else {
    record.status = restored > 0 ? "partial" : record.status;
    record.undo = {
      status: restored > 0 ? "partial" : "failed",
      reason:
        failed > 0
          ? "Undo did not finish. Review the files before trying again."
          : "Undo was interrupted before it finished.",
      attemptedAt: timestamp,
    };
    record.note = `Undo restored ${restored} of ${changed.length} files. ${failed} failed and ${skipped} were skipped.`;
  }

  try {
    await saveStoredOperation(record);
  } catch {
    // The result still reports exactly what happened. The record may show the
    // in-progress marker, which intentionally disables a second undo.
  }

  return {
    operationId,
    status:
      restored === changed.length
        ? "undone"
        : restored > 0
          ? "partial"
          : "failed",
    restored,
    failed,
    skipped,
    items: results,
    message:
      restored === changed.length
        ? `Restored ${restored} file${restored === 1 ? "" : "s"} to their previous names and locations.`
        : `Undo restored ${restored} of ${changed.length} files. ${failed} failed and ${skipped} were skipped. No existing file was overwritten.`,
  };
}
