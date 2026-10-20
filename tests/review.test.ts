import { describe, expect, it } from "vitest";
import { DEMO_FILES } from "@/lib/mock/demo-workspace";
import {
  applyReviewDecisions,
  countApprovedActions,
  filterReviewFiles,
  getSafeBulkApprovalIds,
  REVIEW_FILTERS,
} from "@/lib/workspace/review";
import { getWorkspaceSummary } from "@/lib/workspace/summary";
import { makeFile } from "./fixtures";

const SAFE_SUGGESTION = {
  category: "Documents" as const,
  suggestedFileName: "2026-notes.pdf",
  suggestedRelativePath: "Documents",
  reason: "Filename suggests notes.",
  uncertainty: "low" as const,
};

describe("applyReviewDecisions", () => {
  it("overlays session decisions on the scanned file list", () => {
    const files = [
      makeFile({ id: "a" }),
      makeFile({ id: "b", status: "needs-review" }),
      makeFile({ id: "c", status: "rejected" }),
    ];

    const merged = applyReviewDecisions(files, { a: "approved", c: "pending" });

    expect(merged.map((file) => file.status)).toEqual([
      "approved",
      "needs-review",
      "pending",
    ]);
  });

  it("does not mutate the original records", () => {
    const files = [makeFile({ id: "a", status: "pending" })];

    applyReviewDecisions(files, { a: "rejected" });

    expect(files[0].status).toBe("pending");
  });

  it("ignores ids that are not part of the scan", () => {
    const files = [makeFile({ id: "a" })];

    const merged = applyReviewDecisions(files, { unknown: "approved" });

    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe("pending");
  });
});

describe("filterReviewFiles", () => {
  it("returns every file for the all filter", () => {
    expect(filterReviewFiles(DEMO_FILES, "all")).toHaveLength(DEMO_FILES.length);
  });

  it("matches the status filters against the demo data", () => {
    const counts = getWorkspaceSummary(DEMO_FILES, []);

    expect(filterReviewFiles(DEMO_FILES, "needs-review")).toHaveLength(
      counts.needsReview,
    );
    expect(filterReviewFiles(DEMO_FILES, "pending")).toHaveLength(
      DEMO_FILES.filter((file) => file.status === "pending").length,
    );
    expect(filterReviewFiles(DEMO_FILES, "approved")).toHaveLength(
      counts.approved,
    );
    expect(filterReviewFiles(DEMO_FILES, "rejected")).toHaveLength(
      counts.rejected,
    );
  });

  it("offers one filter per status plus all", () => {
    expect(REVIEW_FILTERS.map((filter) => filter.id)).toEqual([
      "needs-review",
      "pending",
      "approved",
      "rejected",
      "all",
    ]);
  });
});

describe("getSafeBulkApprovalIds", () => {
  it("selects only low-risk suggestions awaiting a decision", () => {
    expect(getSafeBulkApprovalIds(DEMO_FILES)).toEqual([
      "file-invoice-march",
      "file-photo-garden",
      "file-budget-q2",
      "file-project-alpha",
      "file-archive-2025",
    ]);
  });

  it("excludes files without a suggestion", () => {
    const file = makeFile({ id: "no-suggestion", suggestion: null });

    expect(getSafeBulkApprovalIds([file])).toEqual([]);
  });

  it("excludes warnings, high uncertainty, and decided files", () => {
    const files = [
      makeFile({
        id: "warned",
        warnings: ["Exact duplicate of another file."],
        suggestion: SAFE_SUGGESTION,
      }),
      makeFile({
        id: "uncertain",
        suggestion: { ...SAFE_SUGGESTION, uncertainty: "high" },
      }),
      makeFile({ id: "approved", status: "approved", suggestion: SAFE_SUGGESTION }),
      makeFile({ id: "rejected", status: "rejected", suggestion: SAFE_SUGGESTION }),
      makeFile({ id: "safe", status: "needs-review", suggestion: SAFE_SUGGESTION }),
    ];

    expect(getSafeBulkApprovalIds(files)).toEqual(["safe"]);
  });
});

describe("countApprovedActions", () => {
  it("counts approved suggestions that would need a file operation", () => {
    expect(countApprovedActions(DEMO_FILES)).toBe(3);
  });

  it("ignores approved files without a suggestion", () => {
    const files = [
      makeFile({ id: "a", status: "approved", suggestion: SAFE_SUGGESTION }),
      makeFile({ id: "b", status: "approved", suggestion: null }),
      makeFile({ id: "c", status: "pending", suggestion: SAFE_SUGGESTION }),
    ];

    expect(countApprovedActions(files)).toBe(1);
  });
});
