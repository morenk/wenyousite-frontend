import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import type { BadgeSize, ElementTone } from "@wenyousite/foundation/elements";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full font-utility font-bold leading-none [&>svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground",
        brand: "bg-accent text-accent-foreground",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-destructive-soft text-destructive",
        info: "bg-info-soft text-info",
      },
      size: {
        default: "h-[var(--element-badge-default-height)] px-2.5 text-[length:var(--element-badge-default-font-size)] [&>svg]:size-[var(--element-badge-default-icon-size)]",
        compact: "h-[var(--element-badge-compact-height)] px-2 text-[length:var(--element-badge-compact-font-size)] [&>svg]:size-[var(--element-badge-compact-icon-size)]",
      },
    },
    defaultVariants: {
      tone: "neutral",
      size: "default",
    },
  },
);

export type BadgeTone = ElementTone;
export type { BadgeSize };

export function Badge({
  className,
  tone = "neutral",
  size = "default",
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      data-tone={tone}
      data-size={size}
      className={cn(badgeVariants({ tone, size }), className)}
      {...props}
    />
  );
}

export { badgeVariants };
