import { z } from "zod";

const pathTextSchema = z
  .string()
  .max(4096, "Path is too long")
  .refine((value) => !value.includes("\0"), "Path contains an invalid character");

export const folderPathSchema = pathTextSchema.trim().min(1, "A folder path is required");

/** An empty browse path means "start at the user's home folder". */
export const browsePathSchema = pathTextSchema.trim();

export const fileKindSchema = z.enum([
  "document",
  "image",
  "archive",
  "other",
]);

export const scannedFileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  relativePath: z.string().min(1),
  extension: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  modifiedAt: z.iso.datetime(),
  kind: fileKindSchema,
  mimeType: z.string().min(1).nullable(),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  warnings: z.array(z.string()),
});

export const skippedFileSchema = z.object({
  relativePath: z.string().min(1),
  reason: z.string().min(1),
});

export const duplicateGroupSchema = z.object({
  id: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  fileIds: z.array(z.string().min(1)),
});

export const scanProgressSchema = z.object({
  scannedFiles: z.number().int().nonnegative(),
  directoriesScanned: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  currentRelativePath: z.string(),
});

export const scanResultSchema = z.object({
  rootName: z.string().min(1),
  scannedAt: z.iso.datetime(),
  files: z.array(scannedFileSchema),
  duplicateGroups: z.array(duplicateGroupSchema),
  skipped: z.array(skippedFileSchema),
  skippedCount: z.number().int().nonnegative(),
  directoriesScanned: z.number().int().nonnegative(),
  truncated: z.boolean(),
  truncationReason: z.string().min(1).nullable(),
  durationMs: z.number().int().nonnegative(),
});

export const scanStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("progress"), progress: scanProgressSchema }),
  z.object({ type: z.literal("complete"), result: scanResultSchema }),
  z.object({
    type: z.literal("cancelled"),
    progress: scanProgressSchema,
  }),
  z.object({
    type: z.literal("error"),
    code: z.string().min(1),
    message: z.string().min(1),
  }),
]);

export const platformSchema = z.enum(["Windows", "macOS", "Linux"]);

export const approvedFolderSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  displayPath: z.string().min(1),
  platform: platformSchema,
  selectedAt: z.iso.datetime(),
});

export const folderBrowseEntrySchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
});

export const folderShortcutSchema = z.object({
  label: z.string().min(1),
  path: z.string().min(1),
});

export const folderBrowseResultSchema = z.object({
  currentPath: z.string().min(1),
  parentPath: z.string().min(1).nullable(),
  directories: z.array(folderBrowseEntrySchema),
  shortcuts: z.array(folderShortcutSchema),
  platform: platformSchema,
  selectable: z.boolean(),
  selectionBlockedReason: z.string().min(1).nullable(),
  truncated: z.boolean(),
  directoryCount: z.number().int().nonnegative(),
});

export const selectFolderResponseSchema = z.object({
  folder: approvedFolderSchema,
});

export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

export const browseRequestSchema = z.strictObject({
  path: browsePathSchema.optional(),
});

export const selectFolderRequestSchema = z.strictObject({
  path: folderPathSchema,
});

export const scanFolderRequestSchema = z.strictObject({
  folderId: z.uuid(),
});
