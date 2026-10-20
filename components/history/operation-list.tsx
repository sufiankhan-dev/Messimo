"use client";

import {
  ArrowRightIcon,
  FilePenLineIcon,
  FolderInputIcon,
  HistoryIcon,
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
import { OPERATION_STATUS_LABELS } from "@/lib/workspace/history";
import type { OperationKind, OperationRecord, OperationStatus } from "@/types";
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
        description="Once you approve real changes, each applied move or rename will be recorded here with undo details."
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

                <ul className="mt-3 space-y-1.5 rounded-xl border border-border/70 bg-muted/25 p-3">
                  {record.items.slice(0, 3).map((item) => (
                    <li
                      key={`${item.from}-${item.to}`}
                      className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] leading-5"
                    >
                      <span className="min-w-0 break-all text-foreground">
                        {item.from}
                      </span>
                      <ArrowRightIcon
                        className="size-3 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 break-all text-muted-foreground">
                        {item.to}
                      </span>
                    </li>
                  ))}
                  {record.itemCount > 3 ? (
                    <li className="text-[11px] text-muted-foreground">
                      and {record.itemCount - 3} more
                    </li>
                  ) : null}
                </ul>

                <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11px] text-muted-foreground">
                    {record.undoable
                      ? "A local undo record is available for this demo operation."
                      : record.undoUnavailableReason}
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
  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="outline" size="sm" className="shrink-0" />}
      >
        <RotateCcwIcon aria-hidden="true" />
        Undo
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Undo this organization?</DialogTitle>
          <DialogDescription>
            This would restore {pluralize(record.itemCount, "file")} to their
            previous names and locations.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/40 p-3">
          {record.items.map((item) => (
            <li
              key={`${item.from}-${item.to}`}
              className="font-mono text-[11px] leading-5"
            >
              <span className="block break-all text-foreground">{item.to}</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <ArrowRightIcon className="size-3" aria-hidden="true" />
                <span className="break-all">{item.from}</span>
              </span>
            </li>
          ))}
          {record.itemCount > record.items.length ? (
            <li className="text-[11px] text-muted-foreground">
              and {record.itemCount - record.items.length} more
            </li>
          ) : null}
        </ul>

        <Callout tone="warning">
          Demo record only. Local operation history and safe file operations are
          not implemented yet, so undo cannot be applied in this build.
        </Callout>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button disabled>
            Undo unavailable
            <span className="sr-only">
              Undo is not implemented in this build.
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
