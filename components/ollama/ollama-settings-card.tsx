"use client";

import { LoaderCircleIcon, RefreshCwIcon, ShieldCheckIcon } from "lucide-react";
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
import { useOllamaStatus } from "@/components/ollama/use-ollama-status";
import { formatDateTime } from "@/lib/format";
import { cn } from "cn";

type Tone = "ok" | "warn" | "bad" | "muted";

const DOT_CLASSES: Record<Tone, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-rose-500",
  muted: "bg-muted-foreground/50",
};

const BADGE_CLASSES: Record<Tone, string> = {
  ok: "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-200",
  warn: "border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-200",
  bad: "border-rose-200/80 bg-rose-50 text-rose-800 dark:border-rose-300/20 dark:bg-rose-300/10 dark:text-rose-200",
  muted: "border-border bg-muted text-muted-foreground",
};

interface OllamaSettingsCardProps {
  baseUrl: string;
  selectedModel: string;
}

export function OllamaSettingsCard({
  baseUrl,
  selectedModel,
}: OllamaSettingsCardProps) {
  const { state, refresh } = useOllamaStatus();
  const loading = state.phase === "loading";
  const status = state.phase === "ready" ? state.status : null;

  let tone: Tone = "muted";
  let label = "Checking local Ollama…";
  let message = "Reading the installed model list. No prompts are sent.";

  if (state.phase === "error") {
    tone = "bad";
    label = "Status check failed";
    message = state.message;
  } else if (status) {
    if (status.state === "connected") {
      tone = "ok";
      label = "Ollama is running";
      message = status.message;
    } else if (status.state === "model-missing") {
      tone = "warn";
      label = "Model not installed";
      message = status.message;
    } else {
      tone = "bad";
      label = "Ollama is not reachable";
      message = status.message;
    }
  }

  const resolvedBaseUrl = status?.baseUrl ?? baseUrl;
  const resolvedModel = status?.selectedModel ?? selectedModel;
  const installedModels = status?.installedModels ?? [];

  return (
    <Card className="gap-0 py-5">
      <CardHeader className="px-5">
        <CardTitle>Ollama connection</CardTitle>
        <CardDescription>
          A live health check of the local inference service.
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
          >
            {loading ? (
              <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCwIcon aria-hidden="true" />
            )}
            Check again
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pt-4">
        <div
          className="flex items-start gap-3 rounded-xl border border-border bg-muted/25 p-3.5"
          aria-live="polite"
        >
          <span className="relative mt-1 flex size-2.5 shrink-0" aria-hidden="true">
            <span
              className={cn(
                "absolute inline-flex size-full rounded-full opacity-40",
                DOT_CLASSES[tone],
              )}
            />
            <span
              className={cn(
                "relative inline-flex size-2.5 rounded-full",
                DOT_CLASSES[tone],
              )}
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">{label}</p>
              {status ? (
                <Badge
                  variant="outline"
                  className={cn("font-medium", BADGE_CLASSES[tone])}
                >
                  {status.state === "connected"
                    ? "Connected"
                    : status.state === "model-missing"
                      ? "Model missing"
                      : "Unavailable"}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {message}
            </p>
            {status?.checkedAt ? (
              <p className="mt-1 text-[11px] text-muted-foreground/80">
                Checked {formatDateTime(status.checkedAt)}
              </p>
            ) : null}
          </div>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/70 px-3 py-2.5">
            <dt className="text-[11px] text-muted-foreground">Endpoint</dt>
            <dd className="mt-0.5 truncate font-mono text-xs text-foreground">
              {resolvedBaseUrl}
            </dd>
            {status?.runtimeVersion ? (
              <dd className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                Ollama {status.runtimeVersion}
              </dd>
            ) : null}
          </div>
          <div className="rounded-lg border border-border/70 px-3 py-2.5">
            <dt className="text-[11px] text-muted-foreground">
              Selected model
            </dt>
            <dd className="mt-0.5 truncate font-mono text-xs text-foreground">
              {resolvedModel}
            </dd>
          </div>
        </dl>

        <div>
          <p className="text-[11px] text-muted-foreground">Installed models</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {installedModels.length > 0 ? (
              installedModels.map((model) => (
                <Badge
                  key={model}
                  variant="outline"
                  className={cn(
                    "font-mono text-[11px] font-normal",
                    model === resolvedModel &&
                      "border-primary/25 bg-primary/10 text-primary",
                  )}
                >
                  {model}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">
                {loading ? "Checking…" : "No models reported"}
              </span>
            )}
          </div>
        </div>

        {state.phase === "error" ? (
          <ErrorState
            title="Could not check Ollama"
            description={state.message}
            action={
              <Button variant="outline" size="sm" onClick={refresh}>
                Retry
              </Button>
            }
          />
        ) : null}

        {status?.state === "model-missing" ? (
          <Callout tone="warning" title="Pull the selected model once">
            <p>
              Ollama is working, but the model is missing. With internet access,
              run:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-foreground px-3 py-2 font-mono text-[11px] text-background">
              ollama pull {resolvedModel}
            </pre>
            <p className="mt-2">
              After the download, inference runs entirely on this machine.
            </p>
          </Callout>
        ) : null}

        {status?.state === "unreachable" ? (
          <Callout tone="danger" title="Start the local Ollama service">
            <p>SlothSort never falls back to a cloud AI provider. Run:</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-foreground px-3 py-2 font-mono text-[11px] text-background">
              ollama serve
            </pre>
            <p className="mt-2">
              Then pull {resolvedModel} if it is not installed, and check again.
            </p>
          </Callout>
        ) : null}

        {status?.state === "connected" ? (
          <Callout tone="success" title="Local model is available">
            The check above reads the model list only. Use the local inference
            test below to send one fixed synthetic prompt and validate the
            model&apos;s JSON reply.
          </Callout>
        ) : null}

        <p className="flex items-start gap-2 border-t border-border/60 pt-3 text-[11px] leading-5 text-muted-foreground">
          <ShieldCheckIcon
            className="mt-0.5 size-3.5 shrink-0 text-primary"
            aria-hidden="true"
          />
          Only a request to <span className="font-mono">{resolvedBaseUrl}</span>{" "}
          is made. No filenames, prompts, or file contents are sent, and there is
          no remote fallback.
        </p>
      </CardContent>
    </Card>
  );
}
