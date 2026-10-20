"use client";

import {
  useCallback,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
} from "react";
import {
  ChevronRightIcon,
  CornerLeftUpIcon,
  FolderIcon,
  FolderOpenIcon,
  LoaderCircleIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useScanWorkspace } from "@/components/scan/scan-workspace-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { FolderBrowseResult } from "@/types";
import {
  apiErrorResponseSchema,
  folderBrowseResultSchema,
} from "@/lib/validation/files";
import { cn } from "cn";

type ButtonProps = ComponentProps<typeof Button>;

interface FolderPickerDialogProps {
  triggerLabel?: string;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  triggerClassName?: string;
}

/**
 * Local folder picker. It asks the same-origin localhost API for one level of
 * folders at a time; it never uses a browser file input as filesystem access.
 */
export function FolderPickerDialog({
  triggerLabel = "Choose folder",
  triggerVariant = "default",
  triggerSize = "lg",
  triggerClassName,
}: FolderPickerDialogProps) {
  const { folder, selectFolder } = useScanWorkspace();
  const [open, setOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState("");
  const [pathInput, setPathInput] = useState("");
  const [data, setData] = useState<FolderBrowseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async (target?: string) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/folders/browse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target ? { path: target } : {}),
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readApiMessage(response));
      }

      const parsed = folderBrowseResultSchema.safeParse(
        await response.json(),
      );
      if (!parsed.success) {
        throw new Error("The folder browser returned an unexpected response.");
      }

      if (requestId !== requestIdRef.current) return;
      setData(parsed.data);
      setCurrentPath(parsed.data.currentPath);
      setPathInput(parsed.data.currentPath);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "That folder could not be opened.",
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setChoosing(false);
      setError(null);
      setData(null);
      setCurrentPath("");
      setPathInput("");
      void load(folder?.displayPath);
    }
    setOpen(nextOpen);
  }

  function handleGo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = pathInput.trim();
    if (!target) {
      void load();
      return;
    }
    void load(target);
  }

  async function handleSelect() {
    if (!data || !data.selectable || choosing) return;
    setChoosing(true);
    setError(null);
    const selectionError = await selectFolder(data.currentPath);
    setChoosing(false);

    if (selectionError) {
      setError(selectionError);
      return;
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant={triggerVariant}
            size={triggerSize}
            className={triggerClassName}
          />
        }
      >
        <FolderOpenIcon aria-hidden="true" />
        {triggerLabel}
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Choose a folder to scan</DialogTitle>
          <DialogDescription>
            SlothSort lists folder names from this machine and reads file
            metadata. Files that share a size are read only to compute SHA-256
            duplicate hashes. Nothing is moved, renamed, or deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <form onSubmit={handleGo} className="flex gap-2">
            <label htmlFor="folder-path-input" className="sr-only">
              Folder path
            </label>
            <Input
              id="folder-path-input"
              value={pathInput}
              onChange={(event) => setPathInput(event.target.value)}
              placeholder="Absolute folder path or ~/Downloads"
              autoComplete="off"
              spellCheck={false}
              className="h-9 font-mono text-xs"
            />
            <Button type="submit" variant="outline" size="lg" disabled={loading}>
              Go
            </Button>
          </form>

          {data?.shortcuts.length ? (
            <div className="flex flex-wrap gap-1.5" aria-label="Common folders">
              {data.shortcuts.map((shortcut) => (
                <Button
                  key={shortcut.path}
                  type="button"
                  variant="secondary"
                  size="xs"
                  title={shortcut.path}
                  onClick={() => void load(shortcut.path)}
                  className="gap-1"
                >
                  <FolderIcon aria-hidden="true" />
                  {shortcut.label}
                </Button>
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Open parent folder"
              disabled={!data?.parentPath || loading}
              onClick={() => {
                if (data?.parentPath) void load(data.parentPath);
              }}
            >
              <CornerLeftUpIcon aria-hidden="true" />
            </Button>
            <p className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
              {data?.currentPath ?? currentPath ?? "Loading…"}
            </p>
            {data ? (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  data.selectable
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                )}
              >
                {data.selectable ? "Can scan" : "Pick a subfolder"}
              </span>
            ) : null}
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-rose-300/60 bg-rose-50/70 px-3 py-2 text-xs leading-5 text-rose-900 dark:border-rose-300/20 dark:bg-rose-300/[0.06] dark:text-rose-100"
            >
              {error}
            </p>
          ) : null}

          <div
            className="h-56 overflow-y-auto rounded-xl border border-border"
            aria-busy={loading}
          >
            {loading && !data ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                <LoaderCircleIcon
                  className="size-5 animate-spin"
                  aria-hidden="true"
                />
                Reading folder names…
              </div>
            ) : null}

            {!loading && !data ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  That folder could not be opened. Try your home folder or type
                  another path.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void load()}
                >
                  Try home folder
                </Button>
              </div>
            ) : null}

            {data ? (
              <ul className="divide-y divide-border/70">
                {data.directories.length === 0 ? (
                  <li className="px-3 py-8 text-center text-xs text-muted-foreground">
                    No subfolders here. You can use this folder if it is
                    selectable.
                  </li>
                ) : null}

                {data.directories.map((directory) => (
                  <li key={directory.path}>
                    <button
                      type="button"
                      onClick={() => void load(directory.path)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    >
                      <FolderIcon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {directory.name}
                      </span>
                      <ChevronRightIcon
                        className="size-3.5 shrink-0 text-muted-foreground/70"
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {data?.truncated ? (
            <p className="text-[11px] text-muted-foreground">
              Showing the first {data.directories.length} of{" "}
              {data.directoryCount} folders. Type a path to jump directly.
            </p>
          ) : null}

          {data && !data.selectable && data.selectionBlockedReason ? (
            <p className="flex items-start gap-1.5 text-[11px] leading-5 text-amber-700 dark:text-amber-300">
              <ShieldCheckIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              {data.selectionBlockedReason}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            onClick={() => void handleSelect()}
            disabled={!data?.selectable || loading || choosing}
            className="gap-1.5"
          >
            {choosing ? (
              <LoaderCircleIcon
                className="size-3.5 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <FolderOpenIcon aria-hidden="true" />
            )}
            {choosing ? "Approving…" : "Use this folder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function readApiMessage(response: Response): Promise<string> {
  try {
    const parsed = apiErrorResponseSchema.safeParse(await response.json());
    if (parsed.success) return parsed.data.error.message;
  } catch {
    // Fall through to a safe generic message.
  }

  if (response.status === 403) {
    return "Folder browsing is available only from the local SlothSort app on this computer.";
  }
  return "That folder could not be opened. No files were changed.";
}
