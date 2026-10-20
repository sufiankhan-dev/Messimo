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
