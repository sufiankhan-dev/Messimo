import {
  ollamaErrorStatus,
  runOllamaDiagnostic,
} from "@/lib/ai/diagnostic";
import { OllamaClientError } from "@/lib/ai/ollama-client";
import { apiError, noStoreJson } from "@/lib/server/api-response";
import { validateLocalRequest } from "@/lib/server/local-request";

/**
 * Runs one fixed, synthetic prompt through the local Gemma model.
 *
 * There is deliberately no request body: the browser cannot choose the prompt,
 * the destination, or the endpoint. Model output is validated with Zod inside
 * `runOllamaDiagnostic` before it reaches this response.
 */
export async function POST(request: Request): Promise<Response> {
  const local = validateLocalRequest(request);
  if (!local.ok) {
    return apiError(local.status, local.code, local.message);
  }

  try {
    const result = await runOllamaDiagnostic();
    return noStoreJson(result);
  } catch (error) {
    if (error instanceof OllamaClientError) {
      return apiError(
        ollamaErrorStatus(error.code),
        error.code,
        error.message,
      );
    }

    return apiError(
      500,
      "diagnostic_failed",
      "The local inference test failed unexpectedly. No files were read or changed.",
    );
  }
}
