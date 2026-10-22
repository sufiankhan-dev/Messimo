import { describe, expect, it } from "vitest";
import { countSupportedFiles, planToOrganizationFiles } from "@/lib/workspace/plan";
import type {
  OrganizationOutcome,
  OrganizationPlan,
  OrganizationPlanEntry,
} from "@/types";

const SUGGESTION = {
  category: "Documents" as const,
  suggestedFileName: "2026-notes.pdf",
  suggestedRelativePath: "Documents",
  reason: "The filename suggests meeting notes.",
  uncertainty: "low" as const,
};

function makeEntry(
  overrides: Partial<OrganizationPlanEntry> = {},
  outcome: OrganizationOutcome = "ready",
): OrganizationPlanEntry {
  return {
    file: {
      id: "file-notes",
      name: "scan_0042.pdf",
      relativePath: "scan_0042.pdf",
      extension: "pdf",
      sizeBytes: 2048,
      modifiedAt: "2026-10-01T10:00:00.000Z",
      kind: "document",
      mimeType: "application/pdf",
      warnings: [],
    },
    suggestion: SUGGESTION,
    outcome,
    warnings: [],
    extraction: {
      status: "extracted",
      characters: 240,
      truncated: false,
      message: null,
    },
    attempts: 1,
    modelDurationMs: 1200,
    error: null,
    ...overrides,
  };
}

function makePlan(entries: OrganizationPlanEntry[]): OrganizationPlan {
  return {
    folderName: "Downloads",
    generatedAt: "2026-10-01T10:05:00.000Z",
    model: "gemma3:4b",
    entries,
    totals: {
      files: entries.length,
      ready: entries.filter((entry) => entry.outcome === "ready").length,
      needsReview: entries.filter((entry) => entry.outcome === "needs-review")
        .length,
      skipped: entries.filter((entry) => entry.outcome === "skipped").length,
      failed: entries.filter((entry) => entry.outcome === "failed").length,
      proposedChanges: entries.filter((entry) => entry.suggestion !== null)
        .length,
      exactDuplicates: 0,
    },
    durationMs: 3000,
    truncated: false,
    truncationReason: null,
    rulesVersion: "1",
  };
}

describe("planToOrganizationFiles", () => {
  it("marks a ready suggestion as pending and keeps the suggestion", () => {
    const [file] = planToOrganizationFiles(makePlan([makeEntry()]));

    expect(file.status).toBe("pending");
    expect(file.suggestion).toEqual(SUGGESTION);
    expect(file.supported).toBe(true);
    expect(file.duplicateGroupId).toBeNull();
  });

  it("sends needs-review, failed, and skipped outcomes to manual review", () => {
    const entries = [
      makeEntry({ file: { ...makeEntry().file, id: "review" } }, "needs-review"),
      makeEntry(
        {
          file: { ...makeEntry().file, id: "failed" },
          suggestion: null,
          error: "The model returned an unsafe destination.",
        },
        "failed",
      ),
      makeEntry(
        {
          file: { ...makeEntry().file, id: "skipped", kind: "other" },
          suggestion: null,
        },
        "skipped",
      ),
    ];

    for (const file of planToOrganizationFiles(makePlan(entries))) {
      expect(file.status).toBe("needs-review");
    }
  });

  it("treats a ready outcome without a suggestion as manual review", () => {
    const [file] = planToOrganizationFiles(
      makePlan([makeEntry({ suggestion: null })]),
    );

    expect(file.status).toBe("needs-review");
  });

  it("carries warnings and marks unsupported file kinds", () => {
    const entry = makeEntry({
      file: {
        ...makeEntry().file,
        kind: "other",
        warnings: ["Extension is not recognized."],
      },
      warnings: ["Exact duplicate of another file."],
    });

    const [file] = planToOrganizationFiles(makePlan([entry]));

    expect(file.supported).toBe(false);
    expect(file.warnings).toEqual([
      "Extension is not recognized.",
      "Exact duplicate of another file.",
    ]);
  });
});

describe("countSupportedFiles", () => {
  it("counts only entries Messimo can organize", () => {
    const entries = [
      makeEntry(),
      makeEntry({ file: { ...makeEntry().file, id: "other", kind: "other" } }),
    ];

    expect(countSupportedFiles(makePlan(entries))).toBe(1);
  });
});
