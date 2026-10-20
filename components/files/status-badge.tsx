import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import type { ReviewStatus } from "@/types";

const STATUS_CONFIG: Record<
  ReviewStatus,
  { label: string; icon: typeof CircleCheckIcon; className: string }
> = {
  pending: {
    label: "Pending",
    icon: CircleDashedIcon,
    className:
      "border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-200",
  },
  "needs-review": {
    label: "Needs review",
    icon: TriangleAlertIcon,
    className:
      "border-rose-200/80 bg-rose-50 text-rose-800 dark:border-rose-300/20 dark:bg-rose-300/10 dark:text-rose-200",
  },
  approved: {
    label: "Approved",
    icon: CircleCheckIcon,
    className:
      "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-200",
  },
  rejected: {
    label: "Rejected",
    icon: CircleXIcon,
    className:
      "border-border bg-muted text-muted-foreground dark:bg-muted/60",
  },
};

export function ReviewStatusBadge({
  status,
  className,
}: {
  status: ReviewStatus;
  className?: string;
}) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-medium", config.className, className)}
    >
      <Icon className="size-3" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}

export const REVIEW_STATUS_LABELS = {
  pending: STATUS_CONFIG.pending.label,
  approved: STATUS_CONFIG.approved.label,
  rejected: STATUS_CONFIG.rejected.label,
  "needs-review": STATUS_CONFIG["needs-review"].label,
} as const;
