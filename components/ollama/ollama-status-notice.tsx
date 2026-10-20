"use client";

import Link from "next/link";
import { ArrowRightIcon, LoaderCircleIcon, RefreshCwIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import type { OllamaStatusState } from "@/components/ollama/use-ollama-status";
import { cn } from "cn";

interface OllamaStatusNoticeProps {
  state: OllamaStatusState;
  onRefresh: () => void;
  /** Hide the success state when the surrounding card already says it. */
  showConnected?: boolean;
  className?: string;
}

/**
 * Clear, actionable local-inference status. This component never suggests a
 * cloud fallback: the only remedies are starting Ollama, pulling the configured
 * model once, or opening Settings.
 */
export function OllamaStatusNotice({
  state,
  onRefresh,
  showConnected = true,
  className,
}: OllamaStatusNoticeProps) {
  if (state.phase === "loading") {
    return (
      <Callout
        tone="info"
        title="Checking local Ollama"
        className={className}
      >
        <span className="flex items-center gap-2">
          <LoaderCircleIcon
            className="size-3.5 animate-spin"
            aria-hidden="true"
          />
          Reading the installed model list. No prompt or file data is sent.
        </span>
      </Callout>
    );
  }

  if (state.phase === "error") {
    return (
      <Callout
        tone="danger"
        title="Local Ollama status is unavailable"
        className={className}
      >
        <p>{state.message}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCwIcon aria-hidden="true" />
            Check again
          </Button>
          <SettingsLink />
        </div>
      </Callout>
    );
  }

  if (state.status.state === "connected") {
    if (!showConnected) return null;

    return (
      <Callout tone="success" title="Local Gemma is ready" className={className}>
        <p>
          <span className="font-mono">{state.status.selectedModel}</span> is
          installed. Suggestions run on this computer through Ollama.
        </p>
      </Callout>
    );
  }

  if (state.status.state === "model-missing") {
    return (
      <Callout
        tone="warning"
        title={`${state.status.selectedModel} is not installed`}
        className={className}
      >
        <p>
          Ollama is running, but the configured model is missing. With internet
          access, pull it once:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-foreground px-3 py-2 font-mono text-[11px] text-background">
          ollama pull {state.status.selectedModel}
        </pre>
        <p className="mt-2">
          After the download, inference runs offline. SlothSort does not fall
          back to a cloud model.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCwIcon aria-hidden="true" />
            Check again
          </Button>
          <SettingsLink />
        </div>
      </Callout>
    );
  }

  return (
    <Callout
      tone="danger"
      title="Local Ollama is offline"
      className={className}
    >
      <p>
        SlothSort cannot reach <span className="font-mono">{state.status.baseUrl}</span>.
        Start the local service, then check again:
      </p>
      <pre className="mt-2 overflow-x-auto rounded-lg bg-foreground px-3 py-2 font-mono text-[11px] text-background">
        ollama serve
      </pre>
      <p className="mt-2">
        Suggestions are unavailable until Ollama responds. Your files stay
        untouched, and no cloud AI provider is contacted.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCwIcon aria-hidden="true" />
          Check again
        </Button>
        <SettingsLink />
      </div>
    </Callout>
  );
}

function SettingsLink() {
  return (
    <Link
      href="/settings"
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1")}
    >
      Open settings
      <ArrowRightIcon aria-hidden="true" />
    </Link>
  );
}
