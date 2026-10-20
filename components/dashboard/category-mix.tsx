import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategoryCount, FileCategory } from "@/types";
import { cn } from "cn";

const BAR_STYLES: Record<FileCategory, string> = {
  Documents: "bg-slate-400 dark:bg-slate-300",
  Work: "bg-sky-500 dark:bg-sky-400",
  Images: "bg-violet-500 dark:bg-violet-400",
  Projects: "bg-emerald-500 dark:bg-emerald-400",
  Finance: "bg-amber-500 dark:bg-amber-400",
  Archives: "bg-stone-400 dark:bg-stone-300",
  Other: "bg-muted-foreground",
};

export function CategoryMix({
  counts,
  total,
}: {
  counts: CategoryCount[];
  total: number;
}) {
  const max = Math.max(...counts.map((entry) => entry.count), 1);

  return (
    <Card className="gap-0 py-5">
      <CardHeader className="px-5">
        <CardTitle>Category mix</CardTitle>
        <CardDescription>
          Actionable suggestions across {total} files
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pt-4">
        {counts.map(({ category, count }) => (
          <div key={category}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-foreground">{category}</span>
              <span className="tabular-nums text-muted-foreground">
                {count}
              </span>
            </div>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
              aria-hidden="true"
            >
              <div
                className={cn("h-full rounded-full", BAR_STYLES[category])}
                style={{ width: `${Math.max((count / max) * 100, 6)}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
