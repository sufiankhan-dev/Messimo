import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CircleCheckIcon,
  FileClockIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { OperationList } from "@/components/history/operation-list";
import { PageHeader } from "@/components/shell/page-header";
import { Callout } from "@/components/ui/callout";
import { buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { HistoryError, listOperationRecords } from "@/lib/history/store";
import { summarizeOperations } from "@/lib/workspace/history";
import { cn } from "cn";
import type { OperationRecord } from "@/types";

export const metadata: Metadata = {
  title: "History",
};

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operation history"
        title="A receipt for every move."
        description="Every approved batch is recorded locally so you can see exactly what changed and reverse supported operations."
      >
        <Link
          href="/review"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-9 gap-2 px-3",
          )}
        >
          Review suggestions
        </Link>
      </PageHeader>

      <Suspense fallback={<HistorySkeleton />}>
        <HistoryContent />
      </Suspense>
    </div>
  );
}

/**
 * The history file is local data that changes at runtime, so it is read inside
 * a Suspense boundary. The page shell stays static and the record list streams
 * in after the request starts.
 */
async function HistoryContent() {
  let records: OperationRecord[] = [];
  let loadError: string | null = null;

  try {
    records = await listOperationRecords();
  } catch (error) {
    loadError =
      error instanceof HistoryError
        ? error.message
        : "The local operation history could not be read. It was not modified.";
  }

  const summary = summarizeOperations(records);

  if (loadError) {
    return (
      <ErrorState title="History could not be loaded" description={loadError} />
    );
  }

  return (
    <>
      <Callout tone="info" title="Recorded on this computer only">
        The history file stays on this device. It records relative paths and the
        identity of each moved file so undo can verify that nothing newer would
        be overwritten. No file is ever deleted automatically.
      </Callout>

      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HistoryStat
          label="Operations recorded"
          value={summary.total}
          icon={FileClockIcon}
        />
        <HistoryStat
          label="Completed"
          value={summary.completed}
          icon={CircleCheckIcon}
        />
        <HistoryStat
          label="Needs attention"
          value={summary.partial + summary.failed}
          icon={TriangleAlertIcon}
        />
        <HistoryStat
          label="Undo available"
          value={summary.undoable}
          icon={RotateCcwIcon}
        />
      </dl>

      <OperationList records={records} />
    </>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-20 animate-pulse rounded-xl border border-border bg-card" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-[68px] animate-pulse rounded-xl border border-border bg-card"
          />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />
    </div>
  );
}

function HistoryStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof FileClockIcon;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div>
        <dt className="text-[11px] text-muted-foreground">{label}</dt>
        <dd className="text-lg font-semibold tabular-nums text-foreground">
          {value}
        </dd>
      </div>
    </div>
  );
}
