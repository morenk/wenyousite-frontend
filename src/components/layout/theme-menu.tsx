"use client";

import { Popover } from "@base-ui/react/popover";
import {
  THEME_ICONS,
  THEME_LABELS,
  THEME_PREFERENCES,
  type ThemePreference,
} from "@wenyousite/foundation/theme";
import { useId, useState } from "react";

import {
  WenyouIcon,
  type WenyouIconId,
} from "@/components/ui/wenyou-icon";
import { useTheme } from "@/components/ui/theme-provider";
import { cn } from "@/lib/utils";

const themeIcons = THEME_ICONS as Record<ThemePreference, WenyouIconId>;

interface ThemeMenuProps {
  compact?: boolean;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

export function ThemeMenu({
  compact = false,
  side = "right",
  align = "end",
}: ThemeMenuProps) {
  const [open, setOpen] = useState(false);
  const radioName = useId();
  const { preference, setPreference } = useTheme();
  const currentLabel = THEME_LABELS[preference];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <button
            type="button"
            aria-label={`外观：${currentLabel}`}
            title={`外观：${currentLabel}`}
            className={cn(
              "flex min-h-10 w-full items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
              !compact && "xl:justify-start xl:gap-3 xl:px-3",
            )}
          />
        }
      >
        <WenyouIcon id={themeIcons[preference]} className="size-5" />
        <span className={cn("hidden text-sm font-medium", !compact && "xl:inline")}>外观</span>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner
          side={side}
          align={align}
          sideOffset={10}
          className="z-[var(--layer-popup)]"
        >
          <Popover.Popup className="w-52 rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-popover outline-none">
            <Popover.Title className="px-2.5 pb-1.5 pt-1 text-sm font-semibold">外观</Popover.Title>
            <fieldset className="grid gap-1">
              <legend className="sr-only">选择页面外观</legend>
              {THEME_PREFERENCES.map((option) => {
                const checked = option === preference;
                return (
                  <label key={option} className="cursor-pointer">
                    <input
                      type="radio"
                      name={radioName}
                      value={option}
                      checked={checked}
                      className="peer sr-only"
                      onChange={() => {
                        setPreference(option);
                        setOpen(false);
                      }}
                    />
                    <span
                      className={cn(
                        "flex min-h-10 items-center gap-3 rounded-xl px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring/30",
                        checked && "bg-accent text-accent-foreground",
                      )}
                    >
                      <WenyouIcon id={themeIcons[option]} className="size-4.5" />
                      <span className="flex-1">{THEME_LABELS[option]}</span>
                      <WenyouIcon
                        id="action.confirm"
                        className={cn("size-4", checked ? "opacity-100" : "opacity-0")}
                      />
                    </span>
                  </label>
                );
              })}
            </fieldset>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
