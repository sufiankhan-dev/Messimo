import { describe, expect, it } from "vitest";
import { DEMO_OPERATIONS } from "@/lib/mock/demo-workspace";
import {
  isNoChangeResult,
  OPERATION_STATUS_LABELS,
  operationStatusFromCounts,
  summarizeOperations,
} from "@/lib/workspace/history";
import type { OperationRecord, OperationStatus } from "@/types";

function makeRecord(
  status: OperationStatus,
  overrides: Partial<OperationRecord> = {},
): OperationRecord {
  return {
    id: `operation-${status}`,
    kind: "move",
    summary: "Test batch",
    folderName: "Downloads",
    appliedAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:05.000Z",
    status,
    itemCount: 1,
    items: [{ from: "a.txt", to: "Work/a.txt", status: "completed" }],
    changedCount: 1,
    failedCount: 0,
    skippedCount: 0,
    attemptedCount: 1,
    interrupted: false,
    note: "Test record.",
    undoable: false,
    undoAttemptedAt: null,
    ...overrides,
  };
}

describe("summarizeOperations", () => {
  const summary = summarizeOperations(DEMO_OPERATIONS);

  it("counts every status in the demo history", () => {
    expect(summary.total).toBe(4);
    expect(summary.completed).toBe(1);
    expect(summary.partial).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.undone).toBe(1);
  });

  it("counts records that still offer undo", () => {
    expect(summary.undoable).toBe(1);
  });

  it("adds up touched files for completed and partial batches only", () => {
    expect(summary.itemsChanged).toBe(6 + 3);
  });

  it("returns zeros for an empty history", () => {
    expect(summarizeOperations([])).toEqual({
      total: 0,
      completed: 0,
      partial: 0,
      failed: 0,
      undone: 0,
      undoable: 0,
      itemsChanged: 0,
    });
  });

  it("ignores failed and undone batches when totalling changed files", () => {
    const result = summarizeOperations([
      makeRecord("failed", { itemCount: 5 }),
      makeRecord("undone", { itemCount: 7 }),
      makeRecord("completed", { itemCount: 2 }),
    ]);

    expect(result.itemsChanged).toBe(2);
  });

  it("counts undoable records regardless of status", () => {
    const result = summarizeOperations([
      makeRecord("completed", { undoable: true }),
      makeRecord("partial", { undoable: true }),
      makeRecord("failed", { undoable: false }),
    ]);

    expect(result.undoable).toBe(2);
  });
});

describe("OPERATION_STATUS_LABELS", () => {
  it("labels every operation status", () => {
    expect(OPERATION_STATUS_LABELS).toEqual({
      completed: "Completed",
      partial: "Partially completed",
      failed: "Failed",
      undone: "Undone",
    });
  });
});

describe("operationStatusFromCounts", () => {
  it("treats a batch with no failures as completed", () => {
    expect(operationStatusFromCounts(3, 0)).toBe("completed");
    expect(operationStatusFromCounts(0, 0)).toBe("completed");
  });

  it("treats a batch with successes and failures as partial", () => {
    expect(operationStatusFromCounts(2, 1)).toBe("partial");
  });

  it("treats a batch with failures and no successes as failed", () => {
    expect(operationStatusFromCounts(0, 2)).toBe("failed");
  });
});

describe("isNoChangeResult", () => {
  it("is true only when nothing succeeded and nothing failed", () => {
    expect(isNoChangeResult(0, 0)).toBe(true);
    expect(isNoChangeResult(1, 0)).toBe(false);
    expect(isNoChangeResult(0, 1)).toBe(false);
  });
});

