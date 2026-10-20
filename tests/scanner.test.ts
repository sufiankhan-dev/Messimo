import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import type { Dirent, Stats } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import {
  ScanCancelledError,
  scanFolder,
  type ScannerFs,
} from "@/lib/files/scanner";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "slothsort-scan-"));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

function permissionDenied(): Error {
  return Object.assign(new Error("EACCES: permission denied"), {
    code: "EACCES",
  });
}

async function manifest(directory: string): Promise<string[]> {
  const entries: string[] = [];

  async function walk(current: string, relative: string): Promise<void> {
    const dirents = await fs.readdir(current, { withFileTypes: true });
    const sorted = [...dirents].sort((a, b) => a.name.localeCompare(b.name));

    for (const dirent of sorted) {
      const fullPath = path.join(current, dirent.name);
      const relativePath = relative ? `${relative}/${dirent.name}` : dirent.name;

      if (dirent.isDirectory()) {
        const stats = await fs.stat(fullPath);
        entries.push(`dir ${relativePath} ${stats.mtimeMs}`);
        await walk(fullPath, relativePath);
      } else {
        const stats = await fs.stat(fullPath);
        const contents = await fs.readFile(fullPath);
        entries.push(
          `file ${relativePath} ${stats.size} ${stats.mtimeMs} ${createHash("sha256").update(contents).digest("hex")}`,
        );
      }
    }
  }

  await walk(directory, "");
  return entries;
}

