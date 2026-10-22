"use client";

import {
  CpuIcon,
  FlaskConicalIcon,
  LoaderCircleIcon,
  PlayIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { CategoryBadge } from "@/components/files/category-badge";
import { ConfidenceBadge } from "@/components/files/confidence-badge";
import { useOllamaDiagnostic } from "@/components/ollama/use-ollama-diagnostic";
import { useOllamaStatus } from "@/components/ollama/use-ollama-status";
import { formatBytes, formatDateTime } from "@/lib/format";

const ERROR_TITLES: Record<string, string> = {
  unavailable: "The local model is not reachable",
  timeout: "The model did not answer in time",
  model_missing: "The selected model is not installed",
  unsafe_endpoint: "The configured endpoint is not local",
  malformed_json: "The model returned invalid JSON",
  invalid_response: "The model reply failed validation",
  http_error: "Ollama returned an error",
};

export function OllamaDiagnosticCard() {
  const { state: statusState } = useOllamaStatus();
  const { state, run } = useOllamaDiagnostic();

  const status = statusState.phase === "ready" ? statusState.status : null;
  const ready = status?.state === "connected";
  const running = state.phase === "running";

  let gate: string | null = null;
  if (statusState.phase === "loading") {
    gate = "Checking the local Ollama service before running the test.";
  } else if (statusState.phase === "error") {
    gate =
      "The local status check failed, so the test is disabled. Check the card above.";
  } else if (status?.state === "unreachable") {
    gate =
      "Start Ollama with \"ollama serve\", then re-run the connection check above.";
  } else if (status?.state === "model-missing") {
    gate = `Pull ${status.selectedModel} once with internet access, then re-run the connection check above.`;
  }

  const result = state.phase === "success" ? state.result : null;

  return (
    <Card className="gap-0 py-5">
      <CardHeader className="px-5">
        <CardTitle className="flex items-center gap-2">
          <FlaskConicalIcon
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          Local inference test
        </CardTitle>
        <CardDescription>
          Sends one fixed synthetic sample to the selected Gemma model and
          validates the JSON that comes back.
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            size="sm"
            onClick={run}
            disabled={!ready || running}
          >
            {running ? (
              <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
            ) : (
              <PlayIcon aria-hidden="true" />
            )}
            {running ? "Running…" : "Run test prompt"}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pt-4">
        {gate ? (
          <Callout tone="info" title="Test unavailable">
            {gate}
          </Callout>
        ) : null}

        <div className="rounded-xl border border-border bg-muted/25 p-3.5">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Synthetic sample
          </p>
          <p className="mt-1.5 truncate font-mono text-xs text-foreground">
            {result?.sample.fileName ?? "northwind-invoice-2026-03-final-copy.pdf"}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            {result
              ? `${result.sample.detectedType} · ${formatBytes(result.sample.sizeBytes)} · modified ${formatDateTime(result.sample.modifiedAt)} UTC`
              : "document · 47 KB · synthetic metadata only. No real file or file contents are read."}
          </p>
        </div>

        {running ? (
          <Callout tone="info" title="Thinking locally">
            <span
              className="flex items-center gap-2"
              aria-live="polite"
            >
              <LoaderCircleIcon
                className="size-3.5 animate-spin"
                aria-hidden="true"
              />
              The first test can take several seconds while the model loads into
              memory.
            </span>
          </Callout>
        ) : null}

        {state.phase === "error" ? (
          <ErrorState
            title={ERROR_TITLES[state.code ?? ""] ?? "The test failed"}
            description={state.message}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={run}
                disabled={!ready}
              >
                Try again
              </Button>
            }
          />
        ) : null}

        {result ? (
          <div className="space-y-3" aria-live="polite">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-200"
              >
                Validated response
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                <CpuIcon
                  className="mr-1 inline size-3 align-[-2px]"
                  aria-hidden="true"
                />
                {result.model}
                {result.runtimeVersion ? ` · Ollama ${result.runtimeVersion}` : ""}{" "}
                · {(result.durationMs / 1000).toFixed(1)}s
              </span>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/70 px-3 py-2.5">
                <dt className="text-[11px] text-muted-foreground">Category</dt>
                <dd className="mt-1">
                  <CategoryBadge category={result.suggestion.category} />
                </dd>
              </div>
              <div className="rounded-lg border border-border/70 px-3 py-2.5">
                <dt className="text-[11px] text-muted-foreground">
                  Uncertainty
                </dt>
                <dd className="mt-1">
                  <ConfidenceBadge uncertainty={result.suggestion.uncertainty} />
                </dd>
              </div>
              <div className="rounded-lg border border-border/70 px-3 py-2.5">
                <dt className="text-[11px] text-muted-foreground">
                  Suggested filename
                </dt>
                <dd className="mt-0.5 truncate font-mono text-xs text-foreground">
                  {result.suggestion.suggestedFileName}
                </dd>
              </div>
              <div className="rounded-lg border border-border/70 px-3 py-2.5">
                <dt className="text-[11px] text-muted-foreground">
                  Suggested destination
                </dt>
                <dd className="mt-0.5 truncate font-mono text-xs text-foreground">
                  {result.suggestion.suggestedRelativePath}
                </dd>
              </div>
            </dl>

            {result.extensionNormalized ? (
              <p className="text-[11px] leading-5 text-amber-700 dark:text-amber-300">
                The model omitted the original extension, so Messimo restored{" "}
                <span className="font-mono">{result.sample.extension}</span>{" "}
                before validation.
              </p>
            ) : null}

            <div className="rounded-lg border border-border/70 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">Reason</p>
              <p className="mt-1 text-xs leading-5 text-foreground">
                {result.suggestion.reason}
              </p>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Validated {formatDateTime(result.generatedAt)} UTC. This is a
              suggestion from a small local model, not a verified fact, and it
              was not applied to any file.
            </p>
          </div>
        ) : null}

        <p className="flex items-start gap-2 border-t border-border/60 pt-3 text-[11px] leading-5 text-muted-foreground">
          <ShieldCheckIcon
            className="mt-0.5 size-3.5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <span>
            The prompt is fixed on the server and only this computer is
            contacted. The reply is treated as untrusted data, validated with
            Zod, and never executed as instructions.
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
