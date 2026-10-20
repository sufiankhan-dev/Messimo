import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import {
  detectDuplicates,
  type DuplicateProgress,
} from "@/lib/files/duplicates";
import type { HashFileResult } from "@/lib/files/hash";
import { scanFolder } from "@/lib/files/scanner";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "slothsort-duplicates-"));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function write(relativePath: string, contents: string): Promise<void> {
  const target = path.join(root, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, contents);
}

describe("exact duplicate detection", () => {
  it("groups identical files by content hash across folders", async () => {
    const contents = "identical invoice bytes";
    await write("one/invoice.txt", contents);
    await write("two/invoice-copy.txt", contents);
    await write("unique.txt", "a different file with another length");

    const progress: DuplicateProgress[] = [];
    const result = await scanFolder({
      rootPath: root,
      onProgress: (event) => {
        if (event.phase === "hashing") {
          progress.push({
            hashedFiles: event.hashedFiles,
            filesToHash: event.filesToHash,
            currentRelativePath: event.currentRelativePath,
          });
        }
      },
    });

    expect(result.duplicateGroups).toHaveLength(1);
    const [group] = result.duplicateGroups;
    expect(group.sha256).toBe(sha256(contents));
    expect(group.sizeBytes).toBe(Buffer.byteLength(contents));
    expect(group.fileIds).toEqual([
      "one/invoice.txt",
      "two/invoice-copy.txt",
    ]);

    const hashed = result.files.filter((file) => file.sha256);
    expect(hashed.map((file) => file.relativePath)).toEqual([
      "one/invoice.txt",
      "two/invoice-copy.txt",
    ]);
    expect(hashed.every((file) => file.sha256 === sha256(contents))).toBe(true);

    // The uniquely sized file never needed to be read.
    expect(
      result.files.find((file) => file.relativePath === "unique.txt")?.sha256,
    ).toBeUndefined();
    expect(result.hashedFiles).toBe(2);
    expect(progress.at(-1)).toMatchObject({
      hashedFiles: 2,
      filesToHash: 2,
    });

    // Detection is read-only.
    expect(await fs.readFile(path.join(root, "one/invoice.txt"), "utf8")).toBe(
      contents,
    );
  });

  it("does not treat equal sizes as proof of equal contents", async () => {
    await write("first.txt", "AAAA");
    await write("second.txt", "BBBB");

    const result = await scanFolder({ rootPath: root });

    expect(result.duplicateGroups).toEqual([]);
    expect(result.files.map((file) => file.sha256)).toHaveLength(2);
    expect(result.files[0].sha256).not.toBe(result.files[1].sha256);
    expect(result.hashedFiles).toBe(2);
  });

  it("keeps exact duplicates out of the similar-name list", async () => {
    await write("one/report.pdf", "same report");
    await write("two/report (1).pdf", "same report");
    await write("three/report-final.pdf", "another report");

    const result = await scanFolder({ rootPath: root });

    expect(result.duplicateGroups).toHaveLength(1);
    expect(result.similarNameGroups).toEqual([]);
  });
});

describe("similar names", () => {
  it("separates same-name files with different contents from duplicates", async () => {
    await write("one/photo.jpg", "first body");
    await write("two/photo.jpg", "other body");

    const result = await scanFolder({ rootPath: root });

    expect(result.duplicateGroups).toEqual([]);
    expect(result.similarNameGroups).toHaveLength(1);
    expect(result.similarNameGroups[0].fileIds).toEqual([
      "one/photo.jpg",
      "two/photo.jpg",
    ]);
    expect(result.similarNameGroups[0].note).toContain("not exact duplicates");
  });

  it("recognizes numbered variants without calling them copies", async () => {
    await write("IMG_2043.JPG", "one");
    await write("IMG_2044.JPG", "two");

    const result = await scanFolder({ rootPath: root });

    expect(result.duplicateGroups).toEqual([]);
    expect(result.similarNameGroups).toHaveLength(1);
    expect(result.similarNameGroups[0].fileIds).toEqual([
      "IMG_2043.JPG",
      "IMG_2044.JPG",
    ]);
  });
});

describe("hashing failures", () => {
  it("reports a file that disappeared after the scan and keeps the rest", async () => {
    await write("open.txt", "same bytes");
    await write("gone.txt", "same bytes");

    const scanned = await scanFolder({ rootPath: root });
    await fs.rm(path.join(root, "gone.txt"));

    const result = await detectDuplicates({
      rootPath: root,
      files: scanned.files,
    });

    expect(result.groups).toEqual([]);
    expect(result.hashedFiles).toBe(1);
    expect(result.hashingFailures).toEqual([
      {
        relativePath: "gone.txt",
        reason: "The file disappeared after the scan.",
      },
    ]);
  });

  it("records an unreadable file instead of failing the whole check", async () => {
    await write("locked.txt", "same bytes");
    await write("open.txt", "same bytes");

    const scanned = await scanFolder({ rootPath: root });
    const hasher = async (filePath: string): Promise<HashFileResult> => {
      if (path.basename(filePath) === "locked.txt") {
        return {
          status: "failed",
          reason: "unreadable",
          message: "The file contents could not be read.",
        };
      }

      return {
        status: "hashed",
        sha256: sha256("same bytes"),
        sizeBytes: Buffer.byteLength("same bytes"),
        modifiedAt: scanned.files.find(
          (file) => file.relativePath === "open.txt",
        )!.modifiedAt,
      };
    };

    const result = await detectDuplicates({
      rootPath: root,
      files: scanned.files,
      hasher,
    });

    expect(result.groups).toEqual([]);
    expect(result.hashedFiles).toBe(1);
    expect(result.hashingFailures).toEqual([
      {
        relativePath: "locked.txt",
        reason: "The file contents could not be read.",
      },
    ]);
  });

  it("refuses a file that changed after the scan", async () => {
    await write("change.txt", "12345");
    await write("steady.txt", "abcde");

    const scanned = await scanFolder({ rootPath: root });
    await fs.appendFile(path.join(root, "change.txt"), "678");

    const result = await detectDuplicates({
      rootPath: root,
      files: scanned.files,
    });

    expect(result.groups).toEqual([]);
    expect(result.hashingFailures).toEqual([
      {
        relativePath: "change.txt",
        reason:
          "The file changed after the scan, so its contents were not compared.",
      },
    ]);
  });
});
