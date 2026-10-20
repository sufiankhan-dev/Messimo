import type { OrganizationFile, OrganizationPlan } from "@/types";

/**
 * Convert a read-only organization plan into the review model. No decisions are
 * persisted and no operation is scheduled; this only shapes data for the UI.
 */
export function planToOrganizationFiles(
  plan: OrganizationPlan,
): OrganizationFile[] {
  return plan.entries.map((entry) => ({
    ...entry.file,
    suggestion: entry.suggestion,
    status:
      entry.outcome === "ready" && entry.suggestion
        ? "pending"
        : "needs-review",
    duplicateGroupId: null,
    supported: entry.file.kind !== "other",
    // Keep scan-time metadata warnings alongside the planning warnings so the
    // review screen never hides why a file needs attention.
    warnings: [...new Set([...entry.file.warnings, ...entry.warnings])],
  }));
}

export function countSupportedFiles(plan: OrganizationPlan): number {
  return plan.entries.filter((entry) => entry.file.kind !== "other").length;
}
