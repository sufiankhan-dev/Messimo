import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import type { FileCategory } from "@/types";

const CATEGORY_STYLES: Record<FileCategory, string> = {
  Documents:
    "bg-slate-100 text-slate-700 dark:bg-slate-400/10 dark:text-slate-300",
  Work: "bg-sky-100/80 text-sky-800 dark:bg-sky-400/10 dark:text-sky-300",
  Images:
    "bg-violet-100/80 text-violet-800 dark:bg-violet-400/10 dark:text-violet-300",
  Projects:
    "bg-emerald-100/80 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300",
  Finance:
    "bg-amber-100/80 text-amber-900 dark:bg-amber-400/10 dark:text-amber-300",
  Archives:
    "bg-stone-200/70 text-stone-700 dark:bg-stone-400/10 dark:text-stone-300",
  Other: "bg-muted text-muted-foreground",
};

export function CategoryBadge({
  category,
  className,
}: {
  category: FileCategory;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent font-medium", CATEGORY_STYLES[category], className)}
    >
      {category}
    </Badge>
  );
}
