"use client";

import Link from "next/link";
import { ChevronRightIcon, LoaderCircleIcon } from "lucide-react";
import { useOllamaStatus } from "@/components/ollama/use-ollama-status";
import { cn } from "cn";

type IndicatorTone = "ok" | "warn" | "bad" | "muted";

const TONE_CLASSES: Record<IndicatorTone, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-rose-500",
  muted: "bg-muted-foreground/40",
};

export function OllamaIndicator() {
  const { state } = useOllamaStatus();

  let tone: IndicatorTone = "muted";
  let title = "Checking Ollama…";
  let detail = "Local inference status";
  let loading = true;

  if (state.phase === "error") {
    tone = "bad";
    title = "Status unavailable";
    detail = "Could not reach the local check";
    loading = false;
  } else if (state.phase === "ready") {
    loading = false;
    if (state.status.state === "connected") {
      tone = "ok";
      title = "Ollama ready";
      detail = state.status.selectedModel;
    } else if (state.status.state === "model-missing") {
      tone = "warn";
      title = "Model not installed";
      detail = state.status.selectedModel;
    } else {
      tone = "bad";
      title = "Ollama unavailable";
      detail = "Local service not detected";
    }
  }

  return (
    <Link
      href="/settings"
      className="group flex items-center gap-3 rounded-xl border border-sidebar-border bg-card/70 px-3 py-2.5 text-left transition-colors hover:bg-card focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      aria-label={`${title}. ${detail}. Open local AI settings.`}
    >
      <span className="relative flex size-2.5 shrink-0" aria-hidden="true">
        {loading ? (
          <LoaderCircleIcon className="size-2.5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <span
              className={cn(
                "absolute inline-flex size-full rounded-full opacity-40",
                TONE_CLASSES[tone],
              )}
            />
            <span
              className={cn(
                "relative inline-flex size-2.5 rounded-full",
                TONE_CLASSES[tone],
              )}
            />
          </>
        )}
      </span>
      <span className="min-w-0 flex-1" aria-live="polite">
        <span className="block truncate text-xs font-medium text-sidebar-foreground">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
          {detail}
        </span>
      </span>
      <ChevronRightIcon
        className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}
