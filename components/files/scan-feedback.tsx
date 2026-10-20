import {
  LoaderCircleIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Callout } from "@/components/ui/callout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Progress,
  ProgressLabel,
} from "@/components/ui/progress";
import { formatCount, pluralize } from "@/lib/format";
import type { ScanProgress, ScanResult } from "@/types";

interface ScanProgressCardProps {
  folderName: string;
  progress: ScanProgress | null;
  onCancel: () => void;
}

export function ScanProgressCard({
  folderName,
  progress,
  onCancel,
}: ScanProgressCardProps) {
  const current = progress?.currentRelativePath || "folder root";
  const hashing = progress?.phase === "hashing";
  const hashedFiles = progress?.hashedFiles ?? 0;
  const filesToHash = progress?.filesToHash ?? 0;
  const percent =
    hashing && filesToHash > 0
      ? Math.round((hashedFiles / filesToHash) * 100)
      : null;

  return (
    <Card className="gap-0 py-5" aria-busy="true">
      <CardContent className="space-y-4 px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <LoaderCircleIcon
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            </span>
            <div>
              <h2 className="text-sm font-medium text-foreground">
                {hashing
                  ? `Checking ${folderName} for duplicates`
                  : `Scanning ${folderName}`}
              </h2>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {hashing
                  ? "Comparing SHA-256 hashes for files that share a size. Only candidate files are read, and nothing is changed."
                  : "Reading names and metadata. No file is changed."}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel scan
          </Button>
        </div>

        <Progress value={percent} className="text-left">
          <ProgressLabel className={hashing ? "text-xs font-normal text-muted-foreground" : "sr-only"}>
            {hashing
              ? `${formatCount(hashedFiles)} of ${formatCount(filesToHash)} candidate files hashed`
              : "Folder scan progress"}
          </ProgressLabel>
        </Progress>

        <dl
          className="grid gap-2 text-xs sm:grid-cols-3"
          aria-live="polite"
        >
          <div className="rounded-lg border border-border/70 px-3 py-2">
            <dt className="text-muted-foreground">Files</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
              {formatCount(progress?.scannedFiles ?? 0)}
            </dd>
          </div>
          <div className="rounded-lg border border-border/70 px-3 py-2">
            <dt className="text-muted-foreground">
              {hashing ? "Hashed" : "Folders"}
            </dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
              {hashing
                ? `${formatCount(hashedFiles)} / ${formatCount(filesToHash)}`
                : formatCount(progress?.directoriesScanned ?? 0)}
            </dd>
          </div>
          <div className="rounded-lg border border-border/70 px-3 py-2">
            <dt className="text-muted-foreground">Skipped</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
              {formatCount(progress?.skippedCount ?? 0)}
            </dd>
          </div>
        </dl>

        <div className="flex items-start gap-2 text-[11px] leading-5 text-muted-foreground">
          <ShieldCheckIcon
            className="mt-0.5 size-3.5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <p className="min-w-0">
            Current:{" "}
            <span className="break-all font-mono text-foreground">
              {current}
            </span>
            . Cancelling stops the scan immediately; no file is changed.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ScanResultNotices({ result }: { result: ScanResult }) {
  return (
    <div className="space-y-3">
      {result.truncated ? (
        <Callout tone="warning" title="Scan stopped at a safety limit">
          {result.truncationReason ??
            "The folder was too large to scan completely."}{" "}
          Choose a smaller folder, or scan again later. The files already listed
          were not changed.
        </Callout>
      ) : null}

      {result.skippedCount > 0 ? (
        <Callout tone="warning" title={`${pluralize(result.skippedCount, "entry", "entries")} skipped`}>
          Symbolic links, unreadable entries, and special files are left out
          safely. They are never followed or modified.
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium text-foreground">
              Show skipped entries
            </summary>
            <ul className="mt-2 space-y-1.5">
              {result.skipped.map((entry) => (
                <li
                  key={`${entry.relativePath}-${entry.reason}`}
                  className="text-xs leading-5"
                >
                  <span className="break-all font-mono">{entry.relativePath}</span>
                  <span className="text-muted-foreground"> — {entry.reason}</span>
                </li>
              ))}
            </ul>
            {result.skippedCount > result.skipped.length ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Showing the first {result.skipped.length} of{" "}
                {result.skippedCount} skipped entries.
              </p>
            ) : null}
          </details>
        </Callout>
      ) : null}

      {result.hashingFailures.length > 0 ? (
        <Callout
          tone="warning"
          title={`${pluralize(
            result.hashingFailures.length,
            "file",
          )} could not be checked for duplicates`}
        >
          These files were listed but their contents could not be hashed, so
          they were left out of duplicate detection. Nothing was changed.
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium text-foreground">
              Show files that were not hashed
            </summary>
            <ul className="mt-2 space-y-1.5">
              {result.hashingFailures.map((failure) => (
                <li
                  key={`${failure.relativePath}-${failure.reason}`}
                  className="text-xs leading-5"
                >
                  <span className="break-all font-mono">
                    {failure.relativePath}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    — {failure.reason}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </Callout>
      ) : null}

      {result.files.length === 0 && result.skippedCount > 0 ? (
        <Callout tone="info" title="No readable files were found">
          Every entry in this folder was skipped. Check folder permissions or
          choose another folder. Nothing was changed.
        </Callout>
      ) : null}
    </div>
  );
}

export function ScanCancelledNotice({
  onResume,
}: {
  onResume: () => void;
}) {
  return (
    <Callout tone="warning" title="Scan cancelled">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>
          The scan stopped before it finished. Files already read were left
          untouched.
        </p>
        <Button variant="outline" size="sm" onClick={onResume}>
          <TriangleAlertIcon aria-hidden="true" />
          Scan again
        </Button>
      </div>
    </Callout>
  );
}
