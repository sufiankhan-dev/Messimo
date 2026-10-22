import Link from "next/link";
import { CompassIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <CompassIcon className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-4 text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
          404
        </p>
        <h1 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
          This page wandered off
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Messimo looked everywhere, but this page is not in the folder. Nothing
          on disk was changed.
        </p>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "default" }), "mt-5")}
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
