import {
  File as FileGlyph,
  FileArchiveIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  ImageIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import type { FileKind } from "@/types";

const KIND_STYLES: Record<FileKind, { icon: LucideIcon; className: string }> = {
  document: {
    icon: FileTextIcon,
    className:
      "bg-sky-50 text-sky-700 ring-sky-200/80 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/20",
  },
  image: {
    icon: ImageIcon,
    className:
      "bg-violet-50 text-violet-700 ring-violet-200/80 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/20",
  },
  archive: {
    icon: FileArchiveIcon,
    className:
      "bg-amber-50 text-amber-700 ring-amber-200/80 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20",
  },
  other: {
    icon: FileGlyph,
    className:
      "bg-muted text-muted-foreground ring-border dark:bg-muted/60 dark:text-muted-foreground",
  },
};

const SPREADSHEET_EXTENSIONS = new Set(["xlsx", "xls", "csv"]);

interface FileIconProps {
  kind: FileKind;
  extension: string;
  className?: string;
}

export function FileIcon({ kind, extension, className }: FileIconProps) {
  const style = KIND_STYLES[kind];
  const Icon = SPREADSHEET_EXTENSIONS.has(extension.toLowerCase())
    ? FileSpreadsheetIcon
    : style.icon;

  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg ring-1",
        style.className,
        className,
      )}
      aria-hidden="true"
    >
      <Icon className="size-4" />
    </span>
  );
}
