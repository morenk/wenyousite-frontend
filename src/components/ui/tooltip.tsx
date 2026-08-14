"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delay={320} closeDelay={80} timeout={450}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
  disabled?: boolean;
}

/**
 * 站内图标操作的统一可视提示；无障碍名称仍由触发元素的 aria-label 提供。
 */
export function Tooltip({
  content,
  children,
  side = "top",
  className,
  disabled = false,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={children} disabled={disabled} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={7} className="z-[var(--layer-tooltip)]">
          <TooltipPrimitive.Popup
            className={cn(
              "origin-(--transform-origin) rounded-lg bg-foreground px-2.5 py-1.5 font-utility text-xs font-medium text-background shadow-popover outline-none",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              className,
            )}
          >
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
