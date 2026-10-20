import { z } from "zod";
import { scannedFileSchema } from "@/lib/validation/files";

/**
 * Maximum supported files sent to the local model in one preview run. Shared
 * with the UI so progress totals and guidance match the server's real limit.
 */
export const MAX_PLAN_FILES = 24;

export const FILE_CATEGORIES = [
  "Documents",
  "Work",
  "Images",
  "Projects",
  "Finance",
  "Archives",
  "Other",
] as const;

export const fileCategorySchema = z.enum(FILE_CATEGORIES);

const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const DISALLOWED_FILENAME_CHARACTERS = /[<>:"/\\|?*\u0000-\u001F]/;

/**
 * A single filename segment. It must not be able to escape the approved folder,
 * so path separators, traversal references, and Windows-reserved names are rejected.
 */
export const safeFileNameSchema = z
  .string()
  .trim()
  .min(1, "Filename is required")
  .max(255, "Filename must be 255 characters or fewer")
  .refine(
    (name) => !DISALLOWED_FILENAME_CHARACTERS.test(name),
    "Filename contains characters that are not allowed on Windows",
  )
  .refine(
    (name) => name !== "." && name !== "..",
    "Filename cannot be a directory reference",
  )
  .refine(
    (name) => !/[. ]$/.test(name),
    "Filename cannot end with a space or a period",
  )
  .refine(
    (name) => !WINDOWS_RESERVED_NAME.test(name),
    "Filename is reserved by Windows",
  );

/** A destination path relative to the user-approved root folder. */
export const safeRelativePathSchema = z
  .string()
  .trim()
  .min(1, "Destination is required")
  .max(1024, "Destination is too long")
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.startsWith("\\") &&
      !/^[a-zA-Z]:/.test(value),
    "Destination must be relative to the approved folder",
  )
  .refine((value) => {
    const segments = value.split(/[\\/]/);
    return segments.every(
      (segment) => segment !== "" && segment !== "." && segment !== "..",
    );
  }, "Destination contains an unsafe path segment");

export const uncertaintySchema = z.enum(["low", "medium", "high"]);

/**
 * The structured shape Gemma must return through Ollama.
 *
 * `strictObject` rejects unexpected fields, so a reply cannot smuggle extra
 * instructions or a command field into the application.
 */
export const aiSuggestionSchema = z.strictObject({
  category: fileCategorySchema,
  suggestedFileName: safeFileNameSchema,
  suggestedRelativePath: safeRelativePathSchema,
  reason: z
    .string()
    .trim()
    .min(1, "A short reason is required")
    .max(500, "Reason is too long"),
  uncertainty: uncertaintySchema,
});

export const organizationOutcomeSchema = z.enum([
  "ready",
  "needs-review",
  "skipped",
  "failed",
]);

export const textExtractionStatusSchema = z.enum([
  "extracted",
  "empty",
  "not-needed",
  "unsupported",
  "too-large",
  "failed",
]);

export const extractionInfoSchema = z.strictObject({
  status: textExtractionStatusSchema,
  characters: z.number().int().nonnegative(),
  truncated: z.boolean(),
  message: z.string().min(1).nullable(),
});

export const organizationPlanEntrySchema = z.strictObject({
  file: scannedFileSchema,
  suggestion: aiSuggestionSchema.nullable(),
  outcome: organizationOutcomeSchema,
  warnings: z.array(z.string()),
  extraction: extractionInfoSchema,
  attempts: z.number().int().nonnegative(),
  modelDurationMs: z.number().nonnegative().nullable(),
  error: z.string().min(1).nullable(),
});

export const organizationTotalsSchema = z.strictObject({
  files: z.number().int().nonnegative(),
  ready: z.number().int().nonnegative(),
  needsReview: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  proposedChanges: z.number().int().nonnegative(),
  exactDuplicates: z.number().int().nonnegative(),
});

export const organizationPlanSchema = z.strictObject({
  folderName: z.string().min(1),
  generatedAt: z.iso.datetime(),
  model: z.string().min(1),
  entries: z.array(organizationPlanEntrySchema),
  totals: organizationTotalsSchema,
  durationMs: z.number().int().nonnegative(),
  truncated: z.boolean(),
  truncationReason: z.string().min(1).nullable(),
  rulesVersion: z.string().min(1),
});

export const organizationProgressSchema = z.strictObject({
  completed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  currentFile: z.string(),
  ready: z.number().int().nonnegative(),
  needsReview: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

export const organizationStreamEventSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("progress"),
    progress: organizationProgressSchema,
  }),
  z.strictObject({
    type: z.literal("complete"),
    plan: organizationPlanSchema,
  }),
  z.strictObject({
    type: z.literal("cancelled"),
    progress: organizationProgressSchema,
  }),
  z.strictObject({
    type: z.literal("error"),
    code: z.string().min(1),
    message: z.string().min(1),
  }),
]);

export const organizeRequestSchema = z.strictObject({
  folderId: z.uuid(),
  relativePaths: z
    .array(z.string().min(1).max(4096))
    .min(1, "Choose at least one scanned file.")
    .max(500, "Too many files were requested for one plan."),
});

export type AiSuggestion = z.infer<typeof aiSuggestionSchema>;
export type FileCategory = z.infer<typeof fileCategorySchema>;
export type Uncertainty = z.infer<typeof uncertaintySchema>;
export type OrganizationOutcome = z.infer<typeof organizationOutcomeSchema>;
export type TextExtractionStatus = z.infer<
  typeof textExtractionStatusSchema
>;
export type ExtractionInfo = z.infer<typeof extractionInfoSchema>;
export type OrganizationPlanEntry = z.infer<typeof organizationPlanEntrySchema>;
export type OrganizationPlan = z.infer<typeof organizationPlanSchema>;
export type OrganizationProgress = z.infer<typeof organizationProgressSchema>;
export type OrganizationTotals = z.infer<typeof organizationTotalsSchema>;
