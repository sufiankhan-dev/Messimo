import {
  FolderSearchIcon,
  ListChecksIcon,
  RotateCcwIcon,
  WandSparklesIcon,
} from "lucide-react";

const STEPS = [
  {
    icon: FolderSearchIcon,
    title: "Scan safely",
    description: "Read-only metadata and SHA-256 duplicate checks.",
  },
  {
    icon: WandSparklesIcon,
    title: "Local suggestions",
    description: "Gemma names, categorizes, and picks folders on-device.",
  },
  {
    icon: ListChecksIcon,
    title: "You review",
    description: "Approve or reject every change before anything moves.",
  },
  {
    icon: RotateCcwIcon,
    title: "Apply & undo",
    description: "Approved moves are recorded locally and reversible.",
  },
];

export function WorkflowSteps() {
  return (
    <section aria-labelledby="workflow-heading" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="workflow-heading"
          className="text-sm font-medium text-foreground"
        >
          How Messimo works
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Local AI, human decisions
        </p>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STEPS.map(({ icon: Icon, title, description }, index) => (
          <li
            key={title}
            className="rounded-xl border border-border bg-card/60 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground/70 tabular-nums">
                0{index + 1}
              </span>
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
