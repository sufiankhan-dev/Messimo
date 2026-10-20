import type { Metadata } from "next";
import Link from "next/link";
import {
  BanIcon,
  CloudOffIcon,
  FolderCogIcon,
  FolderSearchIcon,
  HardDriveIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { OllamaSettingsCard } from "@/components/ollama/ollama-settings-card";
import { OllamaDiagnosticCard } from "@/components/ollama/ollama-diagnostic-card";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeSetting } from "@/components/theme/theme-controls";
import { getServerEnv } from "@/lib/config/env";
import { cn } from "cn";

export const metadata: Metadata = {
  title: "Settings",
};

const SAFETY_RULES = [
  {
    icon: HardDriveIcon,
    title: "Everything stays on this device",
    description:
      "Folder scans, hashing, prompts, and inference are designed to run locally. No analytics service receives file data.",
  },
  {
    icon: CloudOffIcon,
    title: "No cloud AI fallback",
    description:
      "If Ollama is unavailable, SlothSort reports an error instead of sending your files to a remote provider.",
  },
  {
    icon: ShieldCheckIcon,
    title: "You approve every change",
    description:
      "The model only suggests categories, filenames, and destinations. No move happens without explicit approval.",
  },
  {
    icon: BanIcon,
    title: "No automatic deletion",
    description:
      "Duplicates are surfaced for review. SlothSort never deletes files and never overwrites an existing file silently.",
  },
];

export default function SettingsPage() {
  const env = getServerEnv();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Local by design."
        description="Check the local inference service, choose how the app looks, and review the privacy rules that shape every operation."
        demo={false}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <OllamaSettingsCard
            baseUrl={env.OLLAMA_BASE_URL}
            selectedModel={env.OLLAMA_MODEL}
          />

          <OllamaDiagnosticCard />

          <Card className="gap-0 py-5">
            <CardHeader className="px-5">
              <CardTitle>Privacy and safety</CardTitle>
              <CardDescription>
                Non-negotiable rules for this build and the road ahead.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pt-4">
              <ul className="space-y-4">
                {SAFETY_RULES.map(({ icon: Icon, title, description }) => (
                  <li key={title} className="flex items-start gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <Icon className="size-3.5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {title}
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                        {description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="gap-0 py-5">
            <CardHeader className="px-5">
              <CardTitle>Selected model</CardTitle>
              <CardDescription>
                The configured Gemma model for local inference.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-5 pt-4">
              <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-muted/25 p-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-medium text-foreground">
                    {env.OLLAMA_MODEL}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Gemma 3 · 4B parameters · Q4_K_M
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 border-primary/25 bg-primary/10 text-primary"
                >
                  Selected
                </Badge>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                About 3.4 GB on disk. The first download needs internet access;
                after that, inference runs entirely offline.
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                Model switching is not implemented. Set{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                  OLLAMA_MODEL
                </code>{" "}
                in{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                  .env.local
                </code>{" "}
                and restart the app.
              </p>
            </CardContent>
          </Card>

          <Card className="gap-0 py-5">
            <CardHeader className="px-5">
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Light, dark, or follow your system preference.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pt-4">
              <ThemeSetting />
            </CardContent>
          </Card>

          <Card className="gap-0 py-5">
            <CardHeader className="px-5">
              <CardTitle className="flex items-center gap-2">
                <FolderCogIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Folder access
              </CardTitle>
              <CardDescription>
                Read-only local folder scanning.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-5 pt-4">
              <p className="text-xs leading-5 text-muted-foreground">
                Choose a folder on the dashboard or folder scan page. Only one
                approved folder is read at a time, and drive roots, system
                folders, and the whole home folder are refused. Scans never
                change a file; only size-matched candidates are read to compute
                SHA-256 duplicate hashes.
              </p>
              <Link
                href="/scan"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "gap-1.5",
                )}
              >
                <FolderSearchIcon aria-hidden="true" />
                Open folder scan
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
