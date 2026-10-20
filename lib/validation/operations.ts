import { z } from "zod";

/**
 * Shared schemas for approved file operations and safe undo.
 *
 * The browser may choose which suggestions to apply, but it can never choose a
 * root path. The server resolves the approved folder from an opaque id and
 * revalidates every source, destination, and file identity before acting.
 */

const relativePathSchema = z
  .string()
  .trim()
  .min(1, "A relative path is required")
  .max(4096, "Path is too long")
  .refine((value) => !value.includes("\0"), "Path contains an invalid character");

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const requestedOperationSchema = z.strictObject({
  sourceRelativePath: relativePathSchema,
  targetRelativePath: relativePathSchema,
  /** Scan-time identity, used to detect files that changed after the preview. */
  expectedSizeBytes: z.number().int().nonnegative().optional(),
  expectedModifiedAt: z.iso.datetime().optional(),
  expectedSha256: sha256Schema.optional(),
});

export const applyOperationsRequestSchema = z.strictObject({
  folderId: z.uuid(),
  /** Explicit confirmation is required; a batch cannot run without it. */
  confirmed: z.literal(true),
  operations: z
    .array(requestedOperationSchema)
    .min(1, "Select at least one approved operation.")
    .max(50, "Too many operations were requested for one batch."),
});

export const undoOperationRequestSchema = z.strictObject({
  confirmed: z.literal(true),
});

export const operationResultStatusSchema = z.enum([
  "completed",
  "failed",
  "skipped",
]);

export const operationMethodSchema = z.enum(["link", "copy"]);

export const operationResultItemSchema = z.strictObject({
  sourceRelativePath: z.string().min(1),
  targetRelativePath: z.string().min(1),
  status: operationResultStatusSchema,
  method: operationMethodSchema.nullable(),
  error: z.string().min(1).nullable(),
});

export const applyProgressSchema = z.strictObject({
  processed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  currentRelativePath: z.string(),
  completed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

export const applyResultSchema = z.strictObject({
  operationId: z.uuid().nullable(),
  total: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  items: z.array(operationResultItemSchema),
  historyRecorded: z.boolean(),
  historyError: z.string().min(1).nullable(),
  undoable: z.boolean(),
  note: z.string().min(1),
});

export const applyStreamEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("progress"), progress: applyProgressSchema }),
  z.strictObject({ type: z.literal("complete"), result: applyResultSchema }),
  z.strictObject({
    type: z.literal("error"),
    code: z.string().min(1),
    message: z.string().min(1),
  }),
]);

export const undoResultItemSchema = z.strictObject({
  relativePath: z.string().min(1),
  targetRelativePath: z.string().min(1),
  status: z.enum(["restored", "failed", "skipped"]),
  error: z.string().min(1).nullable(),
});

export const undoResultSchema = z.strictObject({
  operationId: z.uuid(),
  status: z.enum(["undone", "partial", "refused", "failed"]),
  restored: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  items: z.array(undoResultItemSchema),
  message: z.string().min(1),
});

export const undoResponseSchema = z.strictObject({
  result: undoResultSchema,
});

export type RequestedOperation = z.infer<typeof requestedOperationSchema>;
export type ApplyOperationsRequest = z.infer<
  typeof applyOperationsRequestSchema
>;
export type OperationResultStatus = z.infer<typeof operationResultStatusSchema>;
export type OperationMethod = z.infer<typeof operationMethodSchema>;
export type OperationResultItem = z.infer<typeof operationResultItemSchema>;
export type ApplyProgress = z.infer<typeof applyProgressSchema>;
export type ApplyResult = z.infer<typeof applyResultSchema>;
export type ApplyStreamEvent = z.infer<typeof applyStreamEventSchema>;
export type UndoResultItem = z.infer<typeof undoResultItemSchema>;
export type UndoResult = z.infer<typeof undoResultSchema>;
