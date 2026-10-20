import type { OrganizationFile, ReviewStatus } from "@/types";

export type ReviewFilter =
  | "needs-review"
  | "pending"
  | "approved"
  | "rejected"
  | "all";

export const REVIEW_FILTERS: ReadonlyArray<{
  id: ReviewFilter;
  label: string;
}> = [
  { id: "needs-review", label: "Needs review" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

/** Review decisions made in the current (unsaved) session. */
export type ReviewDecisions = Readonly<Record<string, ReviewStatus>>;

/** Merge session decisions over the data returned by the scan. */
export function applyReviewDecisions(
  files: OrganizationFile[],
  decisions: ReviewDecisions,
): OrganizationFile[] {
  return files.map((file) =>
    decisions[file.id] ? { ...file, status: decisions[file.id] } : file,
  );
}

export function filterReviewFiles(
  files: OrganizationFile[],
  filter: ReviewFilter,
): OrganizationFile[] {
  if (filter === "all") return files;
  return files.filter((file) => file.status === filter);
}

/**
 * Suggestions that can be approved as a batch without extra attention:
 * they have a destination, no warnings, and the model reported low uncertainty.
 */
export function getSafeBulkApprovalIds(files: OrganizationFile[]): string[] {
  return files
    .filter(
      (file) =>
        file.suggestion !== null &&
        file.warnings.length === 0 &&
        file.suggestion.uncertainty === "low" &&
        (file.status === "pending" || file.status === "needs-review"),
    )
    .map((file) => file.id);
}

/** Number of approved suggestions that would need a real file operation. */
export function countApprovedActions(files: OrganizationFile[]): number {
  return files.filter(
    (file) => file.status === "approved" && file.suggestion !== null,
  ).length;
}
