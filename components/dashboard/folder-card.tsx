"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  FolderOpenIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { MessimoMark } from "@/components/brand/messimo-mark";
import { FolderPickerDialog } from "@/components/dashboard/folder-picker-dialog";
import { useScanWorkspace } from "@/components/scan/scan-workspace-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatBytes, formatDateTime, pluralize } from "@/lib/format";
import { cn } from "cn";

export function FolderCard() {
  const { folder, result, progress, status, scan, cancelScan } =
    useScanWorkspace();
  const scanning = status === "scanning";
  const files = result?.files ?? [];
  const fileCount = result ? files.length : (progress?.scannedFiles ?? 0);
  const totalBytes = files.reduce((total, file) => total + file.sizeBytes, 0);

  return (
    <section
      aria-labelledby="folder-heading"
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
    >
      <div
        className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-accent/70 blur-3xl"
        aria-hidden="true"
      />
      <MessimoMark className="pointer-events-none absolute -right-2 -bottom-5 size-28 rotate-[-8deg] opacity-[0.045]" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground ring-1 ring-primary/10">
              <FolderOpenIcon className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                Approved folder
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                <h2
                  id="folder-heading"
                  className="text-sm font-medium text-foreground"
                >
                  {folder?.name ?? "No folder selected"}
                </h2>
                <Badge
                  variant="outline"
                  className={cn(
                    "h-4 bg-muted px-1.5 text-[9px] uppercase",
                    folder
                      ? "text-muted-foreground"
                      : "text-muted-foreground/80",
                  )}
                >
                  {scanning ? "Scanning" : folder ? "Local" : "Choose one"}
                </Badge>
              </div>
            </div>
          </div>

          <p className="font-mono text-base font-medium break-all text-foreground sm:text-lg">
            {folder?.displayPath ??
              "Scanning is limited to a folder you approve. Drives and system folders are refused."}
          </p>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            <span>{folder?.platform ?? "Local only"}</span>
            <span aria-hidden="true">·</span>
            <span>{pluralize(fileCount, "file")}</span>
            <span aria-hidden="true">·</span>
            <span>{result ? formatBytes(totalBytes) : "—"}</span>
            <span aria-hidden="true">·</span>
            <span>
              {scanning
                ? "Scanning now"
                : result
                  ? `Last scanned ${formatDateTime(result.scannedAt)}`
                  : "Not scanned yet"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:justify-end">
          <FolderPickerDialog
            triggerLabel={folder ? "Change folder" : "Choose folder"}
            triggerVariant={folder ? "outline" : "default"}
          />
          {folder ? (
            <Button
              variant="outline"
              size="lg"
              className="h-10 gap-2 px-4 text-sm"
              onClick={scanning ? cancelScan : scan}
            >
              {scanning ? (
                <LoaderCircleIcon
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <RefreshCwIcon className="size-4" aria-hidden="true" />
              )}
              {scanning ? "Cancel scan" : "Scan again"}
            </Button>
          ) : null}
          {folder ? (
            <Link
              href="/scan"
              className={cn(
                buttonVariants({ variant: "ghost", size: "lg" }),
                "h-10 gap-2 px-4 text-sm",
              )}
            >
              View files
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>

      <div className="relative mt-5 flex items-start gap-2 border-t border-border/70 pt-3 text-[11px] leading-5 text-muted-foreground">
        <ShieldCheckIcon
          className="mt-0.5 size-3.5 shrink-0 text-primary"
          aria-hidden="true"
        />
        <p>
          Scanning is read-only. Messimo reads folder names and file metadata,
          skips symbolic links, and reads only size-matched candidates to compute
          SHA-256 duplicate hashes. Nothing moves until you approve each change.
        </p>
      </div>
    </section>
  );
}