describe("scanFolder", () => {
  it("returns metadata for ordinary files and nested folders", async () => {
    await fs.writeFile(path.join(root, "a.txt"), "hello");
    await fs.writeFile(path.join(root, ".hidden"), "dot");
    await fs.mkdir(path.join(root, "sub"));
    await fs.writeFile(path.join(root, "sub", "b.pdf"), "pdf-bytes");
    await fs.mkdir(path.join(root, "sub", "nested"));
    await fs.writeFile(path.join(root, "sub", "nested", "c.PNG"), "png-bytes");

    const result = await scanFolder({ rootPath: root });

    expect(result.files.map((file) => file.relativePath)).toEqual([
      ".hidden",
      "a.txt",
      "sub/b.pdf",
      "sub/nested/c.PNG",
    ]);
    expect(result.directoriesScanned).toBe(3);
    expect(result.skippedCount).toBe(0);
    expect(result.truncated).toBe(false);
    expect(result.duplicateGroups).toEqual([]);

    const textFile = result.files[1];
    expect(textFile.name).toBe("a.txt");
    expect(textFile.extension).toBe("txt");
    expect(textFile.sizeBytes).toBe(5);
    expect(textFile.mimeType).toBe("text/plain");
    expect(textFile.kind).toBe("document");
    expect(Number.isNaN(Date.parse(textFile.modifiedAt))).toBe(false);

    const pngFile = result.files[3];
    expect(pngFile.extension).toBe("PNG");
    expect(pngFile.mimeType).toBe("image/png");
    expect(pngFile.kind).toBe("image");
  });

  it("classifies readable structured text formats as documents", async () => {
    const names = [
      "settings.json",
      "feed.xml",
      "config.yaml",
      "config.yml",
      "Cargo.toml",
      "query.sql",
    ];
    for (const name of names) {
      await fs.writeFile(path.join(root, name), name);
    }

    const result = await scanFolder({ rootPath: root });
    const byName = new Map(result.files.map((file) => [file.name, file]));

    for (const name of names) {
      expect(byName.get(name)?.kind).toBe("document");
    }
  });

  it("does not modify files while scanning", async () => {
    await fs.mkdir(path.join(root, "sub"));
    await fs.writeFile(path.join(root, "one.txt"), "one");
    await fs.writeFile(path.join(root, "sub", "two.bin"), "two");

    const before = await manifest(root);
    await scanFolder({ rootPath: root });
    const after = await manifest(root);

    expect(after).toEqual(before);
  });

  it("handles an empty folder", async () => {
    const result = await scanFolder({ rootPath: root });

    expect(result.files).toEqual([]);
    expect(result.directoriesScanned).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it("skips a file whose metadata cannot be read", async () => {
    await fs.writeFile(path.join(root, "locked.txt"), "locked");
    await fs.writeFile(path.join(root, "open.txt"), "open");

    const io: ScannerFs = {
      readdir: (directory, options) =>
        fs.readdir(directory, options) as Promise<Dirent[]>,
      realpath: (target) => fs.realpath(target),
      lstat: (target): Promise<Stats> =>
        target.endsWith("locked.txt")
          ? Promise.reject(permissionDenied())
          : fs.lstat(target),
    };

    const result = await scanFolder({ rootPath: root, fs: io });

    expect(result.files.map((file) => file.name)).toEqual(["open.txt"]);
    expect(result.skippedCount).toBe(1);
    expect(result.skipped).toEqual([
      {
        relativePath: "locked.txt",
        reason: "File metadata could not be read (permission denied).",
      },
    ]);
  });

  it("skips an unreadable directory but keeps scanning", async () => {
    await fs.mkdir(path.join(root, "private"));
    await fs.writeFile(path.join(root, "private", "hidden.txt"), "hidden");
    await fs.mkdir(path.join(root, "public"));
    await fs.writeFile(path.join(root, "public", "file.txt"), "visible");

    const io: ScannerFs = {
      readdir: (directory, options): Promise<Dirent[]> =>
        directory.endsWith("private")
          ? Promise.reject(permissionDenied())
          : fs.readdir(directory, options),
      realpath: (target) => fs.realpath(target),
      lstat: (target) => fs.lstat(target),
    };

    const result = await scanFolder({ rootPath: root, fs: io });

    expect(result.files.map((file) => file.relativePath)).toEqual([
      "public/file.txt",
    ]);
    expect(result.skipped).toEqual([
      {
        relativePath: "private",
        reason: "Folder could not be opened (permission denied).",
      },
    ]);
  });

  it("marks unsupported and unknown types without failing", async () => {
    await fs.writeFile(path.join(root, "installer.exe"), "MZ");
    await fs.writeFile(path.join(root, "data.unknownext"), "binary");

    const result = await scanFolder({ rootPath: root });
    const installer = result.files.find(
      (file) => file.name === "installer.exe",
    );
    const unknown = result.files.find(
      (file) => file.name === "data.unknownext",
    );

    expect(installer?.kind).toBe("other");
    expect(installer?.mimeType).toBe(
      "application/vnd.microsoft.portable-executable",
    );
    expect(installer?.warnings).toContain(
      "This file type is not supported for organization yet.",
    );
    expect(unknown?.mimeType).toBeNull();
    expect(unknown?.warnings).toContain(
      "MIME type could not be determined from the file extension.",
    );
  });

  it("skips symbolic links instead of following them", async (context) => {
    const outside = await fs.mkdtemp(
      path.join(os.tmpdir(), "slothsort-scan-outside-"),
    );
    const linkPath = path.join(root, "escape-link");

    try {
      await fs.writeFile(path.join(outside, "secret.txt"), "secret");
      await fs.symlink(
        outside,
        linkPath,
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch {
      await fs.rm(outside, { recursive: true, force: true });
      context.skip();
      return;
    }

    await fs.writeFile(path.join(root, "safe.txt"), "safe");

    const result = await scanFolder({ rootPath: root });

    expect(result.files.map((file) => file.name)).toEqual(["safe.txt"]);
    expect(result.skippedCount).toBe(1);
    expect(result.skipped[0]?.relativePath).toBe("escape-link");
    expect(result.skipped[0]?.reason).toContain("Symbolic link skipped");

    await fs.rm(linkPath, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });

  it("stops at the configured file limit", async () => {
    await fs.writeFile(path.join(root, "a.txt"), "a");
    await fs.writeFile(path.join(root, "b.txt"), "b");
    await fs.writeFile(path.join(root, "c.txt"), "c");

    const result = await scanFolder({ rootPath: root, maxFiles: 2 });

    expect(result.files).toHaveLength(2);
    expect(result.truncated).toBe(true);
    expect(result.truncationReason).toContain("2 files");
  });

  it("stops at the configured folder depth", async () => {
    await fs.mkdir(path.join(root, "one"));
    await fs.mkdir(path.join(root, "one", "two"));
    await fs.writeFile(path.join(root, "one", "two", "deep.txt"), "deep");

    const result = await scanFolder({ rootPath: root, maxDepth: 1 });

    expect(result.truncated).toBe(true);
    expect(result.files).toEqual([]);
    expect(result.skipped[0]?.relativePath).toBe("one/two");
    expect(result.skipped[0]?.reason).toContain("Maximum folder depth");
  });

  it("can be cancelled through an abort signal", async () => {
    for (let index = 0; index < 200; index += 1) {
      await fs.writeFile(
        path.join(root, `file-${String(index).padStart(3, "0")}.txt`),
        String(index),
      );
    }

    const controller = new AbortController();

    await expect(
      scanFolder({
        rootPath: root,
        signal: controller.signal,
        onProgress: (progress) => {
          if (progress.scannedFiles >= 5) controller.abort();
        },
      }),
    ).rejects.toBeInstanceOf(ScanCancelledError);
  });
});
