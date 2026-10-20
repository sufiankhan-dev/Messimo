import { describe, expect, it } from "vitest";
import {
  DEMO_DUPLICATE_GROUPS,
  DEMO_FILES,
} from "@/lib/mock/demo-workspace";
import {
  getCategoryCounts,
  getProposedAction,
  getReviewCounts,
  getWorkspaceSummary,
} from "@/lib/workspace/summary";
import { makeFile } from "./fixtures";

describe("getProposedAction", () => {
  it("returns no change when there is no suggestion", () => {
    expect(getProposedAction(makeFile({}))).toBe("none");
  });

  it("returns no change for rejected suggestions", () => {
    const file = makeFile({
      status: "rejected",
      suggestion: {
        category: "Documents",
        suggestedFileName: "2026-report.pdf",
        suggestedRelativePath: "Documents",
        reason: "Looks like a report.",
        uncertainty: "low",
      },
    });

    expect(getProposedAction(file)).toBe("none");
  });

  it("detects a move that keeps the filename", () => {
    const file = makeFile({
      name: "meeting-notes.txt",
      relativePath: "meeting-notes.txt",
      suggestion: {
        category: "Work",
        suggestedFileName: "meeting-notes.txt",
        suggestedRelativePath: "Work/Meeting notes",
        reason: "Fits the work folder.",
        uncertainty: "low",
      },
    });

    expect(getProposedAction(file)).toBe("move");
  });

  it("detects a rename inside the same folder", () => {
    const file = makeFile({
      name: "scan001.pdf",
      relativePath: "Finance/scan001.pdf",
      suggestion: {
        category: "Finance",
        suggestedFileName: "2026-03-invoice.pdf",
        suggestedRelativePath: "Finance",
        reason: "Invoice naming pattern.",
        uncertainty: "low",
      },
    });

    expect(getProposedAction(file)).toBe("rename");
  });

  it("detects a move and rename together", () => {
    const file = makeFile({
      suggestion: {
        category: "Documents",
        suggestedFileName: "2026-report.pdf",
        suggestedRelativePath: "Documents/Career",
        reason: "Report naming pattern.",
        uncertainty: "low",
      },
    });

    expect(getProposedAction(file)).toBe("move-and-rename");
  });

  it("returns no change when folder and filename already match", () => {
    const file = makeFile({
      relativePath: "Documents/report.pdf",
      suggestion: {
        category: "Documents",
        suggestedFileName: "report.pdf",
        suggestedRelativePath: "Documents",
        reason: "Already organized.",
        uncertainty: "low",
      },
    });

    expect(getProposedAction(file)).toBe("none");
  });
});

describe("getWorkspaceSummary", () => {
  const summary = getWorkspaceSummary(DEMO_FILES, DEMO_DUPLICATE_GROUPS);

  it("counts files, proposals, duplicates, and review states", () => {
    expect(summary.scannedFiles).toBe(15);
    expect(summary.proposedChanges).toBe(11);
    expect(summary.duplicateFiles).toBe(4);
    expect(summary.needsReview).toBe(5);
    expect(summary.approved).toBe(3);
    expect(summary.rejected).toBe(1);
  });

  it("totals bytes from the file list", () => {
    const expectedTotal = DEMO_FILES.reduce(
      (total, file) => total + file.sizeBytes,
      0,
    );

    expect(summary.totalBytes).toBe(expectedTotal);
  });
});

describe("getCategoryCounts", () => {
  it("counts actionable suggestions and excludes rejected ones", () => {
    const counts = getCategoryCounts(DEMO_FILES);
    const byCategory = Object.fromEntries(
      counts.map((entry) => [entry.category, entry.count]),
    );

    expect(byCategory.Finance).toBe(2);
    expect(byCategory.Images).toBe(3);
    expect(byCategory.Work).toBe(3);
    expect(byCategory.Documents).toBe(1);
    expect(byCategory.Projects).toBe(1);
    expect(byCategory.Archives).toBe(1);
  });

  it("sorts the largest categories first", () => {
    const counts = getCategoryCounts(DEMO_FILES);
    const sorted = [...counts].sort((a, b) => b.count - a.count);
    expect(counts.map((entry) => entry.count)).toEqual(
      sorted.map((entry) => entry.count),
    );
  });
});

describe("getReviewCounts", () => {
  it("adds up to the number of files", () => {
    const counts = getReviewCounts(DEMO_FILES);
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

    expect(total).toBe(DEMO_FILES.length);
  });
});
