import type { Metadata } from "next";
import Link from "next/link";
import {
  CircleAlertIcon,
  CopyIcon,
  FilesIcon,
  ListChecksIcon,
  SparklesIcon,
} from "lucide-react";
import { CategoryMix } from "@/components/dashboard/category-mix";
import { FolderCard } from "@/components/dashboard/folder-card";
import { RecentSuggestions } from "@/components/dashboard/recent-suggestions";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { WorkflowSteps } from "@/components/dashboard/workflow-steps";
import { OllamaIndicator } from "@/components/ollama/ollama-indicator";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBytes, pluralize } from "@/lib/format";
import {
  DEMO_DUPLICATE_GROUPS,
  DEMO_FILES,
  DEMO_FOLDER,
} from "@/lib/mock/demo-workspace";
import {
  buildDuplicateGroups,
  getRecoverableBytes,
} from "@/lib/workspace/duplicates";
import {
  getCategoryCounts,
  getWorkspaceSummary,
} from "@/lib/workspace/summary";
import type { OrganizationFile, ReviewStatus } from "@/types";
import { cn } from "cn";

export const metadata: Metadata = {
  title: "Dashboard",
};

const STATUS_PRIORITY: Record<ReviewStatus, number> = {
  "needs-review": 0,
  pending: 1,
  approved: 2,
  rejected: 3,
};

export default function DashboardPage() {
  const summary = getWorkspaceSummary(DEMO_FILES, DEMO_DUPLICATE_GROUPS);
  const categories = getCategoryCounts(DEMO_FILES);
  const duplicateGroups = buildDuplicateGroups(
    DEMO_FILES,
    DEMO_DUPLICATE_GROUPS,
  );
  const recoverableBytes = getRecoverableBytes(duplicateGroups);

  const actionableFiles: OrganizationFile[] = DEMO_FILES.filter(
    (file) => file.suggestion !== null && file.status !== "rejected",
  );
  const recentSuggestions = [...actionableFiles]
    .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status])
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Drop the clutter."
        description="A calmer workspace for a messy folder. Review local AI suggestions, spot exact duplicates, and move files only when you say so."
      >
        <Link
          href="/scan"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-9 px-3",
          )}
        >
          Browse files
        </Link>
        <Link
          href="/review"
          className={cn(
            buttonVariants({ variant: "default", size: "lg" }),
            "h-9 gap-2 px-3",
          )}
        >
          <ListChecksIcon aria-hidden="true" />
          Review suggestions
        </Link>
      </PageHeader>

      <FolderCard
        name={DEMO_FOLDER.name}
        displayPath={DEMO_FOLDER.displayPath}
        platform={DEMO_FOLDER.platform}
        lastScannedAt={DEMO_FOLDER.lastScannedAt}
        fileCount={summary.scannedFiles}
        totalBytes={summary.totalBytes}
        proposedChanges={summary.proposedChanges}
      />

      <section aria-label="Workspace summary">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Scanned files"
            value={String(summary.scannedFiles)}
            detail={`${formatBytes(summary.totalBytes)} in the sample folder`}
            href="/scan"
            icon={FilesIcon}
          />
          <SummaryCard
            label="Proposed changes"
            value={String(summary.proposedChanges)}
            detail={`${summary.approved} approved · ${summary.scannedFiles - summary.approved - summary.rejected - summary.needsReview} pending`}
            href="/review"
            icon={SparklesIcon}
          />
          <SummaryCard
            label="Duplicate files"
            value={String(summary.duplicateFiles)}
            detail={`${pluralize(duplicateGroups.length, "exact group")} · ${formatBytes(recoverableBytes)} recoverable`}
            href="/duplicates"
            icon={CopyIcon}
          />
          <SummaryCard
            label="Needs review"
            value={String(summary.needsReview)}
            detail="Uncertain, duplicate, or unsupported"
            href="/review"
            icon={CircleAlertIcon}
            tone="attention"
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <RecentSuggestions
            files={recentSuggestions}
            total={summary.proposedChanges}
          />
          <WorkflowSteps />
        </div>

        <div className="space-y-4">
          <Card className="gap-0 py-5">
            <CardHeader className="px-5">
              <CardTitle className="flex items-center gap-2">
                <SparklesIcon
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
                Local AI
              </CardTitle>
              <CardDescription>
                Gemma through Ollama. No cloud fallback.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-5 pt-4">
              <OllamaIndicator />
              <p className="text-xs leading-5 text-muted-foreground">
                Inference is not wired up yet. This status only checks whether
                local Ollama is reachable, and no filenames or file contents are
                sent.
              </p>
            </CardContent>
          </Card>

          <CategoryMix counts={categories} total={summary.proposedChanges} />

          <Card className="gap-0 border-dashed py-5">
            <CardContent className="flex gap-3 px-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <CopyIcon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {pluralize(summary.duplicateFiles, "exact duplicate")}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Found by SHA-256 content hashes, not filenames. Review them
                  side by side — nothing is deleted automatically.
                </p>
                <Link
                  href="/duplicates"
                  className="mt-2 inline-flex rounded-sm text-xs font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Review duplicate groups
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
