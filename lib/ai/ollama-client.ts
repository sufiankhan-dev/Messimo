import { z } from "zod";
import { isLoopbackHostname } from "@/lib/server/local-request";

/**
 * Server-side Ollama client.
 *
 * Verified against Ollama 0.40.4 on this machine:
 * - `POST /api/chat` with `stream: false`
 * - `format` accepts a JSON Schema object and constrains decoding
 * - the reply arrives in `message.content` as a JSON string
 *
 * The client only talks to a loopback endpoint, never logs prompts or model
 * output, and validates the model reply with Zod before returning it.
 */

export const DEFAULT_OLLAMA_TIMEOUT_MS = 60_000;

export type OllamaClientErrorCode =
  | "unsafe_endpoint"
  | "unavailable"
  | "timeout"
  | "model_missing"
  | "http_error"
  | "malformed_json"
  | "invalid_response"
  | "cancelled";

export class OllamaClientError extends Error {
  readonly code: OllamaClientErrorCode;

  constructor(code: OllamaClientErrorCode, message: string) {
    super(message);
    this.name = "OllamaClientError";
    this.code = code;
  }
}

const chatEnvelopeSchema = z.object({
  model: z.string().trim().min(1).optional(),
  created_at: z.string().optional(),
  message: z.object({
    role: z.string().optional(),
    content: z.string(),
  }),
  done: z.boolean().optional(),
});

const ollamaErrorSchema = z.object({
  error: z.string(),
});

export interface OllamaClientOptions {
  baseUrl: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface StructuredChatRequest<T> {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  maxOutputTokens?: number;
  timeoutMs?: number;
  /** Optional caller cancellation (for example when the user leaves the page). */
  signal?: AbortSignal;
}

export interface StructuredChatResult<T> {
  data: T;
  model: string;
  durationMs: number;
  generatedAt: string;
}

/**
 * True only for an HTTP(S) URL that points back at this machine. Shared by the
 * inference client and the status check so neither can contact a remote host,
 * even when `OLLAMA_BASE_URL` is misconfigured.
 */
export function isLoopbackOllamaUrl(baseUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return false;
  }

  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    isLoopbackHostname(url.hostname)
  );
}

/** Reject any endpoint that could send prompts beyond this machine. */
export function assertLoopbackOllamaBaseUrl(baseUrl: string): URL {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new OllamaClientError(
      "unsafe_endpoint",
      "OLLAMA_BASE_URL is not a valid URL. Local inference needs a loopback address.",
    );
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    !isLoopbackHostname(url.hostname)
  ) {
    throw new OllamaClientError(
      "unsafe_endpoint",
      "OLLAMA_BASE_URL must point at this computer (localhost or 127.0.0.1). Messimo never sends prompts to a remote provider.",
    );
  }

  return url;
}

/**
 * Zod is the single source of truth: the JSON Schema sent to Ollama is derived
 * from the same schema used to validate the reply.
 */
function toOllamaFormat(schema: z.ZodType): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return jsonSchema;
}

function describeTimeout(timeoutMs: number): string {
  const seconds = Math.max(1, Math.round(timeoutMs / 1000));
  return `Ollama did not answer within ${seconds} seconds. The model may still be loading; try again.`;
}

export class OllamaClient {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OllamaClientOptions) {
    const url = assertLoopbackOllamaBaseUrl(options.baseUrl);
    this.baseUrl = url.toString().replace(/\/+$/, "");
    this.model = options.model;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_OLLAMA_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async chatStructured<T>({
    systemPrompt,
    userPrompt,
    schema,
    maxOutputTokens = 320,
    timeoutMs,
    signal,
  }: StructuredChatRequest<T>): Promise<StructuredChatResult<T>> {
    const requestTimeout = timeoutMs ?? this.timeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeout);
    const startedAt = Date.now();
    const abortFromCaller = () => controller.abort();

    if (signal?.aborted) {
      controller.abort();
    } else {
      signal?.addEventListener("abort", abortFromCaller, { once: true });
    }

    try {
      let response: Response;
      try {
        response = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
          method: "POST",
          signal: controller.signal,
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.model,
            stream: false,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            format: toOllamaFormat(schema),
            options: {
              temperature: 0,
              seed: 7,
              num_predict: maxOutputTokens,
            },
          }),
        });
      } catch {
        if (signal?.aborted) {
          throw new OllamaClientError(
            "cancelled",
            "Local inference was cancelled. No file was changed.",
          );
        }
        if (controller.signal.aborted) {
          throw new OllamaClientError(
            "timeout",
            describeTimeout(requestTimeout),
          );
        }
        throw new OllamaClientError(
          "unavailable",
          `No response from ${this.baseUrl}. Start Ollama with "ollama serve" and try again.`,
        );
      }

      if (!response.ok) {
        throw await this.translateHttpError(response);
      }

      let envelopeBody: unknown;
      try {
        envelopeBody = await response.json();
      } catch {
        if (signal?.aborted) {
          throw new OllamaClientError(
            "cancelled",
            "Local inference was cancelled. No file was changed.",
          );
        }
        if (controller.signal.aborted) {
          throw new OllamaClientError(
            "timeout",
            describeTimeout(requestTimeout),
          );
        }
        throw new OllamaClientError(
          "malformed_json",
          "Ollama returned a response that was not valid JSON. No model output was used.",
        );
      }

      const envelope = chatEnvelopeSchema.safeParse(envelopeBody);
      if (!envelope.success) {
        throw new OllamaClientError(
          "invalid_response",
          "Ollama returned an unexpected response shape. No model output was used.",
        );
      }

      let content: unknown;
      try {
        content = JSON.parse(envelope.data.message.content) as unknown;
      } catch {
        throw new OllamaClientError(
          "malformed_json",
          "The model did not return valid JSON. Its reply was rejected and nothing was used.",
        );
      }

      const parsed = schema.safeParse(content);
      if (!parsed.success) {
        throw new OllamaClientError(
          "invalid_response",
          "The model reply did not match the required schema. It was rejected and nothing was used.",
        );
      }

      return {
        data: parsed.data,
        model: envelope.data.model ?? this.model,
        durationMs: Date.now() - startedAt,
        generatedAt: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abortFromCaller);
    }
  }

  private async translateHttpError(
    response: Response,
  ): Promise<OllamaClientError> {
    let detail = "";
    try {
      const parsed = ollamaErrorSchema.safeParse(await response.json());
      if (parsed.success) detail = parsed.data.error;
    } catch {
      // The status code alone is enough for a safe message.
    }

    if (response.status === 404 && /not found/i.test(detail)) {
      return new OllamaClientError(
        "model_missing",
        `Ollama is running, but ${this.model} is not installed. Run "ollama pull ${this.model}" once, then try again.`,
      );
    }

    return new OllamaClientError(
      "http_error",
      `Ollama responded with status ${response.status}. Check the local service and try again.`,
    );
  }
}
