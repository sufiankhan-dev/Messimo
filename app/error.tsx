"use client";

import Link from "next/link";
import { CircleAlertIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-300/10 dark:text-rose-300">
          <CircleAlertIcon className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
          Messimo could not render this screen
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          No files were changed. Try the screen again, or return to the
          dashboard. If the problem continues, restart the local app.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Link
            href="/"
            className={buttonVariants({ variant: "outline" })}
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
