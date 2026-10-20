"use client";

import { useCallback, useEffect, useState } from "react";
import { ollamaStatusSchema } from "@/lib/validation/ollama";
import type { OllamaStatus } from "@/types";

export type OllamaStatusState =
  | { phase: "loading" }
  | { phase: "ready"; status: OllamaStatus }
  | { phase: "error"; message: string };

const FALLBACK_ERROR_MESSAGE =
  "The local status endpoint did not respond. The app server may not be running.";

/**
 * Fetches the local Ollama health endpoint. Only model metadata is requested;
 * no prompt and no file data are sent. The endpoint never falls back to a cloud
 * provider.
 */
async function requestStatus(signal?: AbortSignal): Promise<OllamaStatus> {
  const response = await fetch("/api/ollama/status", {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error("Ollama status request failed");
  }

  const parsed = ollamaStatusSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Unexpected Ollama status payload");
  }

  return parsed.data;
}

export function useOllamaStatus() {
  const [state, setState] = useState<OllamaStatusState>({ phase: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    requestStatus(controller.signal)
      .then((status) => {
        if (active) setState({ phase: "ready", status });
      })
      .catch(() => {
        if (active) {
          setState({ phase: "error", message: FALLBACK_ERROR_MESSAGE });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const refresh = useCallback(() => {
    setState({ phase: "loading" });

    requestStatus()
      .then((status) => setState({ phase: "ready", status }))
      .catch(() =>
        setState({ phase: "error", message: FALLBACK_ERROR_MESSAGE }),
      );
  }, []);

  return { state, refresh };
}
