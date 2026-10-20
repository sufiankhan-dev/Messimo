import { CopyIcon, TriangleAlertIcon, FileWarningIcon } from "lucide-react";
import { CategoryBadge } from "@/components/files/category-badge";
import { FileIcon } from "@/components/files/file-icon";
import { ProposedActionLabel } from "@/components/files/proposed-action-label";
import { ReviewStatusBadge } from "@/components/files/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBytes } from "@/lib/format";
import { getProposedAction } from "@/lib/workspace/summary";
import type { FileKind, OrganizationFile } from "@/types";

const KIND_LABELS: Record<FileKind, string> = {
  document: "Document",
  image: "Image",
  archive: "Archive",
  other: "Other",
};

export function FileTable({ files }: { files: OrganizationFile[] }) {
  return (
    <Table className="min-w-[760px]">
      <TableCaptionText />
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-4">File</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Size</TableHead>
          <TableHead>Suggested category</TableHead>
          <TableHead>Proposed action</TableHead>
          <TableHead className="pr-4">Review status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {files.map((file) => (
          <TableRow key={file.id}>
            <TableCell className="max-w-[280px] py-3 pl-4">
              <div className="flex items-center gap-3">
                <FileIcon kind={file.kind} extension={file.extension} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-foreground">
                      {file.name}
                    </p>
                    {file.duplicateGroupId ? (
                      <CopyIcon
                        className="size-3 shrink-0 text-muted-foreground"
                        aria-label="Exact duplicate"
                      />
                    ) : null}
                    {file.warnings.length > 0 ? (
                      <TriangleAlertIcon
                        className="size-3 shrink-0 text-amber-600 dark:text-amber-300"
                        aria-label={file.warnings.join(" ")}
                      />
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                    {file.relativePath}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <span className="block text-[11px] font-semibold tracking-wide text-foreground uppercase">
                {file.extension}
              </span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {KIND_LABELS[file.kind]}
              </span>
            </TableCell>
            <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
              {formatBytes(file.sizeBytes)}
            </TableCell>
            <TableCell>
              {file.suggestion ? (
                <CategoryBadge category={file.suggestion.category} />
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <FileWarningIcon className="size-3.5" aria-hidden="true" />
                  No category
                </span>
              )}
            </TableCell>
            <TableCell className="text-xs">
              <ProposedActionLabel action={getProposedAction(file)} />
            </TableCell>
            <TableCell className="pr-4">
              <ReviewStatusBadge status={file.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TableCaptionText() {
  return (
    <caption className="sr-only">
      Files in the sample folder with suggested categories, proposed actions,
      and review status. This is demo data only.
    </caption>
  );
}
