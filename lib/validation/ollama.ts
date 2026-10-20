import { z } from "zod";
import { aiSuggestionSchema } from "@/lib/validation/organization";

/** Runtime version reported by the local Ollama installation. */
export const ollamaVersionSchema = z.object({
  version: z.string().trim().min(1).max(64),
});

export const ollamaStatusSchema = z.object({
  state: z.enum(["connected", "model-missing", "unreachable"]),
  connected: z.boolean(),
  baseUrl: z.url(),
  selectedModel: z.string().min(1),
  runtimeVersion: z.string().min(1).nullable(),
  installedModels: z.array(z.string().min(1)),
  modelAvailable: z.boolean(),
  checkedAt: z.iso.datetime(),
  message: z.string().min(1),
});

/** The synthetic file metadata sent by the diagnostic prompt. */
export const diagnosticSampleSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  extension: z.string().trim().min(1).max(16),
  sizeBytes: z.number().int().nonnegative(),
  modifiedAt: z.iso.datetime(),
  detectedType: z.string().trim().min(1).max(32),
});

/**
 * A validated, local-only inference result. The model output never reaches the
 * browser until it has passed `aiSuggestionSchema`.
 */
export const ollamaDiagnosticResultSchema = z.object({
  suggestion: aiSuggestionSchema,
  /** True when SlothSort restored the original extension the model omitted. */
  extensionNormalized: z.boolean(),
  sample: diagnosticSampleSchema,
  model: z.string().trim().min(1).max(128),
  runtimeVersion: z.string().min(1).nullable(),
  durationMs: z.number().int().nonnegative(),
  generatedAt: z.iso.datetime(),
});

export const ollamaErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

export type OllamaStatusPayload = z.infer<typeof ollamaStatusSchema>;
export type DiagnosticSample = z.infer<typeof diagnosticSampleSchema>;
export type OllamaDiagnosticResult = z.infer<
  typeof ollamaDiagnosticResultSchema
>;
