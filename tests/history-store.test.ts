import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  HistoryError,
  listOperationRecords,
  listStoredOperations,
  saveStoredOperation,
  toPublicOperationRecord,
  type StoredOperationRecord,
} from "@/lib/history/store";

let historyDir: string;
let previousHistoryDir: string | undefined;

beforeEach(async () => {
  historyDir = await fs.mkdtemp(path.join(os.tmpdir(), "messimo-store-"));
  previousHistoryDir = process.env.SLOTHSORT_HISTORY_DIR;
  process.env.SLOTHSORT_HISTORY_DIR = historyDir;
});

afterEach(async () => {
  if (previousHistoryDir === undefined) {
    delete process.env.SLOTHSORT_HISTORY_DIR;
  } else {
    process.env.SLOTHSORT_HISTORY_DIR = previousHistoryDir;
  }
  await fs.rm(historyDir, { recursive: true, force: true });
});

function historyFile(): string {
  return path.join(historyDir, "history.json");
}

function makeRecord(
  overrides: Partial<StoredOperationRecord> = {},
): StoredOperationRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    // An absolute path is stored server-side only; the browser never sees it.
    rootPath: path.join(os.tmpdir(), "messimo-approved-root"),
    folderName: "Downloads",
    lifecycle: "finished",
    status: "completed",
    kind: "move",
    summary: "Organized 1 of 1 selected file from Downloads",
    note: "1 file moved or renamed.",
    appliedAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:05.000Z",
    items: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        fromRelativePath: "invoice.txt",
        toRelativePath: "Finance/invoice.txt",
        status: "completed",
        method: "link",
        error: null,
        sizeBytes: 13,
        modifiedAt: "2026-09-30T09:00:00.000Z",
        sha256: "a".repeat(64),
        ino: 42,
        dev: 7,
        completedAt: "2026-10-01T10:00:05.000Z",
      },
    ],
    undo: { status: "available", reason: null, attemptedAt: null },
    ...overrides,
  };
}

describe("local history persistence", () => {
  it("returns an empty list before the history file exists", async () => {
    expect(await listStoredOperations()).toEqual([]);
    expect(await listOperationRecords()).toEqual([]);
  });

  it("writes a record to disk and reads it back", async () => {
    await saveStoredOperation(makeRecord());

    const onDisk = JSON.parse(await fs.readFile(historyFile(), "utf8"));
    expect(onDisk.version).toBe(1);
    expect(onDisk.records).toHaveLength(1);

    const stored = await listStoredOperations();
    expect(stored).toHaveLength(1);
    expect(stored[0].items[0].toRelativePath).toBe("Finance/invoice.txt");
  });

  it("keeps absolute root paths out of the browser record", async () => {
    const record = makeRecord();
    await saveStoredOperation(record);

    const publicRecords = await listOperationRecords();
    const serialized = JSON.stringify(publicRecords);

    expect(publicRecords[0].items[0]).toMatchObject({
      from: "invoice.txt",
      to: "Finance/invoice.txt",
    });
    expect(serialized).not.toContain(record.rootPath);
    expect(serialized).not.toContain(record.rootPath.replace(/\\/g, "\\\\"));
  });

  it("replaces an existing record with the same id instead of duplicating it", async () => {
    await saveStoredOperation(makeRecord());
    await saveStoredOperation(
      makeRecord({
        status: "partial",
        note: "1 of 2 files changed.",
        updatedAt: "2026-10-01T10:05:00.000Z",
      }),
    );

    const stored = await listStoredOperations();
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe("partial");
  });

  it("sorts newest batches first", async () => {
    await saveStoredOperation(
      makeRecord({
        id: "11111111-1111-4111-8111-111111111111",
        appliedAt: "2026-10-01T10:00:00.000Z",
      }),
    );
    await saveStoredOperation(
      makeRecord({
        id: "33333333-3333-4333-8333-333333333333",
        appliedAt: "2026-10-02T10:00:00.000Z",
      }),
    );

    const stored = await listStoredOperations();
    expect(stored.map((record) => record.id)).toEqual([
      "33333333-3333-4333-8333-333333333333",
      "11111111-1111-4111-8111-111111111111",
    ]);
  });
});

