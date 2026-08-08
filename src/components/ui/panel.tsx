import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const panelVariants = cva(
  "rounded-2xl border text-card-foreground",
  {
    variants: {
      tone: {
        plain: "border-border bg-card",
        soft: "border-border/70 bg-muted",
        accent: "border-primary/70 bg-accent/45",
        floating: "border-border bg-popover shadow-popover",
      },
      padding: {
        none: "p-0",
        compact: "p-4",
        default: "p-5",
      },
    },
    defaultVariants: {
      tone: "plain",
      padding: "default",
    },
  },
);

export type PanelTone = NonNullable<VariantProps<typeof panelVariants>["tone"]>;

export function Panel({
  className,
  tone = "plain",
  padding = "default",
  ...props
}: ComponentProps<"div"> & VariantProps<typeof panelVariants>) {
  return (
    <div
      data-slot="panel"
      data-tone={tone}
      className={cn(panelVariants({ tone, padding }), className)}
      {...props}
    />
  );
}

export { panelVariants };
