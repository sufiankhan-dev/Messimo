import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  PathSafetyError,
  approveRoot,
  inspectSelectablePath,
  isSameOrInsidePath,
  isStrictlyInsidePath,
  resolveExistingPathInsideRoot,
  resolveInsideRoot,
} from "@/lib/files/path-safety";

let root: string;

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "slothsort-paths-"));
  await fs.writeFile(path.join(root, "notes.txt"), "hello");
  await fs.mkdir(path.join(root, "Documents"));
});

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("approveRoot", () => {
  it("canonicalizes an ordinary folder", async () => {
    const approved = await approveRoot(root);
    expect(approved).toBe(await fs.realpath(root));
  });

  it("rejects a relative path", async () => {
    await expect(approveRoot("Documents")).rejects.toMatchObject({
      code: "not_absolute",
    });
  });

  it("rejects a path that is a file", async () => {
    await expect(
      approveRoot(path.join(root, "notes.txt")),
    ).rejects.toMatchObject({ code: "not_directory" });
  });

  it("rejects a folder that does not exist", async () => {
    await expect(
      approveRoot(path.join(root, "does-not-exist")),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects a filesystem root", async () => {
    const filesystemRoot = path.parse(root).root;

    expect(
      inspectSelectablePath(filesystemRoot).allowed,
    ).toBe(false);
    await expect(approveRoot(filesystemRoot)).rejects.toBeInstanceOf(
      PathSafetyError,
    );
  });

  it("rejects the home folder and its parent", () => {
    const home = os.homedir();
    expect(inspectSelectablePath(home).allowed).toBe(false);
    expect(inspectSelectablePath(path.dirname(home)).allowed).toBe(false);
  });

  it("rejects a protected system folder", () => {
    const systemFolder =
      process.platform === "win32"
        ? (process.env.SystemRoot ?? "C:\\Windows")
        : "/etc";

    expect(inspectSelectablePath(systemFolder).allowed).toBe(false);
    expect(
      inspectSelectablePath(path.join(systemFolder, "nested")).allowed,
    ).toBe(false);
  });

  it("does not inspect file contents while approving", async () => {
    const before = await fs.readFile(path.join(root, "notes.txt"), "utf8");
    await approveRoot(root);
    const after = await fs.readFile(path.join(root, "notes.txt"), "utf8");

    expect(after).toBe(before);
  });
});

describe("resolveInsideRoot", () => {
  it("accepts a normal relative path", () => {
    expect(resolveInsideRoot(root, "Documents/report.pdf")).toBe(
      path.join(root, "Documents", "report.pdf"),
    );
  });

  it.each([
    "../escape.txt",
    "..\\escape.txt",
    "Documents/../../escape.txt",
    "Documents/./report.pdf",
    "Documents//report.pdf",
    "/etc/passwd",
    "C:\\Windows\\system32\\drivers\\etc\\hosts",
    "",
  ])("rejects %s", (candidate) => {
    expect(() => resolveInsideRoot(root, candidate)).toThrow(PathSafetyError);
  });
});

describe("resolveExistingPathInsideRoot", () => {
  it("returns the canonical path for a real file", async () => {
    const resolved = await resolveExistingPathInsideRoot(root, "notes.txt");
    expect(resolved).toBe(await fs.realpath(path.join(root, "notes.txt")));
  });

  it("rejects a missing file", async () => {
    await expect(
      resolveExistingPathInsideRoot(root, "missing.txt"),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects a symbolic link that escapes the root", async (context) => {
    const outside = await fs.mkdtemp(
      path.join(os.tmpdir(), "slothsort-outside-"),
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

    await expect(
      resolveExistingPathInsideRoot(root, "escape-link/secret.txt"),
    ).rejects.toMatchObject({ code: "unsafe_symlink" });

    await fs.rm(linkPath, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });
});

describe("path relation helpers", () => {
  it("distinguishes inside from sibling paths", () => {
    expect(isStrictlyInsidePath(root, path.join(root, "a"))).toBe(true);
    expect(isStrictlyInsidePath(root, root)).toBe(false);
    expect(isSameOrInsidePath(root, root)).toBe(true);
    expect(isSameOrInsidePath(root, `${root}-other`)).toBe(false);
  });
});
