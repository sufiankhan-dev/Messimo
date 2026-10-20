import { ArrowUpRightIcon, type LucideIcon } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";

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
  icon,
  tone = "default",
}: SummaryCardProps) {
  return (
    <StatCard
      label={label}
      value={value}
      detail={detail}
      icon={icon}
      tone={tone}
      href={href}
      footer={
        <>
          View details
          <ArrowUpRightIcon
            className="size-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </>
      }
    />
  );
}
