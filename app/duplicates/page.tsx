import type { Metadata } from "next";
import { DuplicatesView } from "@/components/duplicates/duplicates-view";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = {
  title: "Duplicates",
};

export default function DuplicatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Duplicate review"
        title="Same bytes, side by side."
        description="Exact duplicates are found by hashing file contents. Similar names are shown separately so they are never mistaken for copies."
        demo={false}
      />

      <DuplicatesView />
    </div>
  );
}
