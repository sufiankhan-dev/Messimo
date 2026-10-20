"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  FilePenLineIcon,
  FolderInputIcon,
  HistoryIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
  WorkflowIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { OPERATION_STATUS_LABELS } from "@/lib/workspace/history";
import type {
  OperationKind,
  OperationRecord,
  OperationStatus,
  UndoResult,
} from "@/types";
import { cn } from "cn";

const STATUS_STYLES: Record<OperationStatus, string> = {
  completed:
    "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-200",
  partial:
    "border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-200",
  failed:
    "border-rose-200/80 bg-rose-50 text-rose-800 dark:border-rose-300/20 dark:bg-rose-300/10 dark:text-rose-200",
  undone: "border-border bg-muted text-muted-foreground",
};

const KIND_ICONS: Record<OperationKind, typeof FolderInputIcon> = {
  move: FolderInputIcon,
  rename: FilePenLineIcon,
  mixed: WorkflowIcon,
};

export function OperationList({ records }: { records: OperationRecord[] }) {
  if (records.length === 0) {
    return (
      <EmptyState
        title="No operations yet"
        description="Once you confirm a batch on the Review page, each applied move or rename is recorded here with its per-file result and undo details."
        icon={HistoryIcon}
      />
    );
  }

  return (
    <ol className="space-y-3">
      {records.map((record) => {
        const Icon = KIND_ICONS[record.kind];

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
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-medium",
                          STATUS_STYLES[record.status],
                        )}
                      >
                        {OPERATION_STATUS_LABELS[record.status]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(record.appliedAt)} ·{" "}
                      {pluralize(record.itemCount, "file")}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {record.note}
                </p>

                <ul className="mt-3 space-y-2 rounded-xl border border-border/70 bg-muted/25 p-3">
                  {record.items.slice(0, 4).map((item) => (
                    <li
                      key={`${item.from}-${item.to}`}
                      className="font-mono text-[11px] leading-5"
                    >
                      <span className="block break-all text-foreground">
                        {item.from}
                      </span>
                      <span className="flex items-start gap-1 text-muted-foreground">
                        <ArrowRightIcon
                          className="mt-1 size-3 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="break-all">{item.to}</span>
                      </span>
                      {item.status === "failed" || item.error ? (
                        <span className="mt-0.5 block font-sans text-[11px] text-rose-700 dark:text-rose-300">
                          {item.error ?? "This operation failed."}
                        </span>
                      ) : null}
                    </li>
                  ))}
                  {record.items.length > 4 ? (
                    <li className="text-[11px] text-muted-foreground">
                      and {record.items.length - 4} more
                    </li>
                  ) : null}
                </ul>

                <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11px] text-muted-foreground">
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

function UndoDialog({ record }: { record: OperationRecord }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<UndoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            SlothSort will restore {pluralize(record.itemCount, "file")} only if
            every moved file still matches its recorded identity and every
            original path is free.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-52 space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/40 p-3">
          {record.items.map((item) => (
            <li
              key={`${item.from}-${item.to}`}
              className="font-mono text-[11px] leading-5"
            >
              <span className="block break-all text-foreground">{item.to}</span>
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

        {result ? (
          <Callout tone={tone} title={undoTitle(result)}>
            <p>{result.message}</p>
            {result.failed > 0 || result.skipped > 0 ? (
              <ul className="mt-2 space-y-1 text-xs">
                {result.items
                  .filter((item) => item.status !== "restored")
                  .map((item) => (
                    <li key={`${item.relativePath}-${item.targetRelativePath}`}>
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
                    Undo {record.itemCount} file
                    {record.itemCount === 1 ? "" : "s"}
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
