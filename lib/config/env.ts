import { z } from "zod";

const serverEnvSchema = z.object({
  /** Local Ollama endpoint. SlothSort never falls back to a cloud provider. */
  OLLAMA_BASE_URL: z.url().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().trim().min(1).default("gemma3:4b"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Read and validate server configuration. Kept as a function so an invalid
 * environment fails where it is used instead of at import time.
 */
export function getServerEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  return serverEnvSchema.parse({
    OLLAMA_BASE_URL: source.OLLAMA_BASE_URL,
    OLLAMA_MODEL: source.OLLAMA_MODEL,
  });
}
