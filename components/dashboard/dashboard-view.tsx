"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  FilesIcon,
  FolderOpenIcon,
  HardDriveIcon,
  LoaderCircleIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { FolderCard } from "@/components/dashboard/folder-card";
import { FolderPickerDialog } from "@/components/dashboard/folder-picker-dialog";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { WorkflowSteps } from "@/components/dashboard/workflow-steps";
import { ScannedFileTable } from "@/components/files/scanned-file-table";
import {
  ScanCancelledNotice,
  ScanProgressCard,
  ScanResultNotices,
} from "@/components/files/scan-feedback";
import { OllamaIndicator } from "@/components/ollama/ollama-indicator";
import { useScanWorkspace } from "@/components/scan/scan-workspace-provider";
import { PageHeader } from "@/components/shell/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { formatBytes, pluralize } from "@/lib/format";
import { cn } from "cn";

const PREVIEW_LIMIT = 8;

export function DashboardView() {
  const {
    folder,
    result,
    progress,
    status,
    error,
    scan,
    cancelScan,
  } = useScanWorkspace();

  const files = result?.files ?? [];
  const totalBytes = files.reduce((total, file) => total + file.sizeBytes, 0);
  const unsupported = files.filter((file) => file.kind === "other").length;
  const busy = status === "initializing" || status === "selecting";
  const hasResults = status === "ready" || status === "empty";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Drop the clutter."
        description="Scan an approved folder without changing a thing. SlothSort reads names and metadata on this device, then waits for you before anything moves."
      >
        <FolderPickerDialog
          triggerLabel={folder ? "Change folder" : "Choose folder"}
          triggerVariant="outline"
          triggerSize="lg"
          triggerClassName="h-9 px-3"
        />
        <Link
          href="/scan"
          className={cn(
            buttonVariants({ variant: "default", size: "lg" }),
            "h-9 gap-2 px-3",
          )}
        >
          <FolderOpenIcon aria-hidden="true" />
          View all files
        </Link>
      </PageHeader>

      <FolderCard />

      {busy ? (
        <Card className="gap-0 py-5">
          <CardContent className="flex items-center gap-3 px-5">
            <LoaderCircleIcon
              className="size-4 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground" role="status">
              Restoring the last approved folder…
            </p>
          </CardContent>
        </Card>
      ) : null}

      {status === "scanning" ? (
        <ScanProgressCard
          folderName={folder?.name ?? "folder"}
          progress={progress}
          onCancel={cancelScan}
        />
      ) : null}

      {status === "error" ? (
        <ErrorState
          title="The scan could not finish"
          description={
            error ??
            "The local scan endpoint did not respond. No files were changed."
          }
          action={
            folder ? (
              <Button variant="outline" size="sm" onClick={scan}>
                Try again
              </Button>
            ) : (
              <FolderPickerDialog triggerLabel="Choose folder" triggerSize="sm" />
            )
          }
        />
      ) : null}

      {status === "cancelled" ? <ScanCancelledNotice onResume={scan} /> : null}

      {hasResults && result ? (
        <>
          <section aria-label="Scan summary">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="Files scanned"
                value={String(files.length)}
                detail={`${pluralize(result.directoriesScanned, "folder")} read in this scan`}
                href="/scan"
                icon={FilesIcon}
              />
              <SummaryCard
                label="Total size"
                value={formatBytes(totalBytes)}
                detail="Metadata read; duplicate candidates hashed"
                href="/scan"
                icon={HardDriveIcon}
              />
              <SummaryCard
                label="Skipped entries"
                value={String(result.skippedCount)}
                detail="Links, unreadable items, and special files"
                href="/scan"
                icon={ShieldCheckIcon}
                tone={result.skippedCount > 0 ? "attention" : "default"}
              />
              <SummaryCard
                label="Unsupported types"
                value={String(unsupported)}
                detail="Listed for visibility; never proposed for moves"
                href="/scan"
                icon={TriangleAlertIcon}
                tone={unsupported > 0 ? "attention" : "default"}
              />
            </div>
          </section>

          <ScanResultNotices result={result} />

          {files.length > 0 ? (
            <Card className="gap-0 overflow-hidden py-0">
              <CardHeader className="flex-row items-start justify-between gap-3 px-5 py-4">
                <div className="space-y-1">
                  <CardTitle>Files in {folder?.name ?? "this folder"}</CardTitle>
                  <CardDescription>
                    MIME types are detected from extensions. Only files that
                    share a size are read, to check for exact duplicates.
                  </CardDescription>
                </div>
                <Link
                  href="/scan"
                  className="inline-flex shrink-0 items-center gap-1 rounded-md text-xs font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  View all {files.length}
                  <ArrowRightIcon className="size-3.5" aria-hidden="true" />
                </Link>
              </CardHeader>
              <ScannedFileTable files={files.slice(0, PREVIEW_LIMIT)} />
              {files.length > PREVIEW_LIMIT ? (
                <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
                  Showing {PREVIEW_LIMIT} of {files.length} files. Open the
                  folder scan for filtering and the full list.
                </p>
              ) : null}
            </Card>
          ) : (
            <EmptyState
              title="No files were found"
              description="This folder has no readable files. It may be empty, or every entry may have been skipped. Nothing was changed."
              icon={FolderOpenIcon}
              action={
                <Button variant="outline" size="sm" onClick={scan}>
                  Scan again
                </Button>
              }
            />
          )}
        </>
      ) : null}

      {status === "idle" && !folder ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <EmptyState
            title="No folder has been scanned yet"
            description="Choose a folder such as Downloads or Documents. SlothSort refuses drive roots, system folders, and your whole home folder so a scan stays small and intentional."
            icon={FolderOpenIcon}
            action={
              <FolderPickerDialog triggerLabel="Choose folder" triggerSize="sm" />
            }
          />
          <ReadOnlyCard />
        </div>
      ) : null}

      {hasResults ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <WorkflowSteps />
          <ReadOnlyCard />
        </div>
      ) : null}

      <Card className="gap-0 border-dashed py-5">
        <CardContent className="flex flex-col gap-3 px-5 sm:flex-row sm:items-start">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <SparklesIcon className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              Local Gemma suggestions are ready
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Open Review to run <span className="font-mono">gemma3:4b</span>{" "}
              through Ollama on up to 24 supported files. Document text is
              bounded, every reply is schema-validated, and nothing moves until
              the file-operation milestone.
            </p>
            <Link
              href="/review"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              Generate suggestions
              <ArrowRightIcon className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          <OllamaIndicator />
        </CardContent>
      </Card>
    </div>
  );
}

function ReadOnlyCard() {
  return (
    <Card className="gap-0 py-5">
      <CardHeader className="px-5">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheckIcon className="size-4 text-primary" aria-hidden="true" />
          Read-only by design
        </CardTitle>
        <CardDescription>
          What the scanner will and will not do.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pt-4">
        <ul className="space-y-2 text-xs leading-5 text-muted-foreground">
          {[
            "Reads folder names, filenames, sizes, timestamps, and extension-based MIME types.",
            "Reads only files that share a size, and only to compute SHA-256 duplicate hashes.",
            "Never follows symbolic links outside the approved folder.",
            "Stops at safety limits instead of walking an entire drive.",
            "Renames, moves, and deletes nothing. Approval comes later.",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <ShieldCheckIcon
                className="mt-0.5 size-3.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
