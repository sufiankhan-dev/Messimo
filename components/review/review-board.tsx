"use client";

import { useMemo, useState } from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  CircleCheckIcon,
  LockKeyholeIcon,
  SparklesIcon,
} from "lucide-react";
import { ReviewCard } from "@/components/review/review-card";
import { Button } from "@/components/ui/button";
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
  applyReviewDecisions,
  countApprovedActions,
  filterReviewFiles,
  getSafeBulkApprovalIds,
  REVIEW_FILTERS,
  type ReviewFilter,
} from "@/lib/workspace/review";
import { getReviewCounts } from "@/lib/workspace/summary";
import type { OrganizationFile, ReviewStatus } from "@/types";
import { cn } from "cn";

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
      "Approve a suggestion to see it here. Approvals stay in this preview.",
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

export function ReviewBoard({ files }: { files: OrganizationFile[] }) {
  const [decisions, setDecisions] = useState<Record<string, ReviewStatus>>({});
  const [filter, setFilter] = useState<ReviewFilter>("needs-review");
  const [announcement, setAnnouncement] = useState<string | null>(null);

  const effectiveFiles = useMemo(
    () => applyReviewDecisions(files, decisions),
    [files, decisions],
  );
  const counts = getReviewCounts(effectiveFiles);
  const safeIds = getSafeBulkApprovalIds(effectiveFiles);
  const approvedActions = countApprovedActions(effectiveFiles);

  const filteredFiles = useMemo(() => {
    return [...filterReviewFiles(effectiveFiles, filter)].sort(
      (a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status],
    );
  }, [effectiveFiles, filter]);

  const safeFiles = effectiveFiles.filter((file) => safeIds.includes(file.id));
  const filterCounts: Record<ReviewFilter, number> = {
    "needs-review": counts["needs-review"],
    pending: counts.pending,
    approved: counts.approved,
    rejected: counts.rejected,
    all: files.length,
  };

  function decide(fileId: string, status: ReviewStatus) {
    const file = effectiveFiles.find((entry) => entry.id === fileId);
    setDecisions((previous) => ({ ...previous, [fileId]: status }));
    setAnnouncement(
      file
        ? `${file.name} marked ${status === "approved" ? "approved" : "rejected"} in this preview. No files were changed.`
        : "Review decision updated in this preview. No files were changed.",
    );
  }

  function reset(fileId: string) {
    setDecisions((previous) => {
      const next = { ...previous };
      delete next[fileId];
      return next;
    });
    setAnnouncement("Decision reset. No files were changed.");
  }

  function approveSafeSuggestions() {
    setDecisions((previous) => {
      const next = { ...previous };
      for (const id of safeIds) next[id] = "approved";
      return next;
    });
    setAnnouncement(
      `${safeIds.length} low-uncertainty suggestions approved in this preview. Nothing was moved.`,
    );
  }

  return (
    <div className="space-y-4">
      <Card className="gap-0 py-4">
        <div className="flex flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between">
          <dl className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
            <ReviewStat label="Approved" value={counts.approved} tone="approved" />
            <ReviewStat label="Pending" value={counts.pending} tone="pending" />
            <ReviewStat
              label="Needs review"
              value={counts["needs-review"]}
              tone="review"
            />
            <ReviewStat label="Rejected" value={counts.rejected} tone="rejected" />
          </dl>

          <Dialog>
            <DialogTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeIds.length === 0}
                  className="shrink-0"
                />
              }
            >
              <SparklesIcon aria-hidden="true" />
              Approve safe ({safeIds.length})
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  Approve {safeIds.length} safe suggestions?
                </DialogTitle>
                <DialogDescription>
                  These suggestions have a destination, no warnings, and low
                  uncertainty from the local model.
                </DialogDescription>
              </DialogHeader>

              <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-border bg-muted/40 p-3 text-sm">
                {safeFiles.slice(0, 6).map((file) => (
                  <li key={file.id} className="flex items-center gap-2">
                    <CheckIcon
                      className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-300"
                      aria-hidden="true"
                    />
                    <span className="truncate">{file.name}</span>
                  </li>
                ))}
                {safeFiles.length > 6 ? (
                  <li className="text-xs text-muted-foreground">
                    and {safeFiles.length - 6} more
                  </li>
                ) : null}
              </ul>

              <Callout tone="warning">
                This updates preview decisions only. File operations are not
                implemented in this step, so no file is moved.
              </Callout>

              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  Cancel
                </DialogClose>
                <DialogClose
                  render={<Button onClick={approveSafeSuggestions} />}
                >
                  Approve in preview
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
                {approvedActions} approved in this session. File operations are
                not implemented yet, so approvals are not written to disk.
              </p>
            </div>
          </div>
          <Button
            size="lg"
            disabled
            aria-describedby="apply-note"
            className="h-9 shrink-0 gap-2"
          >
            Apply changes
            <ArrowRightIcon aria-hidden="true" />
          </Button>
        </div>
      </Card>
    </div>
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
