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
import { StatCard } from "@/components/ui/stat-card";
import { HistoryError, listOperationRecords } from "@/lib/history/store";
import { summarizeOperations } from "@/lib/workspace/history";
import { formatCount } from "@/lib/format";
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

      <section aria-label="History summary">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Operations recorded"
            value={formatCount(summary.total)}
            detail={`${formatCount(summary.itemsChanged)} files changed in total`}
            icon={FileClockIcon}
          />
          <StatCard
            label="Completed"
            value={formatCount(summary.completed)}
            detail="Finished with no failed operations"
            icon={CircleCheckIcon}
          />
          <StatCard
            label="Needs attention"
            value={formatCount(summary.partial + summary.failed)}
            detail="Partially completed or failed batches"
            icon={TriangleAlertIcon}
            tone={
              summary.partial + summary.failed > 0 ? "attention" : "default"
            }
          />
          <StatCard
            label="Undo available"
            value={formatCount(summary.undoable)}
            detail="Still safely reversible right now"
            icon={RotateCcwIcon}
          />
        </div>
      </section>

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
            className="h-[112px] animate-pulse rounded-xl border border-border bg-card"
          />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />
    </div>
  );
}
