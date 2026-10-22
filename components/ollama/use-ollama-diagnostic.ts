"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ollamaDiagnosticResultSchema,
  ollamaErrorResponseSchema,
} from "@/lib/validation/ollama";
import type { OllamaDiagnostic } from "@/types";

export type OllamaDiagnosticState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "success"; result: OllamaDiagnostic }
  | { phase: "error"; code: string | null; message: string };

const CLIENT_TIMEOUT_MS = 70_000;

const SERVER_UNREACHABLE_MESSAGE =
  "The local Messimo server did not answer. Check that the app is still running.";
const REQUEST_TIMEOUT_MESSAGE =
  "The local inference test took too long. The model may still be loading; try again.";
const INVALID_PAYLOAD_MESSAGE =
  "The local server returned an unexpected test result. Nothing was used.";

/**
 * Calls the server-side diagnostic endpoint. This hook never talks to Ollama
 * directly and never sends a prompt or a file path from the browser.
 */
export function useOllamaDiagnostic() {
  const [state, setState] = useState<OllamaDiagnosticState>({ phase: "idle" });
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      activeRequest.current?.abort();
    };
  }, []);

  const run = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    setState({ phase: "running" });

    try {
      const response = await fetch("/api/ollama/diagnostic", {
        method: "POST",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      const body: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const parsed = ollamaErrorResponseSchema.safeParse(body);
        setState({
          phase: "error",
          code: parsed.success ? parsed.data.error.code : null,
          message: parsed.success
            ? parsed.data.error.message
            : INVALID_PAYLOAD_MESSAGE,
        });
        return;
      }

      const parsed = ollamaDiagnosticResultSchema.safeParse(body);
      if (!parsed.success) {
        setState({
          phase: "error",
          code: "invalid_payload",
          message: INVALID_PAYLOAD_MESSAGE,
        });
        return;
      }

      setState({ phase: "success", result: parsed.data });
    } catch {
      setState({
        phase: "error",
        code: controller.signal.aborted ? "timeout" : null,
        message: controller.signal.aborted
          ? REQUEST_TIMEOUT_MESSAGE
          : SERVER_UNREACHABLE_MESSAGE,
      });
    } finally {
      clearTimeout(timer);
      if (activeRequest.current === controller) {
        activeRequest.current = null;
      }
    }
  }, []);

  return { state, run };
}
