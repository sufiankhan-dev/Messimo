import type { Metadata } from "next";
import Link from "next/link";
import { FilesIcon } from "lucide-react";
import { ReviewBoard } from "@/components/review/review-board";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { DEMO_FILES } from "@/lib/mock/demo-workspace";
import { cn } from "cn";

export const metadata: Metadata = {
  title: "Review",
};

export default function ReviewPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organization review"
        title="Review with confidence."
        description="Inspect every suggestion, approve what makes sense, and reject what does not. Nothing leaves this device."
      >
        <Link
          href="/scan"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-9 gap-2 px-3",
          )}
        >
          <FilesIcon aria-hidden="true" />
          View all files
        </Link>
      </PageHeader>

      <Callout tone="info" title="Demo suggestions, real safety rules">
        These categories and filenames are sample data; local Gemma inference is
        not wired up yet. Approve or reject freely — decisions only update this
        page, and no file is moved, renamed, or deleted.
      </Callout>

      <ReviewBoard files={DEMO_FILES} />
    </div>
  );
}
