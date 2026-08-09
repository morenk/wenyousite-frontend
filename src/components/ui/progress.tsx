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
  ...props
}: ProgressProps) {
  return (
    <BaseProgress.Root
      data-slot="progress"
      value={value}
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
            "h-full rounded-full bg-brand-strong transition-[width] duration-[var(--motion-fast)] ease-[var(--ease-standard)] data-indeterminate:w-1/3 data-indeterminate:animate-pulse",
            indicatorClassName,
          )}
        />
      </BaseProgress.Track>
    </BaseProgress.Root>
  );
}

export { Progress };
