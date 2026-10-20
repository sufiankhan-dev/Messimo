import type { Metadata } from "next";
import Link from "next/link";
import { FilesIcon } from "lucide-react";
import { ReviewWorkspace } from "@/components/review/review-workspace";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
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
        description="Generate real suggestions with local Gemma, inspect every category, filename, and destination, then approve what makes sense. Nothing leaves this device."
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

      <ReviewWorkspace />
    </div>
  );
}
