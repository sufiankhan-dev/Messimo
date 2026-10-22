import type { Metadata } from "next";
import { ShieldCheckIcon } from "lucide-react";
import { ScanView } from "@/components/files/scan-view";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Folder scan",
};

export default function ScanPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Folder scan"
        title="Every file, in plain sight."
        description="Inspect the metadata of files in one approved folder. Messimo never follows links or changes anything during a scan, and reads only size-matched candidates to compute SHA-256 duplicate hashes."
      >
        <Badge
          variant="outline"
          className="h-7 gap-1.5 bg-card px-2.5 text-xs font-medium"
        >
          <ShieldCheckIcon
            className="size-3.5 text-primary"
            aria-hidden="true"
          />
          Read-only
        </Badge>
      </PageHeader>

      <ScanView />
    </div>
  );
}
