import { CircleHelpIcon, ShieldCheckIcon, ShieldQuestionIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import type { Uncertainty } from "@/types";

const CONFIDENCE_CONFIG = {
  low: {
    label: "High confidence",
    icon: ShieldCheckIcon,
    className:
      "border-emerald-200/80 bg-emerald-50/70 text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-200",
  },
  medium: {
    label: "Medium confidence",
    icon: ShieldQuestionIcon,
    className:
      "border-amber-200/80 bg-amber-50/70 text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-200",
  },
  high: {
    label: "Low confidence",
    icon: CircleHelpIcon,
    className:
      "border-rose-200/80 bg-rose-50/70 text-rose-800 dark:border-rose-300/20 dark:bg-rose-300/10 dark:text-rose-200",
  },
} as const;

export function ConfidenceBadge({
  uncertainty,
  className,
}: {
  uncertainty: Uncertainty;
  className?: string;
}) {
  const config = CONFIDENCE_CONFIG[uncertainty];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-medium", config.className, className)}
      title="Confidence reflects filename and metadata signals only. It is not a guarantee."
    >
      <Icon className="size-3" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}
