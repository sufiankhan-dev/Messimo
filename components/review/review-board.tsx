"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  HistoryIcon,
  ListChecksIcon,
  LoaderCircleIcon,
  LockKeyholeIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { ReviewCard } from "@/components/review/review-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import {
  applyReviewDecisions,
  countApprovedActions,
  filterReviewFiles,
  getSafeBulkApprovalIds,
  REVIEW_FILTERS,
  type ReviewFilter,
} from "@/lib/workspace/review";
import {
  applyApprovedBatch,
  countNoChangeApprovals,
  getApprovedOperations,
} from "@/lib/workspace/operations";
import { getReviewCounts } from "@/lib/workspace/summary";
import { cn } from "cn";
import type {
  ApplyProgress,
  ApplyResult,
  OrganizationFile,
  ReviewStatus,
} from "@/types";

const STATUS_PRIORITY: Record<ReviewStatus, number> = {
  "needs-review": 0,
  pending: 1,
  approved: 2,
  rejected: 3,
};

const FILTER_EMPTY_COPY: Record<
  ReviewFilter,
  { title: string; description: string }
> = {
  "needs-review": {
    title: "Nothing needs review",
    description:
      "Every uncertain, duplicate, and unsupported file has a decision in this preview.",
  },
  pending: {
    title: "No pending suggestions",
    description: "There are no undecided suggestions in this filter.",
  },
  approved: {
    title: "No approved suggestions yet",
    description:
      "Approve a suggestion to see it here. Nothing moves until you confirm the batch.",
  },
  rejected: {
    title: "No rejected suggestions",
    description: "Rejected suggestions will be kept here for reference.",
  },
  all: {
    title: "No suggestions",
    description: "The current plan has no suggestions to review.",
  },
};

interface ReviewBoardProps {
  files: OrganizationFile[];
  folderId: string;
  onRescan: () => void;
}

