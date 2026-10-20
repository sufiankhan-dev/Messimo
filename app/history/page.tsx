import type { Metadata } from "next";
import { CircleCheckIcon, FileClockIcon, RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { OperationList } from "@/components/history/operation-list";
import { PageHeader } from "@/components/shell/page-header";
import { Callout } from "@/components/ui/callout";
import { DEMO_OPERATIONS } from "@/lib/mock/demo-workspace";
import { summarizeOperations } from "@/lib/workspace/history";

export const metadata: Metadata = {
  title: "History",
};

export default function HistoryPage() {
  const summary = summarizeOperations(DEMO_OPERATIONS);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operation history"
        title="A receipt for every move."
        description="Every approved batch is recorded locally so you can see exactly what changed and reverse supported operations."
      />

      <Callout tone="info" title="History and undo are demo records">
        No operation has run in this build. The entries below are sample data,
        and the local history store plus safe undo are scheduled for the file
        operations milestone.
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

      <OperationList records={DEMO_OPERATIONS} />
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
