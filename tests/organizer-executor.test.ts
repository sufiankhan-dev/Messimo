import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type TestContext,
} from "vitest";
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { applyApprovedOperations } from "@/lib/organizer/executor";
import { executeMove } from "@/lib/organizer/file-operations";
import {
  getStoredOperation,
  toPublicOperationRecord,
} from "@/lib/history/store";
import { undoOperation } from "@/lib/history/undo";
import { applyOperationsRequestSchema } from "@/lib/validation/operations";

let root: string;
let historyDir: string;
let previousHistoryDir: string | undefined;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "messimo-ops-"));
  historyDir = await fs.mkdtemp(path.join(os.tmpdir(), "messimo-history-"));
  previousHistoryDir = process.env.SLOTHSORT_HISTORY_DIR;
  process.env.SLOTHSORT_HISTORY_DIR = historyDir;
});

afterEach(async () => {
  if (previousHistoryDir === undefined) {
    delete process.env.SLOTHSORT_HISTORY_DIR;
  } else {
    process.env.SLOTHSORT_HISTORY_DIR = previousHistoryDir;
  }
  await fs.rm(root, { recursive: true, force: true });
  await fs.rm(historyDir, { recursive: true, force: true });
});

async function write(relativePath: string, contents: string): Promise<void> {
  const target = path.join(root, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, contents);
}

