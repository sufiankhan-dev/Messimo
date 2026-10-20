import { z } from "zod";

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

/** The structured shape Gemma must return through Ollama. */
export const aiSuggestionSchema = z.object({
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

export type AiSuggestion = z.infer<typeof aiSuggestionSchema>;
export type FileCategory = z.infer<typeof fileCategorySchema>;
export type Uncertainty = z.infer<typeof uncertaintySchema>;
