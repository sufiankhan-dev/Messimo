"use client";

import { useMemo, useState } from "react";
import {
  FolderOpenIcon,
  LoaderCircleIcon,
  ScanLineIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { FileTable } from "@/components/files/file-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import type { OrganizationFile } from "@/types";
import { cn } from "cn";

type FileFilter = "all" | "needs-review" | "duplicates" | "unsupported";
type PreviewState = "ready" | "scanning" | "empty" | "error";

const FILTER_LABELS: Record<FileFilter, string> = {
  all: "All files",
  "needs-review": "Needs review",
  duplicates: "Duplicates",
  unsupported: "Unsupported",
};

const PREVIEW_STATES: ReadonlyArray<{
  value: PreviewState;
  label: string;
}> = [
  { value: "ready", label: "Ready" },
  { value: "scanning", label: "Scanning" },
  { value: "empty", label: "Empty" },
  { value: "error", label: "Error" },
];

export function ScanView({ files }: { files: OrganizationFile[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FileFilter>("all");
  const [preview, setPreview] = useState<PreviewState>("ready");

  const counts: Record<FileFilter, number> = {
    all: files.length,
    "needs-review": files.filter((file) => file.status === "needs-review")
      .length,
    duplicates: files.filter((file) => file.duplicateGroupId !== null).length,
    unsupported: files.filter((file) => !file.supported).length,
  };

  const visibleFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return files.filter((file) => {
      if (filter === "needs-review" && file.status !== "needs-review") {
        return false;
      }
      if (filter === "duplicates" && file.duplicateGroupId === null) {
        return false;
      }
      if (filter === "unsupported" && file.supported) {
        return false;
      }
      if (!normalizedQuery) return true;

      const searchable = [
        file.name,
        file.relativePath,
        file.extension,
        file.suggestion?.category ?? "",
        file.suggestion?.suggestedFileName ?? "",
        file.suggestion?.suggestedRelativePath ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [files, filter, query]);

  function resetFilters() {
    setQuery("");
    setFilter("all");
  }

  return (
    <div className="space-y-3">
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
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search files or destinations…"
              aria-label="Search files"
              className="h-9 pr-8 pl-8"
            />
            {query ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Clear search"
                onClick={() => setQuery("")}
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
              {visibleFiles.length}
            </span>{" "}
            of {files.length} files
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
                onClick={() => setFilter(value)}
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
          {preview === "ready" ? (
            visibleFiles.length > 0 ? (
              <FileTable files={visibleFiles} />
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
            )
          ) : null}

          {preview === "scanning" ? <ScanningPreview /> : null}

          {preview === "empty" ? (
            <EmptyState
              title="This folder is empty"
              description="SlothSort found no supported files in this folder. Try another folder when local scanning is available."
              icon={FolderOpenIcon}
              className="border-0 bg-transparent py-14"
            />
          ) : null}

          {preview === "error" ? (
            <div className="p-4">
              <ErrorState
                title="This folder could not be read"
                description="Permission was denied while reading the sample folder. No files were changed. Check folder permissions and try again."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreview("ready")}
                  >
                    Reset preview
                  </Button>
                }
              />
            </div>
          ) : null}
        </div>
      </Card>

      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ScanLineIcon className="size-3.5" aria-hidden="true" />
          <span className="font-medium text-foreground">UI state preview</span>
          <span className="hidden sm:inline">
            · Sample data only; no scan is running
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {PREVIEW_STATES.map(({ value, label }) => (
            <Button
              key={value}
              type="button"
              variant={preview === value ? "secondary" : "ghost"}
              size="xs"
              aria-pressed={preview === value}
              onClick={() => setPreview(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScanningPreview() {
  return (
    <div className="space-y-6 px-4 py-10" aria-busy="true">
      <div className="mx-auto max-w-md space-y-4 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <LoaderCircleIcon
            className="size-5 animate-spin"
            aria-hidden="true"
          />
        </span>
        <div>
          <h2 className="text-sm font-medium text-foreground">
            Reading file metadata…
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Preview of the scanning state. Sample files are not read from disk.
          </p>
        </div>
        <Progress value={62} className="mx-auto max-w-sm text-left">
          <ProgressLabel className="sr-only">Scan progress</ProgressLabel>
          <ProgressValue />
        </Progress>
      </div>

      <div className="mx-auto max-w-2xl space-y-2" aria-hidden="true">
        {[100, 92, 84, 76].map((width) => (
          <div
            key={width}
            className="flex items-center gap-3 rounded-lg border border-border/60 p-3"
          >
            <div className="size-8 animate-pulse rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div
                className="h-2.5 animate-pulse rounded-full bg-muted"
                style={{ width: `${width}%` }}
              />
              <div className="h-2 w-1/3 animate-pulse rounded-full bg-muted/70" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
