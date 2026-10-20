"use client";

import { useMemo } from "react";
import {
  CopyIcon,
  FilesIcon,
  FolderOpenIcon,
  HardDriveIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
} from "lucide-react";
import {
  DuplicateBoard,
  type SimilarNameView,
} from "@/components/duplicates/duplicate-board";
import { FolderPickerDialog } from "@/components/dashboard/folder-picker-dialog";
import {
  ScanCancelledNotice,
  ScanProgressCard,
  ScanResultNotices,
} from "@/components/files/scan-feedback";
import { useScanWorkspace } from "@/components/scan/scan-workspace-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatCard } from "@/components/ui/stat-card";
import { formatBytes, formatDateTime, pluralize } from "@/lib/format";
import {
  buildDuplicateGroups,
  buildSimilarNameGroups,
  getRecoverableBytes,
} from "@/lib/workspace/duplicates";

/**
 * Duplicate review for the current scan. All grouping is derived from the
 * deterministic SHA-256 digests produced by the scanner; no model output is
 * involved and no action on this screen changes a file.
 */
export function DuplicatesView() {
  const { folder, result, progress, status, error, scan, cancelScan } =
    useScanWorkspace();

  const groups = useMemo(
    () =>
      result
        ? buildDuplicateGroups(result.files, result.duplicateGroups)
        : [],
    [result],
  );
  const similarGroups = useMemo<SimilarNameView[]>(
    () =>
      result
        ? buildSimilarNameGroups(result.files, result.similarNameGroups)
        : [],
    [result],
  );

  const recoverableBytes = getRecoverableBytes(groups);
  const duplicateFiles = groups.reduce(
    (total, group) => total + group.files.length,
    0,
  );
  const scanning = status === "scanning";

  if (!result) {
    return (
      <div className="space-y-4">
        {scanning ? (
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
                <FolderPickerDialog
                  triggerLabel="Choose folder"
                  triggerSize="sm"
                />
              )
            }
          />
        ) : null}

        {status === "cancelled" ? <ScanCancelledNotice onResume={scan} /> : null}

        {status === "initializing" || status === "selecting" ? (
          <div
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-10 text-sm text-muted-foreground"
            role="status"
          >
            <LoaderCircleIcon
              className="size-4 animate-spin"
              aria-hidden="true"
            />
            Restoring the last approved folder…
          </div>
        ) : null}

        {status !== "error" &&
        status !== "cancelled" &&
        !scanning &&
        status !== "initializing" &&
        status !== "selecting" ? (
          <EmptyState
            title="Scan a folder to find duplicates"
            description="SlothSort reads one approved folder, hashes files that share a size, and groups only files whose contents match. Nothing is ever deleted, moved, or renamed from this screen."
            icon={FolderOpenIcon}
            action={
              <FolderPickerDialog triggerLabel="Choose folder" triggerSize="sm" />
            }
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="gap-0 py-4">
        <CardContent className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate font-mono text-xs text-foreground">
              {folder?.displayPath ?? "Approved folder"}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {pluralize(result.files.length, "file")} scanned ·{" "}
              {pluralize(result.duplicateGroups.length, "exact group")} ·{" "}
              {pluralize(result.hashedFiles, "candidate file")} hashed ·{" "}
              {formatDateTime(result.scannedAt)}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <FolderPickerDialog
              triggerLabel="Change folder"
              triggerVariant="outline"
              triggerSize="sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={scanning ? cancelScan : scan}
            >
              {scanning ? (
                <LoaderCircleIcon
                  className="size-3.5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <RefreshCwIcon className="size-3.5" aria-hidden="true" />
              )}
              {scanning ? "Cancel scan" : "Scan again"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {scanning ? (
        <ScanProgressCard
          folderName={folder?.name ?? "folder"}
          progress={progress}
          onCancel={cancelScan}
        />
      ) : null}

      <ScanResultNotices result={result} />

      {result.files.length === 0 ? (
        <EmptyState
          title={
            result.skippedCount > 0
              ? "No readable files were found"
              : "This folder is empty"
          }
          description={
            result.skippedCount > 0
              ? "Every entry was skipped for safety, so there is nothing to hash or compare. Check folder permissions or choose another folder."
              : "SlothSort found no files in this folder or its subfolders. There are no duplicates to compare. Nothing was changed."
          }
          icon={FolderOpenIcon}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={scan}>
                <RefreshCwIcon aria-hidden="true" />
                Scan again
              </Button>
              <FolderPickerDialog
                triggerLabel="Change folder"
                triggerVariant="outline"
                triggerSize="sm"
              />
            </div>
          }
        />
      ) : (
        <>
          <section aria-label="Duplicate summary">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Exact duplicate groups"
                value={String(groups.length)}
                detail="Matched by SHA-256, never by name"
                icon={CopyIcon}
              />
              <StatCard
                label="Duplicate files"
                value={String(duplicateFiles)}
                detail={`Across ${pluralize(groups.length, "group")}`}
                icon={FilesIcon}
              />
              <StatCard
                label="Recoverable space"
                value={formatBytes(recoverableBytes)}
                detail="If you choose to consolidate later"
                icon={HardDriveIcon}
              />
            </div>
          </section>

          <DuplicateBoard groups={groups} similarGroups={similarGroups} />
        </>
      )}
    </div>
  );
}
