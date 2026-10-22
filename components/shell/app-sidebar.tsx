"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessimoMark } from "@/components/brand/messimo-mark";
import { OllamaIndicator } from "@/components/ollama/ollama-indicator";
import { NAV_ITEMS } from "@/components/shell/navigation";
import { ThemeToggle } from "@/components/theme/theme-controls";
import { cn } from "cn";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="px-4 pt-6 pb-5">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl px-1 py-1 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <MessimoMark className="size-10 rounded-2xl" />
          <span className="min-w-0">
            <span className="block text-[15px] leading-tight font-semibold tracking-tight text-sidebar-foreground">
              Messimo
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
              Mess in. Sorted out.
            </span>
          </span>
        </Link>
      </div>

      <div className="px-3">
        <p className="px-3 pb-2 text-[10px] font-medium tracking-[0.16em] text-muted-foreground/80 uppercase">
          Workspace
        </p>
        <nav aria-label="Main" className="space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 transition-colors",
                    active
                      ? "text-sidebar-primary"
                      : "text-muted-foreground/80 group-hover:text-sidebar-foreground",
                  )}
                  aria-hidden="true"
                />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto space-y-3 p-3">
        <OllamaIndicator />
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] text-muted-foreground">
            Local-first · v0.1
          </span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
