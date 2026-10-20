import type { Metadata } from "next";
import { FolderOpenIcon, ShieldCheckIcon } from "lucide-react";
import { ScanView } from "@/components/files/scan-view";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { formatBytes, pluralize } from "@/lib/format";
import { DEMO_DUPLICATE_GROUPS, DEMO_FILES, DEMO_FOLDER } from "@/lib/mock/demo-workspace";
import { getWorkspaceSummary } from "@/lib/workspace/summary";

export const metadata: Metadata = {
  title: "Folder scan",
};

export default function ScanPage() {
  const summary = getWorkspaceSummary(DEMO_FILES, DEMO_DUPLICATE_GROUPS);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Folder scan"
        title="Every file, in plain sight."
        description="See what is in the folder, what SlothSort suggests, and what still needs a decision. Nothing is moved during a scan."
      >
        <Badge
          variant="outline"
          className="h-7 gap-1.5 bg-card px-2.5 text-xs font-medium"
        >
          <ShieldCheckIcon
            className="size-3.5 text-primary"
            aria-hidden="true"
          />
          Read-only
        </Badge>
      </PageHeader>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <FolderOpenIcon
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="truncate font-mono text-xs text-foreground sm:text-sm">
            {DEMO_FOLDER.displayPath}
          </span>
        </div>
        <p className="shrink-0 text-xs text-muted-foreground">
          {pluralize(summary.scannedFiles, "file")} ·{" "}
          {formatBytes(summary.totalBytes)}
        </p>
      </div>

      <Callout tone="info" title="Sample data: the scanner is not connected yet">
        This table is populated with synthetic files. Read-only folder access,
        metadata extraction, and SHA-256 hashing are scheduled for the next
        milestone, so no folder on this machine is being read.
      </Callout>

      <ScanView files={DEMO_FILES} />
    </div>
  );
}
