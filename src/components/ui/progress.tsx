"use client";

import { Progress as BaseProgress } from "@base-ui/react/progress";
import { cn } from "@/lib/utils";

interface ProgressProps extends Omit<BaseProgress.Root.Props, "children"> {
  indicatorClassName?: string;
  trackClassName?: string;
}

function Progress({
  className,
  indicatorClassName,
  trackClassName,
  value,
  min = 0,
  max = 100,
  ...props
}: ProgressProps) {
  const fraction = typeof value === "number" && Number.isFinite(value) && max > min
    ? Math.min(1, Math.max(0, (value - min) / (max - min))) : null;
  return (
    <BaseProgress.Root
      data-slot="progress"
      value={value}
      min={min}
      max={max}
      className={cn("w-full", className)}
      {...props}
    >
      <BaseProgress.Track
        data-slot="progress-track"
        className={cn("h-1.5 overflow-hidden rounded-full bg-muted", trackClassName)}
      >
        <BaseProgress.Indicator
          data-slot="progress-indicator"
          className={cn(
            "h-full origin-left rounded-full bg-brand-strong transition-transform duration-[var(--motion-fast)] ease-[var(--ease-standard)] rtl:origin-right data-indeterminate:animate-pulse",
            indicatorClassName,
          )}
          style={{ width: fraction === null ? "33.333%" : "100%", transform: fraction === null ? undefined : `scaleX(${fraction})` }}
        />
      </BaseProgress.Track>
    </BaseProgress.Root>
  );
}

export { Progress };