export function ReviewBoard({ files, folderId, onRescan }: ReviewBoardProps) {
  const [decisions, setDecisions] = useState<Record<string, ReviewStatus>>({});
  const [filter, setFilter] = useState<ReviewFilter>("needs-review");
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyProgress, setApplyProgress] = useState<ApplyProgress | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [batchApplied, setBatchApplied] = useState(false);

  const effectiveFiles = useMemo(
    () => applyReviewDecisions(files, decisions),
    [files, decisions],
  );
  const counts = getReviewCounts(effectiveFiles);
  const eligibleIds = useMemo(
    () => new Set(getSafeBulkApprovalIds(effectiveFiles)),
    [effectiveFiles],
  );
  const selectedIds = useMemo(
    () => [...selected].filter((id) => eligibleIds.has(id)),
    [selected, eligibleIds],
  );
  const approvedOperations = useMemo(
    () => getApprovedOperations(effectiveFiles),
    [effectiveFiles],
  );
  const noChangeApprovals = countNoChangeApprovals(effectiveFiles);
  const approvedActions = countApprovedActions(effectiveFiles);
  const selectionLocked = applying || batchApplied;

  const filteredFiles = useMemo(() => {
    return [...filterReviewFiles(effectiveFiles, filter)].sort(
      (a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status],
    );
  }, [effectiveFiles, filter]);

  const filterCounts: Record<ReviewFilter, number> = {
    "needs-review": counts["needs-review"],
    pending: counts.pending,
    approved: counts.approved,
    rejected: counts.rejected,
    all: effectiveFiles.length,
  };

  function decide(fileId: string, status: ReviewStatus) {
    const file = effectiveFiles.find((entry) => entry.id === fileId);
    setDecisions((previous) => ({ ...previous, [fileId]: status }));
    setSelected((previous) => {
      if (status === "pending") return previous;
      const next = new Set(previous);
      next.delete(fileId);
      return next;
    });
    setAnnouncement(
      file
        ? `${file.name} marked ${status === "approved" ? "approved" : "rejected"} in this preview. No file has moved yet.`
        : "Review decision updated in this preview. No file has moved yet.",
    );
  }

  function reset(fileId: string) {
    setDecisions((previous) => {
      const next = { ...previous };
      delete next[fileId];
      return next;
    });
    setSelected((previous) => {
      const next = new Set(previous);
      next.delete(fileId);
      return next;
    });
    setAnnouncement("Decision reset. No files were changed.");
  }

  function toggleSelect(fileId: string, isSelected: boolean) {
    if (!eligibleIds.has(fileId)) return;
    setSelected((previous) => {
      const next = new Set(previous);
      if (isSelected) next.add(fileId);
      else next.delete(fileId);
      return next;
    });
  }

  function selectAllValid() {
    setSelected(new Set(eligibleIds));
    setAnnouncement(
      `${eligibleIds.size} low-risk suggestion${eligibleIds.size === 1 ? "" : "s"} selected. Approve them when you are ready.`,
    );
  }

  function clearSelection() {
    setSelected(new Set());
    setAnnouncement("Batch selection cleared. No files were changed.");
  }

  function approveSelected() {
    const ids = [...selected].filter((id) => eligibleIds.has(id));
    if (ids.length === 0) return;

    setDecisions((previous) => {
      const next = { ...previous };
      for (const id of ids) next[id] = "approved";
      return next;
    });
    setSelected(new Set());
    setAnnouncement(
      `${ids.length} selected suggestion${ids.length === 1 ? "" : "s"} approved in this preview. Nothing has moved yet.`,
    );
  }

  async function applyApproved() {
    if (approvedOperations.length === 0 || !folderId) return;

    setConfirmOpen(false);
    setApplying(true);
    setApplyError(null);
    setApplyResult(null);
    setApplyProgress({
      processed: 0,
      total: approvedOperations.length,
      currentRelativePath: "",
      completed: 0,
      failed: 0,
    });

    try {
      const result = await applyApprovedBatch(
        {
          folderId,
          operations: approvedOperations.map((plan) => plan.operation),
        },
        { onProgress: setApplyProgress },
      );

      setApplyResult(result);
      setBatchApplied(true);
      setAnnouncement(
        result.failed > 0
          ? `The batch finished with ${result.failed} failed operation${result.failed === 1 ? "" : "s"}. Review the result below.`
          : `${result.completed} file${result.completed === 1 ? "" : "s"} organized. Review the result below.`,
      );
    } catch (error) {
      setApplyError(
        error instanceof Error
          ? error.message
          : "The batch could not be completed. Open History before trying again.",
      );
      setBatchApplied(true);
    } finally {
      setApplying(false);
      setApplyProgress(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="gap-0 py-4">
        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <dl className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
              <ReviewStat
                label="Approved"
                value={counts.approved}
                tone="approved"
              />
              <ReviewStat label="Pending" value={counts.pending} tone="pending" />
              <ReviewStat
                label="Needs review"
                value={counts["needs-review"]}
                tone="review"
              />
              <ReviewStat
                label="Rejected"
                value={counts.rejected}
                tone="rejected"
              />
            </dl>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllValid}
                disabled={eligibleIds.size === 0 || selectionLocked}
              >
                <ListChecksIcon aria-hidden="true" />
                Select all valid ({eligibleIds.size})
              </Button>
              <Button
                size="sm"
                onClick={approveSelected}
                disabled={selectedIds.length === 0 || selectionLocked}
              >
                <CheckIcon aria-hidden="true" />
                Approve selected ({selectedIds.length})
              </Button>
              {selected.size > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  disabled={selectionLocked}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </div>

          <p className="text-[11px] leading-5 text-muted-foreground">
            Batch approval is limited to low-uncertainty suggestions with no
            warnings and requires an explicit selection. Everything else stays
            an individual decision.
          </p>
        </div>
      </Card>

      <div
        role="group"
        aria-label="Filter suggestions"
        className="flex flex-wrap items-center gap-1.5"
      >
        {REVIEW_FILTERS.map(({ id, label }) => {
          const active = filter === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(id)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-primary/25 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {label}
              <span className="text-[10px] tabular-nums opacity-70">
                {filterCounts[id]}
              </span>
            </button>
          );
        })}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {announcement ? (
        <Callout tone="success" title="Preview review updated">
          {announcement}
        </Callout>
      ) : null}

      {filteredFiles.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {filteredFiles.map((file) => (
            <ReviewCard
              key={file.id}
              file={file}
              canReset={decisions[file.id] !== undefined}
              selectable={eligibleIds.has(file.id)}
              selected={selected.has(file.id) && eligibleIds.has(file.id)}
              selectionLocked={selectionLocked}
              onSelect={toggleSelect}
              onDecide={decide}
              onReset={reset}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={FILTER_EMPTY_COPY[filter].title}
          description={FILTER_EMPTY_COPY[filter].description}
          icon={CircleCheckIcon}
          action={
            filter !== "all" ? (
              <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
                View all suggestions
              </Button>
            ) : undefined
          }
        />
      )}

      {applying ? (
        <ApplyProgressCard
          progress={applyProgress}
          total={approvedOperations.length}
        />
      ) : null}

      {applyError ? (
        <Card className="gap-0 py-4">
          <div className="space-y-3 px-4">
            <div className="flex items-start gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <TriangleAlertIcon className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">
                  The batch did not report a result
                </p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {applyError}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/history"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "gap-2",
                )}
              >
                <HistoryIcon aria-hidden="true" />
                Open history
              </Link>
              <Button variant="outline" size="sm" onClick={onRescan}>
                <RefreshCwIcon aria-hidden="true" />
                Scan folder again
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {applyResult ? (
        <ApplyResultCard
          result={applyResult}
          onRescan={onRescan}
        />
      ) : null}

      {!applyResult ? (
        <Card className="gap-0 py-4">
          <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <LockKeyholeIcon className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Apply approved changes
                </p>
                <p
                  id="apply-note"
                  className="mt-0.5 text-xs leading-5 text-muted-foreground"
                >
                  {approvedActions} approved suggestion
                  {approvedActions === 1 ? "" : "s"} in this preview
                  {noChangeApprovals > 0
                    ? `, ${noChangeApprovals} of which need no file change`
                    : ""}
                  . Every path is revalidated immediately before its move.
                </p>
              </div>
            </div>

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogTrigger
                render={
                  <Button
                    size="lg"
                    disabled={
                      approvedOperations.length === 0 ||
                      !folderId ||
                      applying ||
                      batchApplied
                    }
                    aria-describedby="apply-note"
                    className="h-9 shrink-0 gap-2"
                  />
                }
              >
                Apply approved ({approvedOperations.length})
                <ArrowRightIcon aria-hidden="true" />
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    Apply {approvedOperations.length} file change
                    {approvedOperations.length === 1 ? "" : "s"}?
                  </DialogTitle>
                  <DialogDescription>
                    This is the final confirmation. SlothSort will revalidate
                    every source and destination immediately before each move.
                  </DialogDescription>
                </DialogHeader>

                <ul className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/40 p-3">
                  {approvedOperations.map((plan) => (
                    <li
                      key={plan.fileId}
                      className="font-mono text-[11px] leading-5"
                    >
                      <span className="block break-all text-foreground">
                        {plan.sourceRelativePath}
                      </span>
                      <span className="flex items-start gap-1 text-muted-foreground">
                        <ArrowRightIcon
                          className="mt-1 size-3 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="break-all">
                          {plan.targetRelativePath}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>

                <Callout tone="warning" title="Nothing is overwritten or deleted">
                  A file that already exists at a destination is never replaced.
                  If a source changed since the preview, that operation fails
                  and other valid operations may still complete. You will see a
                  per-file result and can undo safe changes from History.
                </Callout>

                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    Cancel
                  </DialogClose>
                  <Button onClick={applyApproved}>
                    Apply {approvedOperations.length} change
                    {approvedOperations.length === 1 ? "" : "s"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function ApplyProgressCard({
  progress,
  total,
}: {
  progress: ApplyProgress | null;
  total: number;
}) {
  const processed = progress?.processed ?? 0;
  const count = progress?.total ?? total;
  const percent = count > 0 ? Math.round((processed / count) * 100) : 0;

  return (
    <Card className="gap-0 py-5" aria-busy="true">
      <div className="space-y-4 px-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <LoaderCircleIcon
              className="size-4 animate-spin"
              aria-hidden="true"
            />
          </span>
          <div>
            <h2 className="text-sm font-medium text-foreground">
              Applying approved changes
            </h2>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              Each file is revalidated and verified before its source is
              removed. Existing files are never overwritten.
            </p>
          </div>
        </div>

        <Progress value={percent} className="text-left">
          <div className="flex w-full items-center gap-2">
            <ProgressLabel className="text-xs font-normal text-muted-foreground">
              {processed} of {count} operations
            </ProgressLabel>
            <ProgressValue className="text-xs" />
          </div>
        </Progress>

        <dl className="grid gap-2 text-xs sm:grid-cols-3" aria-live="polite">
          <MiniStat
            label="Completed"
            value={progress?.completed ?? 0}
            tone="approved"
          />
          <MiniStat
            label="Failed"
            value={progress?.failed ?? 0}
            tone="review"
          />
          <MiniStat label="Total" value={count} tone="pending" />
        </dl>

        <p className="text-[11px] leading-5 text-muted-foreground">
          Current:{" "}
          <span className="break-all font-mono text-foreground">
            {progress?.currentRelativePath || "starting"}
          </span>
        </p>
      </div>
    </Card>
  );
}

function ApplyResultCard({
  result,
  onRescan,
}: {
  result: ApplyResult;
  onRescan: () => void;
}) {
  const tone =
    result.failed > 0
      ? "warning"
      : result.completed > 0
        ? "success"
        : "info";
  const title =
    result.failed > 0
      ? `Batch finished with ${result.failed} failed operation${result.failed === 1 ? "" : "s"}`
      : result.completed > 0
        ? `Organized ${result.completed} file${result.completed === 1 ? "" : "s"}`
        : "No files were changed";

  return (
    <Card className="gap-0 py-5">
      <div className="space-y-4 px-5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl",
              result.failed > 0
                ? "bg-amber-100 text-amber-800 dark:bg-amber-300/10 dark:text-amber-200"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-300/10 dark:text-emerald-200",
            )}
          >
            {result.failed > 0 ? (
              <TriangleAlertIcon className="size-4" aria-hidden="true" />
            ) : (
              <CircleCheckIcon className="size-4" aria-hidden="true" />
            )}
          </span>
          <div>
            <h2 className="text-sm font-medium text-foreground">{title}</h2>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              {result.note}
            </p>
          </div>
        </div>

        <Callout tone={tone} title="Recorded result">
          <dl className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="opacity-80">Completed</dt>
              <dd className="text-base font-semibold tabular-nums">
                {result.completed}
              </dd>
            </div>
            <div>
              <dt className="opacity-80">Failed</dt>
              <dd className="text-base font-semibold tabular-nums">
                {result.failed}
              </dd>
            </div>
            <div>
              <dt className="opacity-80">No change</dt>
              <dd className="text-base font-semibold tabular-nums">
                {result.skipped}
              </dd>
            </div>
          </dl>
        </Callout>

        {!result.historyRecorded ? (
          <Callout tone="warning" title="History could not be updated">
            {result.historyError ??
              "Some local history updates failed. Open History before another batch."}
          </Callout>
        ) : null}

        <ul className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/30 p-3">
          {result.items.map((item) => (
            <li
              key={`${item.sourceRelativePath}-${item.targetRelativePath}`}
              className="rounded-lg border border-border/70 bg-background p-2.5"
            >
              <div className="flex items-start gap-2">
                {item.status === "completed" ? (
                  <CircleCheckIcon
                    className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-300"
                    aria-hidden="true"
                  />
                ) : item.status === "failed" ? (
                  <XIcon
                    className="mt-0.5 size-3.5 shrink-0 text-rose-600 dark:text-rose-300"
                    aria-hidden="true"
                  />
                ) : (
                  <CircleDashedIcon
                    className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0 flex-1 font-mono text-[11px] leading-5">
                  <p className="break-all text-foreground">
                    {item.sourceRelativePath}
                  </p>
                  <p className="flex items-start gap-1 text-muted-foreground">
                    <ArrowRightIcon
                      className="mt-1 size-3 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="break-all">{item.targetRelativePath}</span>
                  </p>
                  <p className="mt-1 font-sans text-[11px] text-muted-foreground">
                    {item.status === "completed"
                      ? `Completed with a safe ${item.method === "link" ? "hard link" : "verified copy"}.`
                      : item.status === "skipped"
                        ? "Skipped. Nothing needed to change."
                        : (item.error ?? "Failed. The source was left in place.")}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/history"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-2",
            )}
          >
            <HistoryIcon aria-hidden="true" />
            {result.undoable ? "Review and undo" : "Open history"}
          </Link>
          <Button variant="outline" size="sm" onClick={onRescan}>
            <RefreshCwIcon aria-hidden="true" />
            Scan folder again
          </Button>
        </div>
      </div>
    </Card>
  );
}

const STAT_TONES = {
  approved:
    "bg-emerald-50/70 text-emerald-800 dark:bg-emerald-300/10 dark:text-emerald-200",
  pending:
    "bg-amber-50/70 text-amber-900 dark:bg-amber-300/10 dark:text-amber-200",
  review:
    "bg-rose-50/70 text-rose-800 dark:bg-rose-300/10 dark:text-rose-200",
  rejected: "bg-muted text-muted-foreground",
} as const;

function ReviewStat({
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
