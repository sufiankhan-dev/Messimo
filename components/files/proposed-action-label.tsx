import { MoveRightIcon, MinusIcon } from "lucide-react";
import type { ProposedAction } from "@/types";

const ACTION_LABELS: Record<ProposedAction, string> = {
  move: "Move",
  rename: "Rename",
  "move-and-rename": "Move & rename",
  none: "No change",
};

export function ProposedActionLabel({ action }: { action: ProposedAction }) {
  if (action === "none") {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <MinusIcon className="size-3.5" aria-hidden="true" />
        No change
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <MoveRightIcon
        className="size-3.5 text-muted-foreground"
        aria-hidden="true"
      />
      {ACTION_LABELS[action]}
    </span>
  );
}