describe("history file safety", () => {
  it("refuses to parse invalid JSON and leaves the file untouched", async () => {
    const corrupt = "{ not json";
    await fs.writeFile(historyFile(), corrupt, "utf8");

    await expect(listStoredOperations()).rejects.toMatchObject({
      code: "history_corrupt",
    });
    expect(await fs.readFile(historyFile(), "utf8")).toBe(corrupt);
  });

  it("ignores a UTF-8 byte-order mark left by a text editor", async () => {
    await saveStoredOperation(makeRecord());
    const contents = await fs.readFile(historyFile(), "utf8");
    await fs.writeFile(historyFile(), `\uFEFF${contents}`, "utf8");

    const stored = await listStoredOperations();
    expect(stored).toHaveLength(1);
    expect(stored[0].items[0].toRelativePath).toBe("Finance/invoice.txt");
  });

  it("refuses a file that does not match the record schema", async () => {
    await fs.writeFile(
      historyFile(),
      JSON.stringify({ version: 1, records: [{ id: "not-a-uuid" }] }),
      "utf8",
    );

    await expect(listStoredOperations()).rejects.toBeInstanceOf(HistoryError);
    await expect(
      saveStoredOperation(makeRecord()),
    ).rejects.toMatchObject({ code: "history_corrupt" });
  });

  it.runIf(process.platform === "win32")(
    "refuses a network share as the history folder",
    async () => {
      process.env.SLOTHSORT_HISTORY_DIR = "\\\\server\\share\\messimo";

      await expect(listStoredOperations()).rejects.toMatchObject({
        code: "history_unavailable",
      });
      await expect(
        saveStoredOperation(makeRecord()),
      ).rejects.toBeInstanceOf(HistoryError);
    },
  );

  it("rejects an invalid record before writing anything", async () => {
    await expect(
      saveStoredOperation(
        makeRecord({ status: "unknown" as StoredOperationRecord["status"] }),
      ),
    ).rejects.toBeInstanceOf(HistoryError);

    await expect(
      saveStoredOperation(
        makeRecord({
          items: [
            {
              ...makeRecord().items[0],
              // A digest is either a full SHA-256 or absent.
              sha256: "not-a-digest",
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(HistoryError);

    await expect(fs.stat(historyFile())).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("disables undo while a batch is still marked as executing", () => {
    const publicRecord = toPublicOperationRecord(
      makeRecord({ lifecycle: "executing", status: "partial" }),
    );

    expect(publicRecord.undoable).toBe(false);
    expect(publicRecord.status).toBe("partial");
    expect(publicRecord.interrupted).toBe(true);
    expect(publicRecord.updatedAt).toBe("2026-10-01T10:00:05.000Z");
    expect(publicRecord.note).toMatch(/did not finish cleanly/i);
    expect(publicRecord.undoUnavailableReason).toMatch(/interrupted/i);
  });

  it("keeps undo available for a partially completed batch", () => {
    const publicRecord = toPublicOperationRecord(makeRecord());

    expect(publicRecord.undoable).toBe(true);
    expect(publicRecord.interrupted).toBe(false);
    expect(publicRecord.undoUnavailableReason).toBeUndefined();
  });

  it("includes completed, failed, and skipped items but hides pending ones", () => {
    const publicRecord = toPublicOperationRecord(
      makeRecord({
        items: [
          makeRecord().items[0],
          {
            ...makeRecord().items[0],
            id: "44444444-4444-4444-8444-444444444444",
            fromRelativePath: "blocked.txt",
            toRelativePath: "Work/blocked.txt",
            status: "failed",
            error: "A file already exists at this destination.",
            sha256: null,
            sizeBytes: null,
            modifiedAt: null,
            completedAt: null,
          },
          {
            ...makeRecord().items[0],
            id: "55555555-5555-4555-8555-555555555555",
            fromRelativePath: "later.txt",
            toRelativePath: "Work/later.txt",
            status: "pending",
            sha256: null,
            sizeBytes: null,
            modifiedAt: null,
            completedAt: null,
          },
          {
            ...makeRecord().items[0],
            id: "66666666-6666-4666-8666-666666666666",
            fromRelativePath: "same-name.txt",
            toRelativePath: "Work/same-name.txt",
            status: "skipped",
            sha256: null,
            sizeBytes: null,
            modifiedAt: null,
            completedAt: null,
          },
        ],
      }),
    );

    expect(publicRecord.items.map((item) => item.status)).toEqual([
      "completed",
      "failed",
      "skipped",
    ]);
    expect(publicRecord.items[1].error).toContain("already exists");
    expect(publicRecord.itemCount).toBe(1);
    expect(publicRecord.changedCount).toBe(1);
    expect(publicRecord.failedCount).toBe(1);
    expect(publicRecord.skippedCount).toBe(1);
    expect(publicRecord.attemptedCount).toBe(3);
  });

  it("reports the last update time and any undo attempt", () => {
    const publicRecord = toPublicOperationRecord(
      makeRecord({
        folderName: "Invoices",
        updatedAt: "2026-10-01T10:07:30.000Z",
        undo: {
          status: "failed",
          reason: "A file was changed after the batch completed.",
          attemptedAt: "2026-10-01T11:00:00.000Z",
        },
      }),
    );

    expect(publicRecord.folderName).toBe("Invoices");
    expect(publicRecord.updatedAt).toBe("2026-10-01T10:07:30.000Z");
    expect(publicRecord.undoAttemptedAt).toBe("2026-10-01T11:00:00.000Z");
    expect(publicRecord.undoable).toBe(false);
    expect(publicRecord.undoUnavailableReason).toContain("changed after");
  });
});
