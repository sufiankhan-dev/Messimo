import type { ReactNode } from "react";
import { CircleAlertIcon } from "lucide-react";
import { cn } from "cn";

interface ErrorStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title,
  description,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-4 rounded-xl border border-rose-300/60 bg-rose-50/70 p-5 dark:border-rose-300/20 dark:bg-rose-300/[0.06] sm:flex-row sm:items-center",
        className,
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-300/10 dark:text-rose-300">
        <CircleAlertIcon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-medium text-rose-950 dark:text-rose-100">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-6 text-rose-900/80 dark:text-rose-100/70">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
