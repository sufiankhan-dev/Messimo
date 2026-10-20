import type { ReactNode } from "react";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";

export type CalloutTone = "info" | "warning" | "success" | "danger";

const TONES: Record<
  CalloutTone,
  { container: string; icon: LucideIcon; iconClass: string }
> = {
  info: {
    container: "border-border bg-muted/40",
    icon: InfoIcon,
    iconClass: "text-muted-foreground",
  },
  warning: {
    container:
      "border-amber-300/60 bg-amber-50/80 text-amber-950 dark:border-amber-300/20 dark:bg-amber-300/[0.07] dark:text-amber-100",
    icon: TriangleAlertIcon,
    iconClass: "text-amber-600 dark:text-amber-300",
  },
  success: {
    container:
      "border-emerald-300/60 bg-emerald-50/80 text-emerald-950 dark:border-emerald-300/20 dark:bg-emerald-300/[0.07] dark:text-emerald-100",
    icon: CircleCheckIcon,
    iconClass: "text-emerald-600 dark:text-emerald-300",
  },
  danger: {
    container:
      "border-rose-300/60 bg-rose-50/80 text-rose-950 dark:border-rose-300/20 dark:bg-rose-300/[0.07] dark:text-rose-100",
    icon: CircleAlertIcon,
    iconClass: "text-rose-600 dark:text-rose-300",
  },
};

interface CalloutProps {
  tone?: CalloutTone;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Callout({ tone = "info", title, children, className }: CalloutProps) {
  const config = TONES[tone];
  const Icon = config.icon;

  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm leading-6",
        config.container,
        className,
      )}
    >
      <Icon
        className={cn("mt-0.5 size-4 shrink-0", config.iconClass)}
        aria-hidden="true"
      />
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        <div className={cn("text-sm", title ? "mt-0.5 opacity-90" : undefined)}>
          {children}
        </div>
      </div>
    </div>
  );
}
