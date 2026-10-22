import { InfoIcon } from "lucide-react";

export function DemoBar() {
  return (
    <div className="border-b border-amber-200/70 bg-amber-50/80 text-amber-950 dark:border-amber-300/15 dark:bg-amber-300/[0.06] dark:text-amber-100/90">
      <div className="mx-auto flex w-full max-w-6xl items-start gap-2 px-4 py-2 text-xs leading-5 sm:items-center sm:px-6 lg:px-8">
        <InfoIcon
          className="mt-0.5 size-3.5 shrink-0 sm:mt-0"
          aria-hidden="true"
        />
        <p>
          <span className="font-medium">
            Messimo is a working local MVP: scan, duplicate detection, local
            Gemma suggestions, approved moves, and undo are live.
          </span>{" "}
          <span className="hidden sm:inline">
            Folder access, SHA-256 duplicate review, Ollama inference, bounded
            text extraction, batch review, verified moves, and local history all
            run on this machine.
          </span>{" "}
          No file changes without your explicit approval.
        </p>
      </div>
    </div>
  );
}
