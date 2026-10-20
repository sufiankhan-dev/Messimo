import type { FileCategory } from "@/lib/validation/organization";

export const ORGANIZATION_RULES_VERSION = "2026-10-rules-1";

export interface CategoryRule {
  /** Root folder for the category, relative to the approved folder. */
  root: string;
  /** Every destination the model is allowed to choose, in display form. */
  destinations: readonly string[];
  /** Short guidance included in the prompt. */
  guidance: string;
}

/**
 * The approved organization scheme. These are the only destinations a model
 * reply may use; anything else is rejected by deterministic validation.
 */
export const ORGANIZATION_RULES: Readonly<Record<FileCategory, CategoryRule>> = {
  Documents: {
    root: "Documents",
    destinations: [
      "Documents",
      "Documents/Career",
      "Documents/Personal",
      "Documents/Manuals",
      "Documents/Notes",
    ],
    guidance:
      "General documents, resumes, personal paperwork, manuals, and notes.",
  },
  Work: {
    root: "Work",
    destinations: [
      "Work",
      "Work/Meeting notes",
      "Work/Finance",
      "Work/Admin",
      "Work/Design inspiration",
    ],
    guidance:
      "Work-related files. Use Work/Finance for work budgets or reports, and Finance for personal finances.",
  },
  Images: {
    root: "Images",
    destinations: [
      "Images",
      "Images/2024",
      "Images/2025",
      "Images/2026",
      "Images/Family",
      "Images/Screenshots",
    ],
    guidance:
      "Photos and screenshots. Pick a year folder when the date is known, or Family/Screenshots when the filename clearly indicates it.",
  },
  Projects: {
    root: "Projects",
    destinations: ["Projects", "Projects/Archives"],
    guidance:
      "Project archives and source bundles. Archive older work under Projects/Archives.",
  },
  Finance: {
    root: "Finance",
    destinations: [
      "Finance",
      "Finance/Invoices",
      "Finance/Tax",
      "Finance/Receipts",
      "Finance/Statements",
    ],
    guidance:
      "Personal finance files such as invoices, tax returns, receipts, and statements.",
  },
  Archives: {
    root: "Archives",
    destinations: [
      "Archives",
      "Archives/2024",
      "Archives/2025",
      "Archives/2026",
    ],
    guidance:
      "ZIP and other archive files that are not an active project. Use the year when it is known.",
  },
  Other: {
    root: "Other",
    destinations: ["Other"],
    guidance:
      "Use only when the file genuinely does not fit another category. Prefer a more specific category when the evidence supports it.",
  },
};

export const APPROVED_DESTINATIONS: readonly string[] = Object.values(
  ORGANIZATION_RULES,
).flatMap((rule) => rule.destinations);

function normalizeDestination(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+$/, "");
}

/**
 * Return the canonical approved destination for a category, or null when the
 * model chose a folder outside the scheme. Matching is case-insensitive but the
 * canonical spelling is returned so plans are deterministic.
 */
export function canonicalDestination(
  category: FileCategory,
  rawDestination: string,
): string | null {
  const normalized = normalizeDestination(rawDestination).toLowerCase();
  if (!normalized) return null;

  const rule = ORGANIZATION_RULES[category];
  const match = rule.destinations.find(
    (destination) => destination.toLowerCase() === normalized,
  );

  return match ?? null;
}

/** Prompt-ready list of the approved categories and destinations. */
export function formatDestinationRules(): string {
  return (Object.keys(ORGANIZATION_RULES) as FileCategory[])
    .map((category) => {
      const rule = ORGANIZATION_RULES[category];
      return [
        `- ${category}: ${rule.guidance}`,
        `  Allowed destinations: ${rule.destinations.join(", ")}`,
      ].join("\n");
    })
    .join("\n");
}
