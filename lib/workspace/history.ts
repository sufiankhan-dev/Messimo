import type { OperationRecord, OperationStatus } from "@/types";

export interface OperationSummary {
  total: number;
  completed: number;
  partial: number;
  failed: number;
  undone: number;
  undoable: number;
  itemsChanged: number;
}

export function summarizeOperations(
  records: OperationRecord[],
): OperationSummary {
  const summary: OperationSummary = {
    total: records.length,
    completed: 0,
    partial: 0,
    failed: 0,
    undone: 0,
    undoable: 0,
    itemsChanged: 0,
  };

  for (const record of records) {
    summary[record.status] += 1;
    if (record.undoable) summary.undoable += 1;
    if (record.status === "completed" || record.status === "partial") {
      summary.itemsChanged += record.itemCount;
    }
  }

  return summary;
}

export const OPERATION_STATUS_LABELS: Record<OperationStatus, string> = {
  completed: "Completed",
  partial: "Partially completed",
  failed: "Failed",
  undone: "Undone",
};

/**
 * Derive a batch status from the per-file result counts. A batch with any
 * success and any failure is partial; a batch with failures and no success is
 * failed. This keeps the review result and history wording in sync.
 */
export function operationStatusFromCounts(
  completed: number,
  failed: number,
): OperationStatus {
  if (failed > 0) return completed > 0 ? "partial" : "failed";
  return "completed";
}

/** True when a result contains no successful move or rename. */
export function isNoChangeResult(completed: number, failed: number): boolean {
  return completed === 0 && failed === 0;
}