async function read(relativePath: string): Promise<string> {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

async function exists(relativePath: string): Promise<boolean> {
  try {
    await fs.lstat(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

function sha256(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

async function apply(
  operations: Array<{
    source: string;
    target: string;
    expectedSha256?: string;
    expectedSizeBytes?: number;
    expectedModifiedAt?: string;
  }>,
  signal?: AbortSignal,
) {
  return applyApprovedOperations({
    rootPath: root,
    folderName: "Downloads",
    operations: operations.map((operation) => ({
      sourceRelativePath: operation.source,
      targetRelativePath: operation.target,
      expectedSizeBytes: operation.expectedSizeBytes,
      expectedModifiedAt: operation.expectedModifiedAt,
      expectedSha256: operation.expectedSha256,
    })),
    signal,
  });
}

async function tryJunction(linkPath: string, target: string): Promise<boolean> {
  try {
    await fs.symlink(
      target,
      linkPath,
      process.platform === "win32" ? "junction" : "dir",
    );
    return true;
  } catch {
    return false;
  }
}

describe("approved batch execution", () => {
  it("moves and renames a file, creates approved folders, and records history", async () => {
    await write("invoice.txt", "invoice bytes");

    const result = await apply([
      { source: "invoice.txt", target: "Finance/Invoices/2026-invoice.txt" },
    ]);

    expect(result.completed).toBe(1);
    expect(result.failed).toBe(0);
    expect(await read("Finance/Invoices/2026-invoice.txt")).toBe(
      "invoice bytes",
    );
    expect(await exists("invoice.txt")).toBe(false);

    const record = await getStoredOperation(result.operationId ?? "");
    expect(record).not.toBeNull();
    expect(record?.status).toBe("completed");
    expect(record?.items[0]).toMatchObject({
      status: "completed",
      fromRelativePath: "invoice.txt",
      toRelativePath: "Finance/Invoices/2026-invoice.txt",
      sha256: sha256("invoice bytes"),
    });

    const historyFile = path.join(historyDir, "history.json");
    expect(JSON.parse(await fs.readFile(historyFile, "utf8")).records).toHaveLength(
      1,
    );
  });

  it("never overwrites an existing destination", async () => {
    await write("report.txt", "new contents");
    await write("Documents/report.txt", "keep these bytes");

    const result = await apply([
      { source: "report.txt", target: "Documents/report.txt" },
    ]);

    expect(result.completed).toBe(0);
    expect(result.failed).toBe(1);
    expect(await read("Documents/report.txt")).toBe("keep these bytes");
    expect(await read("report.txt")).toBe("new contents");
    expect(result.items[0].error).toContain("never overwrites");
  });

  it("rejects path traversal and absolute destinations", async () => {
    await write("notes.txt", "notes");
    const outside = path.join(root, "..", "messimo-escape.txt");

    const result = await apply([
      { source: "notes.txt", target: "../messimo-escape.txt" },
      {
        source: "notes.txt",
        target:
          process.platform === "win32"
            ? "C:\\Windows\\Temp\\messimo.txt"
            : "/tmp/messimo.txt",
      },
    ]);

    expect(result.completed).toBe(0);
    expect(result.failed).toBe(2);
    expect(await exists("notes.txt")).toBe(true);
    expect(await fs.stat(outside).catch(() => null)).toBeNull();
  });

  it("rejects a destination outside the approved organization folders", async () => {
    await write("notes.txt", "notes");

    const result = await apply([
      { source: "notes.txt", target: "Secret/notes.txt" },
    ]);

    expect(result.completed).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.items[0].error).toContain("approved organization folders");
    expect(await exists("notes.txt")).toBe(true);
    expect(await exists("Secret")).toBe(false);
  });

  it("rejects a destination folder that is a symbolic link (junction)", async (context) => {
    const outside = await fs.mkdtemp(
      path.join(os.tmpdir(), "messimo-outside-"),
    );
    const linked = await tryJunction(path.join(root, "Work"), outside);

    if (!linked) {
      await fs.rm(outside, { recursive: true, force: true });
      context.skip();
      return;
    }

    try {
      await write("notes.txt", "notes");

      const result = await apply([
        { source: "notes.txt", target: "Work/notes.txt" },
      ]);

      expect(result.completed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.items[0].error).toMatch(/symbolic link|link/i);
      expect(await exists("notes.txt")).toBe(true);
      expect(await fs.readdir(outside)).toEqual([]);
    } finally {
      await fs.rm(path.join(root, "Work"), { recursive: true, force: true });
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it("rejects a source that was replaced by a symbolic link", async (context) => {
    const outside = await fs.mkdtemp(
      path.join(os.tmpdir(), "messimo-outside-"),
    );
    await fs.writeFile(path.join(outside, "secret.txt"), "secret");
    let linked = true;

    try {
      await fs.symlink(
        path.join(outside, "secret.txt"),
        path.join(root, "link.txt"),
        "file",
      );
    } catch {
      linked = false;
    }

    if (!linked) {
      await fs.rm(outside, { recursive: true, force: true });
      context.skip();
      return;
    }

    try {
      const result = await apply([
        { source: "link.txt", target: "Documents/link.txt" },
      ]);

      expect(result.completed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.items[0].error).toMatch(/symbolic link/i);
      expect(await exists("Documents/link.txt")).toBe(false);
      expect(await fs.readFile(path.join(outside, "secret.txt"), "utf8")).toBe(
        "secret",
      );
    } finally {
      await fs.rm(path.join(root, "link.txt"), { force: true });
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it("rejects a file whose contents changed after the preview", async () => {
    // The preview saw "original bytes"; on disk it now holds something else.
    await write("changed.txt", "different bytes");

    const result = await apply([
      {
        source: "changed.txt",
        target: "Documents/changed.txt",
        expectedSha256: sha256("original bytes"),
      },
    ]);

    expect(result.completed).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.items[0].error).toMatch(/changed/i);
    expect(await read("changed.txt")).toBe("different bytes");
    expect(await exists("Documents/changed.txt")).toBe(false);
  });

  it("fails both operations that target the same destination", async () => {
    await write("one.txt", "one");
    await write("two.txt", "two");

    const result = await apply([
      { source: "one.txt", target: "Documents/same.txt" },
      { source: "two.txt", target: "Documents/same.txt" },
    ]);

    expect(result.completed).toBe(0);
    expect(result.failed).toBe(2);
    expect(await exists("one.txt")).toBe(true);
    expect(await exists("two.txt")).toBe(true);
    expect(await exists("Documents/same.txt")).toBe(false);
  });

  it("reports partial failures per operation and records both outcomes", async () => {
    await write("good.txt", "good");
    await write("blocked.txt", "blocked");
    await write("Work/blocked.txt", "already here");

    const result = await apply([
      { source: "good.txt", target: "Documents/good.txt" },
      { source: "blocked.txt", target: "Work/blocked.txt" },
    ]);

    expect(result.completed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.items.map((item) => item.status)).toEqual([
      "completed",
      "failed",
    ]);
    expect(await read("Documents/good.txt")).toBe("good");
    expect(await read("Work/blocked.txt")).toBe("already here");
    expect(await read("blocked.txt")).toBe("blocked");

    const record = await getStoredOperation(result.operationId ?? "");
    expect(record?.status).toBe("partial");
    expect(record?.note).toContain("failed");
    expect(toPublicOperationRecord(record!).undoable).toBe(true);
  });

  it("does not touch files that were not part of the approved batch", async () => {
    await write("approved.txt", "approved");
    await write("untouched.txt", "untouched");

    const result = await apply([
      { source: "approved.txt", target: "Documents/approved.txt" },
    ]);

    expect(result.completed).toBe(1);
    expect(await read("untouched.txt")).toBe("untouched");
    expect(await exists("Documents/untouched.txt")).toBe(false);
  });

  it("refuses to run an empty batch", async () => {
    await write("notes.txt", "notes");

    await expect(
      applyApprovedOperations({
        rootPath: root,
        folderName: "Downloads",
        operations: [],
      }),
    ).rejects.toMatchObject({ code: "invalid_request" });

    expect(await read("notes.txt")).toBe("notes");
  });

  it("stops before moving anything when the request is already cancelled", async () => {
    await write("notes.txt", "notes");
    const controller = new AbortController();
    controller.abort();

    const result = await apply(
      [{ source: "notes.txt", target: "Documents/notes.txt" }],
      controller.signal,
    );

    expect(result.completed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(1);
    expect(await read("notes.txt")).toBe("notes");
    expect(await exists("Documents/notes.txt")).toBe(false);
  });

  it("reports a permission failure without losing the source", async (context) => {
    if (process.platform === "win32") {
      // Windows ACLs do not follow POSIX chmod bits, so the permission drop
      // cannot be simulated reliably in this test environment.
      context.skip();
      return;
    }

    await write("notes.txt", "notes");
    await fs.mkdir(path.join(root, "Documents"));

    try {
      await fs.chmod(path.join(root, "Documents"), 0o555);
    } catch {
      context.skip();
      return;
    }

    try {
      const result = await apply([
        { source: "notes.txt", target: "Documents/notes.txt" },
      ]);

      expect(result.completed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.items[0].error).toMatch(/permission/i);
      expect(await read("notes.txt")).toBe("notes");
    } finally {
      await fs.chmod(path.join(root, "Documents"), 0o755);
    }
  });
});

describe("undo safety", () => {
  it("restores an approved move when the original state is unchanged", async () => {
    await write("invoice.txt", "invoice bytes");
    const result = await apply([
      { source: "invoice.txt", target: "Finance/Invoices/2026-invoice.txt" },
    ]);

    const undo = await undoOperation(result.operationId!);

    expect(undo.status).toBe("undone");
    expect(undo.restored).toBe(1);
    expect(await read("invoice.txt")).toBe("invoice bytes");
    expect(await exists("Finance/Invoices/2026-invoice.txt")).toBe(false);

    const record = await getStoredOperation(result.operationId!);
    expect(record?.status).toBe("undone");
    expect(record?.undo.status).toBe("undone");
    expect(toPublicOperationRecord(record!).undoable).toBe(false);
  });

  it("refuses undo after the moved file was edited", async () => {
    await write("invoice.txt", "invoice bytes");
    const result = await apply([
      { source: "invoice.txt", target: "Finance/Invoices/2026-invoice.txt" },
    ]);
    await write("Finance/Invoices/2026-invoice.txt", "newer edited bytes");

    const undo = await undoOperation(result.operationId!);

    expect(undo.status).toBe("refused");
    expect(undo.message).toMatch(/changed|verify/i);
    expect(await read("Finance/Invoices/2026-invoice.txt")).toBe(
      "newer edited bytes",
    );
    expect(await exists("invoice.txt")).toBe(false);
  });

  it("refuses undo when an original path is occupied by newer data", async () => {
    await write("invoice.txt", "invoice bytes");
    const result = await apply([
      { source: "invoice.txt", target: "Finance/Invoices/2026-invoice.txt" },
    ]);
    await write("invoice.txt", "a brand new file");

    const undo = await undoOperation(result.operationId!);

    expect(undo.status).toBe("refused");
    expect(await read("invoice.txt")).toBe("a brand new file");
    expect(await read("Finance/Invoices/2026-invoice.txt")).toBe(
      "invoice bytes",
    );
  });

  it("refuses undo after the moved file was deleted", async () => {
    await write("invoice.txt", "invoice bytes");
    const result = await apply([
      { source: "invoice.txt", target: "Finance/Invoices/2026-invoice.txt" },
    ]);
    await fs.unlink(path.join(root, "Finance", "Invoices", "2026-invoice.txt"));

    const undo = await undoOperation(result.operationId!);

    expect(undo.status).toBe("refused");
    expect(await exists("invoice.txt")).toBe(false);
  });

  it("refuses a second undo of the same operation", async () => {
    await write("invoice.txt", "invoice bytes");
    const result = await apply([
      { source: "invoice.txt", target: "Finance/Invoices/2026-invoice.txt" },
    ]);

    expect((await undoOperation(result.operationId!)).status).toBe("undone");

    const second = await undoOperation(result.operationId!);
    expect(second.status).toBe("refused");
    expect(second.message).toContain("already been undone");
    expect(await read("invoice.txt")).toBe("invoice bytes");
  });
});

describe("cancellation after the destination was created", () => {
  it("removes the new name and keeps the original file", async (context: TestContext) => {
    await write("invoice.txt", "invoice bytes");

    const sourcePath = path.join(root, "invoice.txt");
    const probePath = path.join(root, "link-probe.txt");
    try {
      await fs.link(sourcePath, probePath);
      await fs.unlink(probePath);
    } catch {
      context.skip();
      return;
    }

    const controller = new AbortController();
    const realLink = fs.link.bind(fs);
    const linkSpy = vi
      .spyOn(fs, "link")
      .mockImplementation(async (existingPath, newPath) => {
        await realLink(existingPath, newPath);
        // Abort exactly after the destination name exists, but before the
        // source is removed. This is the narrow window a user cancellation can
        // land in.
        controller.abort();
      });

    try {
      await expect(
        executeMove({
          rootPath: root,
          sourceRelativePath: "invoice.txt",
          targetRelativePath: "Finance/2026-invoice.txt",
          requireApprovedDestination: true,
          signal: controller.signal,
        }),
      ).rejects.toMatchObject({ code: "cancelled" });
    } finally {
      linkSpy.mockRestore();
    }

    expect(await exists("invoice.txt")).toBe(true);
    expect(await exists("Finance/2026-invoice.txt")).toBe(false);
    expect(await read("invoice.txt")).toBe("invoice bytes");
  });
});

describe("apply request confirmation", () => {
  it("requires an explicit confirmed flag", () => {
    const base = {
      folderId: "00000000-0000-4000-8000-000000000000",
      operations: [
        {
          sourceRelativePath: "a.txt",
          targetRelativePath: "Documents/a.txt",
        },
      ],
    };

    expect(applyOperationsRequestSchema.safeParse(base).success).toBe(false);
    expect(
      applyOperationsRequestSchema.safeParse({ ...base, confirmed: false })
        .success,
    ).toBe(false);
    expect(
      applyOperationsRequestSchema.safeParse({ ...base, confirmed: true })
        .success,
    ).toBe(true);
  });
});
