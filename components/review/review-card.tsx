"use client";

import {
  ArrowRightIcon,
  CheckIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import { CategoryBadge } from "@/components/files/category-badge";
import { ConfidenceBadge } from "@/components/files/confidence-badge";
import { FileIcon } from "@/components/files/file-icon";
import { ReviewStatusBadge } from "@/components/files/status-badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { formatBytes, formatDate, formatDestination } from "@/lib/format";
import type { OrganizationFile, ReviewStatus } from "@/types";
import { cn } from "cn";

interface ReviewCardProps {
  file: OrganizationFile;
  canReset: boolean;
  onDecide: (fileId: string, status: ReviewStatus) => void;
  onReset: (fileId: string) => void;
}

export function ReviewCard({
  file,
  canReset,
  onDecide,
  onReset,
}: ReviewCardProps) {
  const suggestion = file.suggestion;
  const approved = file.status === "approved";
  const rejected = file.status === "rejected";
  const approveLabel = suggestion ? "Approve" : "Keep in place";
  const rejectLabel = suggestion ? "Reject" : "Dismiss";

  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden py-0 transition-colors",
        rejected && "opacity-75",
      )}
    >
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <FileIcon kind={file.kind} extension={file.extension} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium break-all text-foreground">
                {file.name}
              </h3>
              <ReviewStatusBadge status={file.status} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatBytes(file.sizeBytes)} · Modified{" "}
              {formatDate(file.modifiedAt)}
            </p>
          </div>
        </div>

        {suggestion ? (
          <div className="rounded-xl border border-border bg-muted/35 p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={suggestion.category} />
              <ConfidenceBadge uncertainty={suggestion.uncertainty} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Destination</span>
              <ArrowRightIcon
                className="size-3 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="font-mono text-xs break-all text-foreground">
                {formatDestination(
                  suggestion.suggestedRelativePath,
                  suggestion.suggestedFileName,
                )}
              </span>
            </div>
            <p className="mt-2 border-t border-border/60 pt-2 text-xs leading-5 text-muted-foreground">
              {suggestion.reason}
            </p>
          </div>
        ) : (
          <Callout tone="warning" title="No safe suggestion for this file">
            SlothSort will not guess a destination for this file. Review the
            warning below, then keep it in place or dismiss it.
          </Callout>
        )}

        {file.warnings.length > 0 ? (
          <Callout tone="warning" title="Needs a closer look">
            <ul className="space-y-1">
              {file.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </Callout>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={approved ? "default" : "outline"}
            aria-pressed={approved}
            onClick={() => onDecide(file.id, "approved")}
          >
            <CheckIcon aria-hidden="true" />
            {approveLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={rejected ? "destructive" : "ghost"}
            aria-pressed={rejected}
            onClick={() => onDecide(file.id, "rejected")}
          >
            <XIcon aria-hidden="true" />
            {rejectLabel}
          </Button>
          {canReset ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onReset(file.id)}
            >
              <RotateCcwIcon aria-hidden="true" />
              Reset
            </Button>
          ) : null}
          <p className="ml-auto text-[11px] text-muted-foreground">
            Demo decision only
          </p>
        </div>
      </div>
    </Card>
  );
}
