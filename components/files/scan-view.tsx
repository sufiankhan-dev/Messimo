"use client";

import { useMemo, useState } from "react";
import {
  FolderOpenIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  XIcon,
} from "lucide-react";
import { FolderPickerDialog } from "@/components/dashboard/folder-picker-dialog";
import { ScannedFileTable } from "@/components/files/scanned-file-table";
import {
  ScanCancelledNotice,
  ScanProgressCard,
  ScanResultNotices,
} from "@/components/files/scan-feedback";
import { useScanWorkspace } from "@/components/scan/scan-workspace-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { formatBytes, formatDateTime, pluralize } from "@/lib/format";
import { cn } from "cn";

type FileFilter = "all" | "unsupported" | "warnings";

const PAGE_SIZE = 200;

const FILTER_LABELS: Record<FileFilter, string> = {
  all: "All files",
  unsupported: "Unsupported",
  warnings: "With warnings",
};

export function ScanView() {
  const {
    folder,
    result,
    progress,
    status,
    error,
    scan,
    cancelScan,
  } = useScanWorkspace();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FileFilter>("all");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const scanning = status === "scanning";
  const files = useMemo(() => result?.files ?? [], [result]);
  const totalBytes = files.reduce((total, file) => total + file.sizeBytes, 0);
  const hasResults = status === "ready" || status === "empty";

  const counts = useMemo<Record<FileFilter, number>>(
    () => ({
      all: files.length,
      unsupported: files.filter((file) => file.kind === "other").length,
      warnings: files.filter((file) => file.warnings.length > 0).length,
    }),
    [files],
  );

  const visibleFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return files.filter((file) => {
      if (filter === "unsupported" && file.kind !== "other") return false;
      if (filter === "warnings" && file.warnings.length === 0) return false;
      if (!normalizedQuery) return true;

      return [
        file.name,
        file.relativePath,
        file.extension,
        file.mimeType ?? "",
        ...file.warnings,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [files, filter, query]);

  function resetFilters() {
    setQuery("");
    setFilter("all");
    setLimit(PAGE_SIZE);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <FolderOpenIcon
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="truncate font-mono text-xs text-foreground sm:text-sm">
              {folder?.displayPath ?? "No folder approved yet"}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {folder
                ? `${folder.platform} · ${pluralize(result ? files.length : (progress?.scannedFiles ?? 0), "file")} · ${
                    result ? formatBytes(totalBytes) : "—"
                  }${
                    result
                      ? ` · scanned ${formatDateTime(result.scannedAt)}`
                      : scanning
                        ? " · scanning now"
                        : ""
                  }`
                : "Choose a folder below. Drives and system folders are refused."}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <FolderPickerDialog
            triggerLabel={folder ? "Change folder" : "Choose folder"}
            triggerVariant={folder ? "outline" : "default"}
            triggerSize="sm"
          />
          {folder ? (
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
          ) : null}
        </div>
      </div>

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

      {status === "idle" && !folder ? (
        <EmptyState
          title="Choose a folder to scan"
          description="SlothSort reads one approved folder and its subfolders. It never scans a whole drive or your entire home folder, and it never changes a file during a scan."
          icon={FolderOpenIcon}
          action={
            <FolderPickerDialog triggerLabel="Choose folder" triggerSize="sm" />
          }
        />
      ) : null}

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
              <FolderPickerDialog triggerLabel="Choose folder" triggerSize="sm" />
            )
          }
        />
      ) : null}

      {status === "cancelled" ? <ScanCancelledNotice onResume={scan} /> : null}

      {hasResults && result ? (
        <>
          <ScanResultNotices result={result} />

          {files.length === 0 ? (
            <EmptyState
              title={
                result.skippedCount > 0
                  ? "No readable files were found"
                  : "This folder is empty"
              }
              description={
                result.skippedCount > 0
                  ? "Every entry was skipped for safety. Check folder permissions or choose another folder."
                  : "SlothSort found no files in this folder or its subfolders. Nothing was changed."
              }
              icon={FolderOpenIcon}
              action={
                <Button variant="outline" size="sm" onClick={scan}>
                  Scan again
                </Button>
              }
            />
          ) : (
            <Card className="gap-0 overflow-hidden py-0">
              <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-xs">
                  <SearchIcon
                    className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    type="search"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setLimit(PAGE_SIZE);
                    }}
                    placeholder="Search names, paths, or MIME types…"
                    aria-label="Search scanned files"
                    className="h-9 pr-8 pl-8"
                  />
                  {query ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Clear search"
                      onClick={() => {
                        setQuery("");
                        setLimit(PAGE_SIZE);
                      }}
                      className="absolute top-1/2 right-1 -translate-y-1/2"
                    >
                      <XIcon aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>

                <p
                  className="text-xs text-muted-foreground sm:text-right"
                  aria-live="polite"
                >
                  Showing{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {Math.min(limit, visibleFiles.length)}
                  </span>{" "}
                  of {visibleFiles.length} matching files
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5">
                {(Object.keys(FILTER_LABELS) as FileFilter[]).map((value) => {
                  const active = filter === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setFilter(value);
                        setLimit(PAGE_SIZE);
                      }}
                      className={cn(
                        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "border-primary/25 bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {FILTER_LABELS[value]}
                      <span className="text-[10px] tabular-nums opacity-70">
                        {counts[value]}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-border">
                {visibleFiles.length > 0 ? (
                  <>
                    <ScannedFileTable
                      files={visibleFiles.slice(0, limit)}
                    />
                    {visibleFiles.length > limit ? (
                      <div className="flex flex-col items-center gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-between">
                        <p className="text-[11px] text-muted-foreground">
                          Large folders are paged so the interface stays
                          responsive.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLimit((value) => value + PAGE_SIZE)}
                        >
                          Show {Math.min(PAGE_SIZE, visibleFiles.length - limit)}{" "}
                          more
                        </Button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <EmptyState
                    title="No files match"
                    description="Try a different search term or clear the active filter."
                    icon={SearchIcon}
                    action={
                      <Button variant="outline" size="sm" onClick={resetFilters}>
                        Clear filters
                      </Button>
                    }
                    className="border-0 bg-transparent py-14"
                  />
                )}
              </div>
            </Card>
          )}

          <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheckIcon
                className="size-3.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span>
                {result.files.length} files across{" "}
                {pluralize(result.directoriesScanned, "folder")} in{" "}
                {result.durationMs} ms.
              </span>
            </div>
            <span>Read-only · candidates hashed · nothing moved</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
