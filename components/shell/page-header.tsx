import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export function DemoBadge() {
  return (
    <Badge
      variant="outline"
      className="border-amber-300/70 bg-amber-50 text-[10px] font-medium tracking-wide text-amber-900 uppercase dark:border-amber-300/25 dark:bg-amber-300/10 dark:text-amber-200"
    >
      Demo data
    </Badge>
  );
}

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  demo?: boolean;
  children?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  demo = true,
  children,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
          {demo ? <DemoBadge /> : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
          {title}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </header>
  );
}
