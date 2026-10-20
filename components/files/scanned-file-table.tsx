import { FileWarningIcon, TriangleAlertIcon } from "lucide-react";
import { FileIcon } from "@/components/files/file-icon";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBytes, formatDateTime } from "@/lib/format";
import type { FileKind, ScannedFile } from "@/types";

const KIND_LABELS: Record<FileKind, string> = {
  document: "Document",
  image: "Image",
  archive: "Archive",
  other: "Other",
};

export function ScannedFileTable({ files }: { files: ScannedFile[] }) {
  return (
    <Table className="min-w-[780px]">
      <TableCaption className="sr-only">
        Files found in the approved folder with their relative path, type, size,
        and modification time. Scanning is read-only.
      </TableCaption>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-4">File</TableHead>
          <TableHead>Detected type</TableHead>
          <TableHead className="text-right">Size</TableHead>
          <TableHead>Modified</TableHead>
          <TableHead className="pr-4">Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {files.map((file) => {
          const unsupported = file.kind === "other";

          return (
            <TableRow key={file.id}>
              <TableCell className="max-w-[320px] py-3 pl-4">
                <div className="flex items-center gap-3">
                  <FileIcon kind={file.kind} extension={file.extension} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p
                        className="truncate text-sm font-medium text-foreground"
                        title={file.name}
                      >
                        {file.name}
                      </p>
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
                <span
                  className="block max-w-[240px] truncate font-mono text-[11px] text-foreground"
                  title={file.mimeType ?? "Unknown MIME type"}
                >
                  {file.mimeType ?? "Unknown"}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {KIND_LABELS[file.kind]}
                  {file.extension ? ` · .${file.extension}` : ""}
                </span>
              </TableCell>
              <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                {formatBytes(file.sizeBytes)}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatDateTime(file.modifiedAt)}
              </TableCell>
              <TableCell className="pr-4 text-xs">
                {unsupported ? (
                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                    <FileWarningIcon className="size-3.5" aria-hidden="true" />
                    Unsupported
                  </span>
                ) : (
                  <span className="text-muted-foreground">Listed</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
