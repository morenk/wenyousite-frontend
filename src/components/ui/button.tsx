import * as React from "react"
import {
  ACTION_CONTROL_CONTRACT,
  type ActionControlRole,
} from "@wenyousite/foundation/controls"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding text-sm font-bold whitespace-nowrap outline-none select-none transition-[background-color,border-color,color,transform] duration-[var(--motion-fast)] ease-[var(--ease-standard)] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:border-border disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_86%,var(--brand-strong))]",
        outline:
          "border-border bg-card text-foreground hover:bg-muted aria-expanded:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_srgb,var(--secondary)_88%,var(--secondary-foreground))] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "text-foreground hover:bg-muted aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-destructive-soft text-destructive hover:bg-[color-mix(in_srgb,var(--destructive-soft)_82%,var(--destructive))] focus-visible:border-destructive focus-visible:ring-destructive/20",
        link: "text-brand-strong underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        compact: "h-8 gap-1.5 rounded-md px-3 text-sm",
        large: "h-11 gap-2 px-5",
        icon: "size-10 p-0",
        "icon-compact": "size-8 rounded-md p-0",
        "icon-large": "size-11 p-0",
        // 迁移期兼容旧尺寸名。
        xs: "h-8 gap-1.5 rounded-md px-3 text-sm",
        sm: "h-8 gap-1.5 rounded-md px-3 text-sm",
        lg: "h-11 gap-2 px-5",
        "icon-xs": "size-8 rounded-md p-0",
        "icon-sm": "size-8 rounded-md p-0",
        "icon-lg": "size-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const buttonRoles = {
  default: ACTION_CONTROL_CONTRACT.roles[0],
  outline: ACTION_CONTROL_CONTRACT.roles[1],
  secondary: ACTION_CONTROL_CONTRACT.roles[1],
  ghost: ACTION_CONTROL_CONTRACT.roles[2],
  destructive: ACTION_CONTROL_CONTRACT.roles[3],
  link: ACTION_CONTROL_CONTRACT.roles[4],
} satisfies Record<NonNullable<VariantProps<typeof buttonVariants>["variant"]>, ActionControlRole>

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      data-slot="button"
      data-control-role={buttonRoles[variant ?? "default"]}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
