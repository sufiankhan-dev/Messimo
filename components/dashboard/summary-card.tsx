import Link from "next/link";
import { ArrowUpRightIcon, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "cn";

interface SummaryCardProps {
  label: string;
  value: string;
  detail: string;
  href: string;
  icon: LucideIcon;
  tone?: "default" | "attention";
}

export function SummaryCard({
  label,
  value,
  detail,
  href,
  icon: Icon,
  tone = "default",
}: SummaryCardProps) {
  return (
    <Link
      href={href}
      className="group rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className="h-full gap-0 py-4 transition-all group-hover:ring-foreground/20 group-hover:shadow-sm">
        <CardContent className="flex items-start justify-between gap-3 px-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
              {value}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {detail}
            </p>
          </div>
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg ring-1",
              tone === "attention"
                ? "bg-amber-50 text-amber-700 ring-amber-200/80 dark:bg-amber-300/10 dark:text-amber-300 dark:ring-amber-300/20"
                : "bg-muted text-muted-foreground ring-border",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
        </CardContent>
        <CardContent className="mt-3 flex items-center gap-1 px-4 text-[11px] font-medium text-muted-foreground/80">
          View details
          <ArrowUpRightIcon
            className="size-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </CardContent>
      </Card>
    </Link>
  );
}
