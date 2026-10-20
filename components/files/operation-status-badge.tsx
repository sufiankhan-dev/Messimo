import {
  CircleCheckIcon,
  CircleDashedIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OPERATION_STATUS_LABELS } from "@/lib/workspace/history";
import type { OperationStatus } from "@/types";
import { cn } from "cn";

const STATUS_STYLES: Record<OperationStatus, string> = {
  completed:
    "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-200",
  partial:
    "border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-200",
  failed:
    "border-rose-200/80 bg-rose-50 text-rose-800 dark:border-rose-300/20 dark:bg-rose-300/10 dark:text-rose-200",
  undone: "border-border bg-muted text-muted-foreground",
};

const STATUS_ICONS: Record<OperationStatus, LucideIcon> = {
  completed: CircleCheckIcon,
  partial: TriangleAlertIcon,
  failed: XIcon,
  undone: RotateCcwIcon,
};

interface OperationStatusBadgeProps {
  status: OperationStatus;
  /** A batch that stopped before it could mark itself finished. */
  interrupted?: boolean;
  className?: string;
}

export function OperationStatusBadge({
  status,
  interrupted = false,
  className,
}: OperationStatusBadgeProps) {
  const Icon = interrupted ? CircleDashedIcon : STATUS_ICONS[status];

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-medium", STATUS_STYLES[status], className)}
    >
      <Icon className="size-3" aria-hidden="true" />
      {interrupted ? "Interrupted" : OPERATION_STATUS_LABELS[status]}
    </Badge>
  );
}
