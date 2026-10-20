import { z } from "zod";
import { getServerEnv } from "@/lib/config/env";
import {
  ollamaStatusSchema,
  ollamaVersionSchema,
} from "@/lib/validation/ollama";
import type { OllamaStatus } from "@/types";

/**
 * Local-only Ollama health check.
 *
 * This intentionally does not send a prompt, a filename, or file content. It
 * reads the list of installed models so the interface can report whether local
 * inference is available. There is no cloud fallback.
 */

const ollamaTagsSchema = z.object({
  models: z
    .array(
      z
        .object({
          name: z.string().min(1).optional(),
          model: z.string().min(1).optional(),
          size: z.number().nonnegative().optional(),
        })
        .refine((model) => Boolean(model.name ?? model.model), {
          message: "A model entry needs a name or model field.",
        }),
    )
    .default([]),
});

export interface OllamaCheckInput {
  baseUrl: string;
  selectedModel: string;
  runtimeVersion?: string | null;
  installedModels: string[];
  checkedAt?: string;
}

function normalizeModelName(name: string): string {
  return name.trim().toLowerCase();
}

/** Ollama adds ":latest" when a model is pulled without a tag. */
export function isModelInstalled(
  selectedModel: string,
  installedModels: string[],
): boolean {
  const selected = normalizeModelName(selectedModel);
  if (!selected) return false;

  const candidates = new Set([selected]);
  if (!selected.includes(":")) {
    candidates.add(`${selected}:latest`);
  }

  return installedModels.some((model) =>
    candidates.has(normalizeModelName(model)),
  );
}

export function evaluateOllamaStatus({
  baseUrl,
  selectedModel,
  runtimeVersion = null,
  installedModels,
  checkedAt = new Date().toISOString(),
}: OllamaCheckInput): OllamaStatus {
  const modelAvailable = isModelInstalled(selectedModel, installedModels);

  return {
    state: modelAvailable ? "connected" : "model-missing",
    connected: true,
    baseUrl,
    selectedModel,
    runtimeVersion,
    installedModels,
    modelAvailable,
    checkedAt,
    message: modelAvailable
      ? `${selectedModel} is installed and ready for local inference.`
      : `Ollama is running, but ${selectedModel} is not installed.`,
  };
}

export function buildUnreachableOllamaStatus({
  baseUrl,
  selectedModel,
  runtimeVersion = null,
  message,
  checkedAt = new Date().toISOString(),
}: {
  baseUrl: string;
  selectedModel: string;
  runtimeVersion?: string | null;
  message: string;
  checkedAt?: string;
}): OllamaStatus {
  return {
    state: "unreachable",
    connected: false,
    baseUrl,
    selectedModel,
    runtimeVersion,
    installedModels: [],
    modelAvailable: false,
    checkedAt,
    message,
  };
}

export interface CheckOllamaOptions {
  baseUrl?: string;
  selectedModel?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** Remove trailing slashes so endpoints are built consistently. */
export function normalizeOllamaBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

/**
 * The version endpoint is best-effort: an older Ollama build that lacks it must
 * not make a healthy connection look broken.
 */
async function readRuntimeVersion(
  fetchImpl: typeof fetch,
  baseUrl: string,
  signal: AbortSignal,
): Promise<string | null> {
  try {
    const response = await fetchImpl(`${baseUrl}/api/version`, {
      signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return null;

    const parsed = ollamaVersionSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.version : null;
  } catch {
    return null;
  }
}

export async function checkOllamaConnection(
  options: CheckOllamaOptions = {},
): Promise<OllamaStatus> {
  const env = getServerEnv();
  const baseUrl = normalizeOllamaBaseUrl(
    options.baseUrl ?? env.OLLAMA_BASE_URL,
  );
  const selectedModel = options.selectedModel ?? env.OLLAMA_MODEL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const checkedAt = new Date().toISOString();
  const timeoutMs = options.timeoutMs ?? 2500;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl}/api/tags`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return buildUnreachableOllamaStatus({
        baseUrl,
        selectedModel,
        checkedAt,
        message: `Ollama responded with status ${response.status}. Check that the local service is healthy.`,
      });
    }

    const parsed = ollamaTagsSchema.safeParse(await response.json());
    if (!parsed.success) {
      return buildUnreachableOllamaStatus({
        baseUrl,
        selectedModel,
        checkedAt,
        message:
          "Ollama returned an unexpected response. Check the installed model list manually.",
      });
    }

    const runtimeVersion = await readRuntimeVersion(
      fetchImpl,
      baseUrl,
      controller.signal,
    );

    return evaluateOllamaStatus({
      baseUrl,
      selectedModel,
      runtimeVersion,
      checkedAt,
      installedModels: parsed.data.models.map(
        (model) => model.name ?? model.model ?? "",
      ),
    });
  } catch {
    return buildUnreachableOllamaStatus({
      baseUrl,
      selectedModel,
      checkedAt,
      message: controller.signal.aborted
        ? `Ollama did not respond within ${Math.max(1, Math.round(timeoutMs / 1000))} seconds. Check that the local service is running.`
        : `No response from ${baseUrl}. Start Ollama with "ollama serve" and try again.`,
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export { ollamaStatusSchema };
