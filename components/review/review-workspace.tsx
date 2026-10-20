"use client";

import { useMemo } from "react";
import {
  FolderOpenIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import { FolderPickerDialog } from "@/components/dashboard/folder-picker-dialog";
import { ScanProgressCard } from "@/components/files/scan-feedback";
import { ReviewBoard } from "@/components/review/review-board";
import { useScanWorkspace } from "@/components/scan/scan-workspace-provider";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { formatDateTime, pluralize } from "@/lib/format";
import type { OrganizationPlan } from "@/types";
import { planToOrganizationFiles } from "@/lib/workspace/plan";
import { cn } from "cn";

const MAX_PLAN_FILES = 24;

export function ReviewWorkspace() {
  const {
    folder,
    result,
    progress,
    status,
    error,
    plan,
    planStatus,
    planProgress,
    planError,
    scan,
    cancelScan,
    generatePlan,
    cancelPlan,
  } = useScanWorkspace();

  const planFiles = useMemo(
    () => (plan ? planToOrganizationFiles(plan) : []),
    [plan],
  );
  const supportedFiles = useMemo(
    () => result?.files.filter((file) => file.kind !== "other") ?? [],
    [result],
  );
  const unsupportedCount = (result?.files.length ?? 0) - supportedFiles.length;
  const scanning =
    status === "initializing" ||
    status === "selecting" ||
    status === "scanning";

  if (!result) {
    return (
      <div className="space-y-4">
        {status === "scanning" ? (
          <ScanProgressCard
            folderName={folder?.name ?? "folder"}
            progress={progress}
            onCancel={cancelScan}
          />
        ) : null}

        {status === "error" ? (
          <ErrorState
            title="The scan could not finish"
            description={
              error ??
              "The local scan endpoint did not respond. No files were changed."
            }
            action={
              folder ? (
                <Button variant="outline" size="sm" onClick={scan}>
                  Try again
                </Button>
              ) : (
                <FolderPickerDialog
                  triggerLabel="Choose folder"
                  triggerSize="sm"
                />
              )
            }
          />
        ) : null}

        {scanning ? (
          <div
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-10 text-sm text-muted-foreground"
            role="status"
          >
            <LoaderCircleIcon
              className="size-4 animate-spin"
              aria-hidden="true"
            />
            Restoring the last approved folder…
          </div>
        ) : (
          <EmptyState
            title="Scan a folder first"
            description="Review shows real suggestions from the files in one approved folder. Choose a folder such as Downloads, run the read-only scan, then generate suggestions with local Gemma."
            icon={FolderOpenIcon}
            action={
              <FolderPickerDialog triggerLabel="Choose folder" triggerSize="sm" />
            }
          />
        )}
      </div>
    );
  }

  const planning = planStatus === "planning";

  return (
    <div className="space-y-4">
      <Card className="gap-0 py-4">
        <CardContent className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate font-mono text-xs text-foreground">
              {folder?.displayPath ?? "Approved folder"}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {pluralize(result.files.length, "file")} scanned ·{" "}
              {pluralize(supportedFiles.length, "supported file")}
              {unsupportedCount > 0
                ? ` · ${unsupportedCount} unsupported excluded`
                : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <FolderPickerDialog
              triggerLabel="Change folder"
              triggerVariant="outline"
              triggerSize="sm"
            />
            <Button
              variant={plan ? "outline" : "default"}
              size="sm"
              onClick={planning ? cancelPlan : generatePlan}
              disabled={
                !planning &&
                (supportedFiles.length === 0 || status === "scanning")
              }
            >
              {planning ? (
                <>
                  <LoaderCircleIcon
                    className="size-3.5 animate-spin"
                    aria-hidden="true"
                  />
                  Cancel plan
                </>
              ) : (
                <>
                  <SparklesIcon className="size-3.5" aria-hidden="true" />
                  {plan ? "Generate again" : "Generate suggestions"}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {planning ? (
        <PlanProgressCard
          progress={planProgress}
          onCancel={cancelPlan}
        />
      ) : null}

      {planStatus === "error" ? (
        <ErrorState
          title="Suggestions could not be generated"
          description={
            planError ??
            "The local model did not answer. Check Ollama and try again. No files were changed."
          }
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={generatePlan}
                disabled={supportedFiles.length === 0}
              >
                <RefreshCwIcon aria-hidden="true" />
                Try again
              </Button>
              <Button variant="ghost" size="sm" onClick={scan}>
                Scan again
              </Button>
            </div>
          }
        />
      ) : null}

      {planStatus === "cancelled" ? (
        <Callout tone="warning" title="Planning cancelled">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>
              No suggestion was applied. Files already read stay untouched, and
              nothing was moved or renamed.
            </p>
            <Button variant="outline" size="sm" onClick={generatePlan}>
              Try again
            </Button>
          </div>
        </Callout>
      ) : null}

      {!plan && !planning && planStatus !== "error" ? (
        <GenerateCard
          supportedCount={supportedFiles.length}
          unsupportedCount={unsupportedCount}
          onGenerate={generatePlan}
        />
      ) : null}

      {plan ? (
        <>
          <PlanSummary plan={plan} />
          <ReviewBoard
            files={planFiles}
            folderId={folder?.id ?? ""}
            onRescan={scan}
          />
        </>
      ) : null}
    </div>
  );
}

function PlanProgressCard({
  progress,
  onCancel,
}: {
  progress: {
    completed: number;
    total: number;
    currentFile: string;
    ready: number;
    needsReview: number;
    failed: number;
  } | null;
  onCancel: () => void;
}) {
  const completed = progress?.completed ?? 0;
  const total = progress?.total ?? 0;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Card className="gap-0 py-5" aria-busy="true">
      <CardContent className="space-y-4 px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <LoaderCircleIcon
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            </span>
            <div>
              <h2 className="text-sm font-medium text-foreground">
                Asking local Gemma for suggestions
              </h2>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                Inference runs on this computer through Ollama. No cloud service
                is used.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel plan
          </Button>
        </div>

        <Progress value={percent} className="text-left">
          <div className="flex w-full items-center gap-2">
            <ProgressLabel className="text-xs font-normal text-muted-foreground">
              {completed} of {total} files
            </ProgressLabel>
            <ProgressValue className="text-xs" />
          </div>
        </Progress>

        <dl className="grid gap-2 text-xs sm:grid-cols-3" aria-live="polite">
          <MiniStat label="Ready" value={progress?.ready ?? 0} tone="ready" />
          <MiniStat
            label="Needs review"
            value={progress?.needsReview ?? 0}
            tone="review"
          />
          <MiniStat label="Failed" value={progress?.failed ?? 0} tone="failed" />
        </dl>

        <p className="text-[11px] leading-5 text-muted-foreground">
          Current:{" "}
          <span className="break-all font-mono text-foreground">
            {progress?.currentFile || "waiting for the first file"}
          </span>
          . The first request can take longer while the model loads.
        </p>
      </CardContent>
    </Card>
  );
}

function GenerateCard({
  supportedCount,
  unsupportedCount,
  onGenerate,
}: {
  supportedCount: number;
  unsupportedCount: number;
  onGenerate: () => void;
}) {
  const hasFiles = supportedCount > 0;

  return (
    <Card className="gap-0 py-5">
      <CardHeader className="px-5">
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-primary" aria-hidden="true" />
          Generate a real preview plan
        </CardTitle>
        <CardDescription>
          Local Gemma reads approved document text and metadata, then suggests a
          category, filename, folder, reason, and uncertainty for each file.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pt-4">
        <ul className="space-y-2 text-xs leading-5 text-muted-foreground">
          {[
            `Up to ${MAX_PLAN_FILES} supported files per run. This scan has ${supportedCount}.`,
            unsupportedCount > 0
              ? `${unsupportedCount} unsupported file${unsupportedCount === 1 ? "" : "s"} will not be sent to the model.`
              : "Unsupported types are never sent to the model.",
            "Text extraction is limited to small PDF, DOCX, and plain-text files. Images and archives are classified from metadata only.",
            "Hashes, filename sanitization, destination allowlists, and conflict checks are deterministic code, never model output.",
            "Nothing is moved, renamed, or deleted. This step only creates a preview.",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <ShieldCheckIcon
                className="mt-0.5 size-3.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              {item}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onGenerate} disabled={!hasFiles}>
            <SparklesIcon aria-hidden="true" />
            Generate with local Gemma
          </Button>
          {!hasFiles ? (
            <p className="text-xs text-muted-foreground">
              This scan has no supported files. Choose another folder.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function PlanSummary({ plan }: { plan: OrganizationPlan }) {
  return (
    <>
      <Card className="gap-0 py-4">
        <CardContent className="space-y-3 px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">
              Preview generated by{" "}
              <span className="font-mono text-xs">{plan.model}</span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              {formatDateTime(plan.generatedAt)} · {plan.durationMs} ms
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Ready" value={plan.totals.ready} tone="ready" />
            <MiniStat
              label="Needs review"
              value={plan.totals.needsReview}
              tone="review"
            />
            <MiniStat
              label="Failed"
              value={plan.totals.failed}
              tone="failed"
            />
            <MiniStat
              label="Exact duplicates"
              value={plan.totals.exactDuplicates}
              tone="review"
            />
          </dl>

          {plan.truncated ? (
            <Callout tone="warning" title="Batch limit reached">
              {plan.truncationReason ??
                "Only part of the folder was analyzed in this batch."}
            </Callout>
          ) : null}

          <Callout tone="info" title="Preview only">
            These suggestions are model output, not facts. Review each one. No
            file has been moved, renamed, or deleted in this step.
          </Callout>
        </CardContent>
      </Card>
    </>
  );
}

const STAT_TONES = {
  ready:
    "bg-emerald-50/70 text-emerald-800 dark:bg-emerald-300/10 dark:text-emerald-200",
  review:
    "bg-amber-50/70 text-amber-900 dark:bg-amber-300/10 dark:text-amber-200",
  failed: "bg-rose-50/70 text-rose-800 dark:bg-rose-300/10 dark:text-rose-200",
} as const;

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: keyof typeof STAT_TONES;
}) {
  return (
    <div className={cn("rounded-lg px-3 py-2", STAT_TONES[tone])}>
      <dt className="text-[11px] opacity-80">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
