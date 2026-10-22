import { cn } from "cn";

/**
 * Messimo mark: a rounded folder with a sorted check. Drawn inline so the
 * interface keeps working offline without external image requests or icon
 * fonts.
 */
export function MessimoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground ring-1 ring-primary/30",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="size-6" fill="none">
        <path
          d="M4.8 10.6a2.8 2.8 0 0 1 2.8-2.8h6l2.3 2.6h8.5a2.8 2.8 0 0 1 2.8 2.8v9.8a2.8 2.8 0 0 1-2.8 2.8H7.6a2.8 2.8 0 0 1-2.8-2.8z"
          fill="currentColor"
          fillOpacity="0.16"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M5.2 13.6h21.6"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M9.8 18.4h5.9M9.8 21.9h3.9"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.9"
        />
        <path
          d="M18.9 20.9l1.8 1.8 3.4-3.7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
