import { describe, expect, it } from "vitest";
import {
  DEMO_DUPLICATE_GROUPS,
  DEMO_FILES,
  DEMO_SIMILAR_NAME_GROUPS,
} from "@/lib/mock/demo-workspace";
import {
  buildDuplicateGroups,
  buildSimilarNameGroups,
  getDuplicateFileCount,
  getRecoverableBytes,
} from "@/lib/workspace/duplicates";
import { makeFile } from "./fixtures";

describe("buildDuplicateGroups", () => {
  const groups = buildDuplicateGroups(DEMO_FILES, DEMO_DUPLICATE_GROUPS);

  it("joins each hash group with its scanned files", () => {
    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.files.map((file) => file.id))).toEqual([
      ["file-invoice-march", "file-invoice-march-copy"],
      ["file-photo-garden", "file-photo-garden-copy"],
    ]);
  });

  it("takes the shared size from the grouped files", () => {
    expect(groups[0].sizeBytes).toBe(291_420);
    expect(groups[1].sizeBytes).toBe(3_355_443);
  });

  it("counts only the extra copies as recoverable space", () => {
    expect(groups[0].recoverableBytes).toBe(291_420);
    expect(groups[1].recoverableBytes).toBe(3_355_443);
  });

  it("drops groups with fewer than two resolvable files", () => {
    const onlyCopy = buildDuplicateGroups(DEMO_FILES, [
      {
        id: "duplicate-single",
        sha256: "a".repeat(64),
        fileIds: ["file-invoice-march"],
      },
      {
        id: "duplicate-missing",
        sha256: "b".repeat(64),
        fileIds: ["file-invoice-march", "file-not-scanned"],
      },
    ]);

    expect(onlyCopy).toEqual([]);
  });

  it("ignores unknown file ids inside a valid group", () => {
    const [group] = buildDuplicateGroups(DEMO_FILES, [
      {
        id: "duplicate-invoice-march",
        sha256: "c".repeat(64),
        fileIds: [
          "file-invoice-march",
          "file-not-scanned",
          "file-invoice-march-copy",
        ],
      },
    ]);

    expect(group.files).toHaveLength(2);
    expect(group.recoverableBytes).toBe(291_420);
  });
});

describe("getRecoverableBytes", () => {
  it("totals the space that could be reclaimed", () => {
    const groups = buildDuplicateGroups(DEMO_FILES, DEMO_DUPLICATE_GROUPS);

    expect(getRecoverableBytes(groups)).toBe(291_420 + 3_355_443);
  });

  it("is zero when there are no duplicate groups", () => {
    expect(getRecoverableBytes([])).toBe(0);
  });
});

describe("getDuplicateFileCount", () => {
  it("counts unique files across every group", () => {
    expect(getDuplicateFileCount(DEMO_DUPLICATE_GROUPS)).toBe(4);
  });

  it("does not double-count a file listed in two groups", () => {
    expect(
      getDuplicateFileCount([
        { id: "a", sha256: "a".repeat(64), fileIds: ["one", "two"] },
        { id: "b", sha256: "b".repeat(64), fileIds: ["two", "three"] },
      ]),
    ).toBe(3);
  });
});

describe("buildSimilarNameGroups", () => {
  it("keeps similar-name groups separate from exact duplicates", () => {
    const groups = buildSimilarNameGroups(DEMO_FILES, DEMO_SIMILAR_NAME_GROUPS);

    expect(groups).toHaveLength(1);
    expect(groups[0].files.map((file) => file.id)).toEqual([
      "file-photo-garden",
      "file-photo-balcony",
    ]);
    expect(groups[0].note).toContain("not duplicates");
  });

  it("drops groups that cannot resolve two files", () => {
    const groups = buildSimilarNameGroups([makeFile({ id: "only" })], [
      { id: "similar", fileIds: ["only", "missing"], note: "Same name." },
    ]);

    expect(groups).toEqual([]);
  });
});
