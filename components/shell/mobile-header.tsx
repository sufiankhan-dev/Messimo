"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";
import { SlothMark } from "@/components/brand/sloth-mark";
import { NAV_ITEMS } from "@/components/shell/navigation";
import { ThemeToggle } from "@/components/theme/theme-controls";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "cn";

export function MobileHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/80 bg-background/85 px-4 py-3 backdrop-blur-md lg:hidden">
      <Link
        href="/"
        className="flex items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
      >
        <SlothMark className="size-8 rounded-xl" />
        <span className="text-sm font-semibold tracking-tight">SlothSort</span>
      </Link>

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Open navigation"
              />
            }
          >
            <MenuIcon aria-hidden="true" />
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Navigate</DialogTitle>
              <DialogDescription>
                Your local workspace. Demo data only.
              </DialogDescription>
            </DialogHeader>
            <nav aria-label="Mobile" className="mt-1 space-y-1">
              {NAV_ITEMS.map(({ href, label, description, icon: Icon }) => {
                const active =
                  href === "/" ? pathname === "/" : pathname.startsWith(href);

                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted",
                    )}
                  >
                    <Icon
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span>
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {description}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </nav>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
