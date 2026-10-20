import Link from "next/link";
import { ArrowRightIcon, CopyIcon } from "lucide-react";
import { CategoryBadge } from "@/components/files/category-badge";
import { FileIcon } from "@/components/files/file-icon";
import { ReviewStatusBadge } from "@/components/files/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDestination } from "@/lib/format";
import type { OrganizationFile } from "@/types";

interface RecentSuggestionsProps {
  files: OrganizationFile[];
  total: number;
}

export function RecentSuggestions({ files, total }: RecentSuggestionsProps) {
  return (
    <Card className="gap-0 py-5">
      <CardHeader className="flex-row items-start justify-between gap-3 px-5">
        <div className="space-y-1">
          <CardTitle>Proposed changes</CardTitle>
          <CardDescription>
            {total} suggestions are waiting for your decision
          </CardDescription>
        </div>
        <Link
          href="/review"
          className="inline-flex shrink-0 items-center gap-1 rounded-md text-xs font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          Review all
          <ArrowRightIcon className="size-3.5" aria-hidden="true" />
        </Link>
      </CardHeader>

      <CardContent className="mt-4 px-0">
        <ul className="divide-y divide-border/70">
          {files.map((file) => (
            <li key={file.id}>
              <Link
                href="/review"
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
              >
                <FileIcon kind={file.kind} extension={file.extension} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-foreground">
                      {file.name}
                    </p>
                    {file.duplicateGroupId ? (
                      <CopyIcon
                        className="size-3 shrink-0 text-muted-foreground"
                        aria-label="Exact duplicate"
                      />
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                    {file.suggestion
                      ? formatDestination(
                          file.suggestion.suggestedRelativePath,
                          file.suggestion.suggestedFileName,
                        )
                      : "No destination suggested"}
                  </p>
                </div>
                <div className="hidden shrink-0 items-center gap-2 sm:flex">
                  {file.suggestion ? (
                    <CategoryBadge category={file.suggestion.category} />
                  ) : null}
                  <ReviewStatusBadge status={file.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
