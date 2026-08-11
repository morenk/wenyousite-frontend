import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-6 shrink-0 items-center rounded-full px-2.5 py-0.5 font-utility text-xs leading-5 font-bold",
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
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({
  className,
  tone = "neutral",
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      data-tone={tone}
      className={cn(badgeVariants({ tone }), className)}
      {...props}
    />
  );
}

export { badgeVariants };
