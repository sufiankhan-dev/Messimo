import type {
  CategoryCount,
  DuplicateGroup,
  OrganizationFile,
  ProposedAction,
  ReviewStatus,
  WorkspaceSummary,
} from "@/types";

/** Files that would change location or name if their suggestion were approved. */
export function getProposedAction(file: OrganizationFile): ProposedAction {
  if (!file.suggestion || file.status === "rejected") return "none";

  const sourceFolder = file.relativePath.split(/[\\/]/).slice(0, -1).join("/");
  const targetFolder = file.suggestion.suggestedRelativePath.replace(
    /[\\/]+$/,
    "",
  );
  const moves = sourceFolder.replace(/\\/g, "/") !== targetFolder;
  const renames = file.suggestion.suggestedFileName !== file.name;

  if (moves && renames) return "move-and-rename";
  if (moves) return "move";
  if (renames) return "rename";
  return "none";
}

export function getWorkspaceSummary(
  files: OrganizationFile[],
  duplicateGroups: DuplicateGroup[],
): WorkspaceSummary {
  const duplicateIds = new Set(duplicateGroups.flatMap((group) => group.fileIds));

  return {
    scannedFiles: files.length,
    proposedChanges: files.filter(
      (file) => file.suggestion !== null && file.status !== "rejected",
    ).length,
    duplicateFiles: duplicateIds.size,
    needsReview: files.filter((file) => file.status === "needs-review").length,
    approved: files.filter((file) => file.status === "approved").length,
    rejected: files.filter((file) => file.status === "rejected").length,
    totalBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
  };
}

/** Category totals for actionable suggestions, largest first. */
export function getCategoryCounts(files: OrganizationFile[]): CategoryCount[] {
  const counts = new Map<string, number>();

  for (const file of files) {
    if (!file.suggestion || file.status === "rejected") continue;
    const category = file.suggestion.category;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return Array.from(counts, ([category, count]) => ({
    category: category as CategoryCount["category"],
    count,
  })).sort(
    (a, b) => b.count - a.count || a.category.localeCompare(b.category),
  );
}

export function getReviewCounts(
  files: OrganizationFile[],
): Record<ReviewStatus, number> {
  return files.reduce<Record<ReviewStatus, number>>(
    (counts, file) => {
      counts[file.status] += 1;
      return counts;
    },
    { pending: 0, approved: 0, rejected: 0, "needs-review": 0 },
  );
}
