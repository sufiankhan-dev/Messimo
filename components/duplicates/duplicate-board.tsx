"use client";

import { useState } from "react";
import { CopyIcon, FingerprintIcon, ShieldCheckIcon } from "lucide-react";
import { FileIcon } from "@/components/files/file-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  formatBytes,
  formatDate,
  formatShortHash,
  pluralize,
} from "@/lib/format";
import type { DuplicateGroupView, ScannedFile } from "@/types";
import { cn } from "cn";

export interface SimilarNameView {
  id: string;
  note: string;
  files: ScannedFile[];
}

interface DuplicateBoardProps {
  groups: DuplicateGroupView[];
  similarGroups: SimilarNameView[];
}

export function DuplicateBoard({ groups, similarGroups }: DuplicateBoardProps) {
  const [selection, setSelection] = useState<Record<string, string>>({});

  if (groups.length === 0 && similarGroups.length === 0) {
    return (
      <EmptyState
        title="No exact duplicates"
        description="Messimo compares SHA-256 content hashes, not filenames. No two files in this scan share the same contents."
        icon={ShieldCheckIcon}
      />
    );
  }

  return (
    <div className="space-y-4">
      {groups.length > 0 ? (
        <Callout tone="info" title="Nothing is deleted, ever">
          Duplicate review is informational. Choosing a copy to keep is a preview
          only; removing duplicates is not implemented, and cleanup remains a
          manual decision.
        </Callout>
      ) : (
        <Callout tone="success" title="No exact duplicates">
          No two files share the same contents. The similarly named files below
          have different content hashes, so they are not copies.
        </Callout>
      )}

      {groups.map((group, index) => (
        <DuplicateGroupCard
          key={group.id}
          group={group}
          index={index}
          selectedFileId={selection[group.id] ?? null}
          onSelect={(fileId) =>
            setSelection((previous) => ({ ...previous, [group.id]: fileId }))
          }
          onKeepBoth={() =>
            setSelection((previous) => {
              const next = { ...previous };
              delete next[group.id];
              return next;
            })
          }
        />
      ))}

      {similarGroups.length > 0 ? (
        <Card className="gap-0 border-dashed py-5">
          <CardHeader className="px-5">
            <CardTitle className="flex items-center gap-2">
              <CopyIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Similar names, different contents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pt-3">
            {similarGroups.map((group) => (
              <div key={group.id} className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {group.files.map((file) => (
                    <span
                      key={file.id}
                      title={file.relativePath}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1 font-mono text-[11px]"
                    >
                      <FileIcon
                        kind={file.kind}
                        extension={file.extension}
                        className="size-5 shrink-0 rounded"
                      />
                      <span className="min-w-0">
                        <span className="block truncate">{file.name}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {file.relativePath}
                        </span>
                      </span>
                    </span>
                  ))}
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  {group.note}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function DuplicateGroupCard({
  group,
  index,
  selectedFileId,
  onSelect,
  onKeepBoth,
}: {
  group: DuplicateGroupView;
  index: number;
  selectedFileId: string | null;
  onSelect: (fileId: string) => void;
  onKeepBoth: () => void;
}) {
  const selectedFile = group.files.find((file) => file.id === selectedFileId);

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b border-border bg-muted/30 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Duplicate group {index + 1}</CardTitle>
              <Badge
                variant="outline"
                className="border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-200"
              >
                Exact match
              </Badge>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{pluralize(group.files.length, "file")}</span>
              <span aria-hidden="true">·</span>
              <span>{formatBytes(group.sizeBytes)} each</span>
              <span aria-hidden="true">·</span>
              <span>{formatBytes(group.recoverableBytes)} recoverable</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-background px-2 py-1 text-[11px] text-muted-foreground ring-1 ring-border">
            <FingerprintIcon className="size-3" aria-hidden="true" />
            <span className="font-mono" title={group.sha256}>
              SHA-256 {formatShortHash(group.sha256)}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 py-4 sm:px-5">
        <fieldset>
          <legend className="sr-only">
            Choose a copy to keep from duplicate group {index + 1}
          </legend>
          <div className="space-y-2">
            {group.files.map((file) => {
              const selected = file.id === selectedFileId;
              return (
                <label
                  key={file.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                    selected
                      ? "border-primary/40 bg-primary/5"
                      : "border-border hover:bg-muted/40",
                  )}
                >
                  <input
                    type="radio"
                    name={`duplicate-${group.id}`}
                    value={file.id}
                    checked={selected}
                    onChange={() => onSelect(file.id)}
                    className="mt-2 size-4 shrink-0 accent-[var(--primary)]"
                  />
                  <FileIcon kind={file.kind} extension={file.extension} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium break-all text-foreground">
                        {file.name}
                      </span>
                      {selected ? (
                        <Badge
                          variant="outline"
                          className="border-primary/25 bg-primary/10 text-primary"
                        >
                          Preview: keep this
                        </Badge>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
                      {file.relativePath}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {formatBytes(file.sizeBytes)} · Modified{" "}
                      {formatDate(file.modifiedAt)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-5 text-muted-foreground">
            {selectedFile
              ? `Preview only: ${selectedFile.name} would be kept. No file is deleted or moved.`
              : "Choose a copy to compare, or keep both. Nothing is deleted automatically."}
          </p>
          {selectedFile ? (
            <Button variant="ghost" size="xs" onClick={onKeepBoth}>
              Clear selection
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
