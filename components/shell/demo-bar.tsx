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
            Read-only scan and local AI tests are live.
          </span>{" "}
          <span className="hidden sm:inline">
            Folder access and Ollama diagnostics are real. Bulk suggestions,
            review, and file moves still use demo data.
          </span>{" "}
          No file is changed.
        </p>
      </div>
    </div>
  );
}
