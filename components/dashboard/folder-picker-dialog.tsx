"use client";

import { FolderOpenIcon, ShieldCheckIcon } from "lucide-react";
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
import { Button } from "@/components/ui/button";

export function FolderPickerDialog() {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button size="lg" className="h-10 gap-2 px-4 text-sm" />
        }
      >
        <FolderOpenIcon aria-hidden="true" />
        Choose folder
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Local folder access is not connected yet</DialogTitle>
          <DialogDescription>
            The read-only scanner is the next milestone. This build uses a fixed
            sample workspace so the review experience can be evaluated safely.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          {[
            "Pick any folder on this machine with a native directory picker.",
            "Read filenames and metadata without changing anything.",
            "Keep every path and every prompt on this device.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 leading-6">
              <ShieldCheckIcon
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              {item}
            </li>
          ))}
        </ul>

        <p className="text-xs leading-5 text-muted-foreground">
          Until then, the folder shown on the dashboard is a sample. Choosing a
          folder here would have no effect, so the control is intentionally
          explained rather than simulated.
        </p>

        <DialogFooter>
          <DialogClose render={<Button>Keep exploring the demo</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
