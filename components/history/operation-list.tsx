"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  CircleCheckIcon,
  FilePenLineIcon,
  FolderInputIcon,
  HistoryIcon,
  LoaderCircleIcon,
  MinusIcon,
  RotateCcwIcon,
  WorkflowIcon,
  XIcon,
} from "lucide-react";
import { OperationStatusBadge } from "@/components/files/operation-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
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
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, pluralize } from "@/lib/format";
import { requestUndo } from "@/lib/workspace/operations";
import type {
  OperationItem,
  OperationItemStatus,
  OperationKind,
  OperationRecord,
  UndoResult,
} from "@/types";
import { cn } from "cn";

const KIND_ICONS: Record<OperationKind, typeof FolderInputIcon> = {
  move: FolderInputIcon,
  rename: FilePenLineIcon,
  mixed: WorkflowIcon,
};

const ITEM_STATUS_LABELS: Record<OperationItemStatus, string> = {
  completed: "Moved or renamed",
  failed: "Failed; the source was kept in place",
  skipped: "No change was needed",
};

export function OperationList({ records }: { records: OperationRecord[] }) {
  if (records.length === 0) {
    return (
      <EmptyState
        title="No operations yet"
        description="Once you confirm a batch on the Review page, each applied move or rename is recorded here with its per-file result, timestamps, and undo details."
        icon={HistoryIcon}
        action={
          <Link
            href="/review"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-2",
            )}
          >
            Review suggestions
            <ArrowRightIcon aria-hidden="true" />
          </Link>
        }
      />
    );
  }

  return (
    <ol className="space-y-3" aria-label="Recorded operation batches">
      {records.map((record) => {
        const Icon = KIND_ICONS[record.kind];
        const detailsOpen = record.items.length <= 4;

        return (
          <li key={record.id}>
            <Card className="gap-0 overflow-hidden py-0">
              <div className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-medium text-foreground">
                        {record.summary}
                      </h2>
                      <OperationStatusBadge
                        status={record.status}
                        interrupted={record.interrupted}
                      />
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/85">
                        {record.folderName}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Started {formatDateTime(record.appliedAt)}</span>
                      {record.updatedAt !== record.appliedAt ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            {record.interrupted ? "Last updated" : "Finished"}{" "}
                            {formatDateTime(record.updatedAt)}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <RecordCount
                    label="Changed"
                    value={record.changedCount}
                    tone="completed"
                  />
                  <RecordCount
                    label="Failed"
                    value={record.failedCount}
                    tone="failed"
                  />
                  <RecordCount
                    label="No change"
                    value={record.skippedCount}
                    tone="neutral"
                  />
                </dl>

                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {record.note}
                </p>

                <details
                  open={detailsOpen}
                  className="group mt-3 rounded-xl border border-border/70 bg-muted/25"
                >
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs font-medium text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                    <span>File details</span>
                    <span className="font-normal text-muted-foreground">
                      {pluralize(record.items.length, "recorded item")}
                    </span>
                  </summary>

                  {record.items.length > 0 ? (
                    <ul className="divide-y divide-border/60 border-t border-border/60 px-3">
                      {record.items.map((item) => (
                        <OperationItemRow
                          key={`${item.from}-${item.to}`}
                          item={item}
                        />
                      ))}
                    </ul>
                  ) : (
                    <p className="border-t border-border/60 px-3 py-3 text-xs text-muted-foreground">
                      No per-file result was recorded for this batch.
                    </p>
                  )}
                </details>

                {record.undoAttemptedAt ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Last undo attempt:{" "}
                    {formatDateTime(record.undoAttemptedAt)}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11px] leading-5 text-muted-foreground">
                    {record.undoable
                      ? "Undo will verify each file's identity and every original path before restoring anything."
                      : (record.undoUnavailableReason ??
                        "Undo is not available for this operation.")}
                  </p>
                  {record.undoable ? (
                    <UndoDialog record={record} />
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                      <RotateCcwIcon className="size-3" aria-hidden="true" />
                      Undo unavailable
                    </span>
                  )}
                </div>
              </div>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}

function RecordCount({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "completed" | "failed" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-lg px-2.5 py-2",
        tone === "failed" && value > 0
          ? "bg-rose-50/80 text-rose-800 dark:bg-rose-300/10 dark:text-rose-200"
          : tone === "completed" && value > 0
            ? "bg-emerald-50/70 text-emerald-800 dark:bg-emerald-300/10 dark:text-emerald-200"
            : "bg-background text-muted-foreground",
      )}
    >
      <dt className="text-[11px] opacity-80">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function OperationItemRow({ item }: { item: OperationItem }) {
  const status = item.status ?? "completed";
  const samePath = item.from === item.to;

  return (
    <li className="py-2.5">
      <div className="flex items-start gap-2">
        <ItemStatusIcon status={status} />
        <div className="min-w-0 flex-1 font-mono text-[11px] leading-5">
          <p className="break-all text-foreground">{item.from}</p>
          {samePath ? null : (
            <p className="flex items-start gap-1 text-muted-foreground">
              <ArrowRightIcon
                className="mt-1 size-3 shrink-0"
                aria-hidden="true"
              />
              <span className="break-all">{item.to}</span>
            </p>
          )}
          <p
            className={cn(
              "mt-1 font-sans text-[11px]",
              status === "failed"
                ? "text-rose-700 dark:text-rose-300"
                : "text-muted-foreground",
            )}
          >
            {ITEM_STATUS_LABELS[status]}
            {item.error ? ` — ${item.error}` : ""}
          </p>
        </div>
      </div>
    </li>
  );
}

function ItemStatusIcon({ status }: { status: OperationItemStatus }) {
  if (status === "completed") {
    return (
      <CircleCheckIcon
        className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-300"
        aria-hidden="true"
      />
    );
  }
  if (status === "failed") {
    return (
      <XIcon
        className="mt-0.5 size-3.5 shrink-0 text-rose-600 dark:text-rose-300"
        aria-hidden="true"
      />
    );
  }
  return (
    <MinusIcon
      className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
      aria-hidden="true"
    />
  );
}

function UndoDialog({ record }: { record: OperationRecord }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<UndoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const restorable = record.items.filter(
    (item) => item.status === "completed",
  );
  const otherCount = record.items.length - restorable.length;

  function handleOpenChange(next: boolean) {
    if (running) return;
    setOpen(next);
    if (!next) {
      setResult(null);
      setError(null);
    }
  }

  async function runUndo() {
    setRunning(true);
    setError(null);

    try {
      const undoResult = await requestUndo(record.id);
      setResult(undoResult);
    } catch (undoError) {
      setError(
        undoError instanceof Error
          ? undoError.message
          : "Undo could not be completed. Refresh History to see the current state.",
      );
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  const tone =
    result?.status === "undone"
      ? "success"
      : result?.status === "refused"
        ? "warning"
        : result?.status === "partial"
          ? "warning"
          : "danger";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" className="shrink-0" />}
      >
        <RotateCcwIcon aria-hidden="true" />
        Undo
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Undo this organization?</DialogTitle>
          <DialogDescription>
            SlothSort will restore {pluralize(restorable.length, "file")} only
            if every moved file still matches its recorded identity and every
            original path is free. Existing files are never overwritten.
          </DialogDescription>
        </DialogHeader>

        {restorable.length > 0 ? (
          <ul className="max-h-52 space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/40 p-3">
            {restorable.map((item) => (
              <li
                key={`${item.from}-${item.to}`}
                className="font-mono text-[11px] leading-5"
              >
                <span className="block break-all text-foreground">
                  {item.to}
                </span>
                <span className="flex items-start gap-1 text-muted-foreground">
                  <ArrowRightIcon
                    className="mt-1 size-3 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="break-all">{item.from}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {otherCount > 0 ? (
          <Callout tone="info" title="Only completed changes are restored">
            {pluralize(otherCount, "failed or no-change item")} stays exactly
            as it is. Undo only reverses files that were actually moved or
            renamed.
          </Callout>
        ) : null}

        <div aria-live="polite">
          {result ? (
            <Callout tone={tone} title={undoTitle(result)}>
              <p>{result.message}</p>
              {result.failed > 0 || result.skipped > 0 ? (
                <ul className="mt-2 space-y-1 text-xs">
                  {result.items
                    .filter((item) => item.status !== "restored")
                    .map((item) => (
                      <li
                        key={`${item.relativePath}-${item.targetRelativePath}`}
                      >
                        <span className="font-mono break-all">
                          {item.relativePath}
                        </span>
                        : {item.error ?? "Not restored."}
                      </li>
                    ))}
                </ul>
              ) : null}
            </Callout>
          ) : error ? (
            <Callout tone="danger" title="Undo did not complete">
              {error}
            </Callout>
          ) : (
            <Callout tone="warning" title="This cannot overwrite newer work">
              If a moved file was edited, replaced, or removed, undo refuses the
              whole batch. If something now exists at an original location, that
              file is preserved and undo is refused.
            </Callout>
          )}
        </div>

        <DialogFooter>
          {result || error ? (
            <DialogClose render={<Button variant="outline" />}>
              Close
            </DialogClose>
          ) : (
            <>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button onClick={runUndo} disabled={running}>
                {running ? (
                  <>
                    <LoaderCircleIcon
                      className="size-3.5 animate-spin"
                      aria-hidden="true"
                    />
                    Verifying files…
                  </>
                ) : (
                  <>
                    <RotateCcwIcon aria-hidden="true" />
                    Undo {pluralize(restorable.length, "file")}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function undoTitle(result: UndoResult): string {
  switch (result.status) {
    case "undone":
      return "Undo complete";
    case "partial":
      return "Undo partly completed";
    case "refused":
      return "Undo refused";
    default:
      return "Undo failed";
  }
}
