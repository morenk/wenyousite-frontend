import { MOTION_USAGE } from "@wenyousite/foundation/interaction"

import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      data-reduced-motion={MOTION_USAGE.reducedMotion}
      className={cn("animate-pulse rounded-[var(--radius-compact)] bg-muted motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

export { Skeleton }
