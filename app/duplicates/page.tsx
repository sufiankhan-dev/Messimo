import type { Metadata } from "next";
import { CopyIcon, FilesIcon, HardDriveIcon } from "lucide-react";
import {
  DuplicateBoard,
  type SimilarNameView,
} from "@/components/duplicates/duplicate-board";
import { PageHeader } from "@/components/shell/page-header";
import { formatBytes, pluralize } from "@/lib/format";
import {
  DEMO_DUPLICATE_GROUPS,
  DEMO_FILES,
  DEMO_SIMILAR_NAME_GROUPS,
} from "@/lib/mock/demo-workspace";
import {
  buildDuplicateGroups,
  buildSimilarNameGroups,
  getRecoverableBytes,
} from "@/lib/workspace/duplicates";

export const metadata: Metadata = {
  title: "Duplicates",
};

export default function DuplicatesPage() {
  const groups = buildDuplicateGroups(DEMO_FILES, DEMO_DUPLICATE_GROUPS);
  const recoverableBytes = getRecoverableBytes(groups);
  const duplicateFiles = groups.reduce(
    (total, group) => total + group.files.length,
    0,
  );
  const similarGroups: SimilarNameView[] = buildSimilarNameGroups(
    DEMO_FILES,
    DEMO_SIMILAR_NAME_GROUPS,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Duplicate review"
        title="Same bytes, side by side."
        description="Exact duplicates are found by hashing file contents. Similar names are shown separately so they are never mistaken for copies."
      />

      <dl className="grid gap-3 sm:grid-cols-3">
        <DuplicateStat
          label="Exact duplicate groups"
          value={String(groups.length)}
          detail="Matched by SHA-256, never by name"
          icon={CopyIcon}
        />
        <DuplicateStat
          label="Duplicate files"
          value={String(duplicateFiles)}
          detail={`Across ${pluralize(groups.length, "group")}`}
          icon={FilesIcon}
        />
        <DuplicateStat
          label="Recoverable space"
          value={formatBytes(recoverableBytes)}
          detail="If you choose to consolidate later"
          icon={HardDriveIcon}
        />
      </dl>

      <DuplicateBoard groups={groups} similarGroups={similarGroups} />
    </div>
  );
}

function DuplicateStat({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof CopyIcon;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-4">
      <div>
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="mt-1.5 text-xl font-semibold tracking-tight tabular-nums text-foreground">
          {value}
        </dd>
        <dd className="mt-1 text-[11px] leading-5 text-muted-foreground">
          {detail}
        </dd>
      </div>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
    </div>
  );
}
