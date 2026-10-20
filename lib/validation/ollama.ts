import { z } from "zod";

export const ollamaStatusSchema = z.object({
  state: z.enum(["connected", "model-missing", "unreachable"]),
  connected: z.boolean(),
  baseUrl: z.url(),
  selectedModel: z.string().min(1),
  installedModels: z.array(z.string().min(1)),
  modelAvailable: z.boolean(),
  checkedAt: z.iso.datetime(),
  message: z.string().min(1),
});

export type OllamaStatusPayload = z.infer<typeof ollamaStatusSchema>;
