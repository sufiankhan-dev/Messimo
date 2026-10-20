import Link from "next/link";
import { ArrowRightIcon, FolderOpenIcon, ShieldCheckIcon } from "lucide-react";
import { SlothMark } from "@/components/brand/sloth-mark";
import { FolderPickerDialog } from "@/components/dashboard/folder-picker-dialog";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatBytes, formatDate, pluralize } from "@/lib/format";
import { cn } from "cn";

interface FolderCardProps {
  name: string;
  displayPath: string;
  platform: string;
  lastScannedAt: string;
  fileCount: number;
  totalBytes: number;
  proposedChanges: number;
}

export function FolderCard({
  name,
  displayPath,
  platform,
  lastScannedAt,
  fileCount,
  totalBytes,
  proposedChanges,
}: FolderCardProps) {
  return (
    <section
      aria-labelledby="folder-heading"
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
    >
      <div
        className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-accent/70 blur-3xl"
        aria-hidden="true"
      />
      <SlothMark
        className="pointer-events-none absolute -right-2 -bottom-5 size-28 rotate-[-8deg] opacity-[0.045]"
      />

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
                  {name}
                </h2>
                <Badge
                  variant="outline"
                  className="h-4 bg-muted px-1.5 text-[9px] text-muted-foreground uppercase"
                >
                  Sample
                </Badge>
              </div>
            </div>
          </div>

          <p className="font-mono text-base font-medium break-all text-foreground sm:text-lg">
            {displayPath}
          </p>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            <span>{platform}</span>
            <span aria-hidden="true">·</span>
            <span>{pluralize(fileCount, "file")}</span>
            <span aria-hidden="true">·</span>
            <span>{formatBytes(totalBytes)}</span>
            <span aria-hidden="true">·</span>
            <span>Last sampled {formatDate(lastScannedAt)}</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:justify-end">
          <FolderPickerDialog />
          <Link
            href="/review"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-10 gap-2 px-4 text-sm",
            )}
          >
            Review {proposedChanges} suggestions
            <ArrowRightIcon aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="relative mt-5 flex items-start gap-2 border-t border-border/70 pt-3 text-[11px] leading-5 text-muted-foreground">
        <ShieldCheckIcon
          className="mt-0.5 size-3.5 shrink-0 text-primary"
          aria-hidden="true"
        />
        <p>
          Scanning is read-only. Nothing moves until you approve each change,
          and SlothSort never deletes files.
        </p>
      </div>
    </section>
  );
}
