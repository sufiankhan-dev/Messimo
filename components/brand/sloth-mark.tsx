import { cn } from "cn";

/**
 * SlothSort mark: a sleepy sloth face. Drawn inline so the interface keeps
 * working offline without external image requests or icon fonts.
 */
export function SlothMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground ring-1 ring-primary/30",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="size-6" fill="none">
        <circle
          cx="16"
          cy="17"
          r="9.6"
          fill="currentColor"
          fillOpacity="0.14"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <ellipse
          cx="12.1"
          cy="16.6"
          rx="3.1"
          ry="3.7"
          fill="currentColor"
          opacity="0.85"
        />
        <ellipse
          cx="19.9"
          cy="16.6"
          rx="3.1"
          ry="3.7"
          fill="currentColor"
          opacity="0.85"
        />
        <path
          d="M9.9 16.6c1.3-1.5 2.7-1.5 4 0"
          stroke="var(--background)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M18.1 16.6c1.3-1.5 2.7-1.5 4 0"
          stroke="var(--background)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <ellipse cx="16" cy="20" rx="1.6" ry="1.2" fill="currentColor" />
        <path
          d="M13.9 22.3c1.3 1.1 2.9 1.1 4.2 0"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
