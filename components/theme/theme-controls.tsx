"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  setThemePreference,
  useResolvedTheme,
  useThemePreference,
  type ThemePreference,
} from "@/components/theme/use-theme";
import { cn } from "cn";

export function ThemeToggle() {
  const resolved = useResolvedTheme();
  const nextLabel =
    resolved === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={nextLabel}
            onClick={() =>
              setThemePreference(resolved === "dark" ? "light" : "dark")
            }
          />
        }
      >
        {resolved === "dark" ? (
          <SunIcon aria-hidden="true" />
        ) : (
          <MoonIcon aria-hidden="true" />
        )}
      </TooltipTrigger>
      <TooltipContent>{nextLabel}</TooltipContent>
    </Tooltip>
  );
}

const THEME_OPTIONS: ReadonlyArray<{
  value: ThemePreference;
  label: string;
  icon: typeof MonitorIcon;
}> = [
  { value: "system", label: "System", icon: MonitorIcon },
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
];

export function ThemeSetting() {
  const preference = useThemePreference();

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
    >
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = preference === value;
        return (
          <Button
            key={value}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={active}
            onClick={() => setThemePreference(value)}
            className={cn(
              "h-9 justify-center gap-1.5 text-xs",
              active &&
                "bg-card text-foreground shadow-sm ring-1 ring-border hover:bg-card",
            )}
          >
            <Icon aria-hidden="true" />
            {label}
          </Button>
        );
      })}
    </div>
  );
}
