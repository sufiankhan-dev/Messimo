import {
  FolderSearchIcon,
  ListChecksIcon,
  RotateCcwIcon,
  WandSparklesIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

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
    <Card aria-labelledby="workflow-heading" className="h-full gap-0 py-5">
      <CardHeader className="px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2
            id="workflow-heading"
            className="font-heading text-base leading-snug font-medium text-foreground"
          >
            How Messimo works
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Local AI, human decisions
          </p>
        </div>
        <CardDescription>
          Four steps, and every one of them runs on this computer.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-5 pt-5">
        <ol className="flex flex-1 flex-col">
          {STEPS.map(({ icon: Icon, title, description }, index) => {
            const isLast = index === STEPS.length - 1;

            return (
              <li
                key={title}
                className="relative flex grow gap-3 pb-5 last:pb-0"
              >
                {isLast ? null : (
                  <span
                    aria-hidden="true"
                    className="absolute top-9 bottom-0 left-4 w-px -translate-x-1/2 bg-border"
                  />
                )}
                <span className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground/70 tabular-nums">
                      0{index + 1}
                    </span>
                    <p className="text-sm font-medium text-foreground">
                      {title}
                    </p>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
