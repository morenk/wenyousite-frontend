import type { ComponentProps } from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const stackListRowVariants = cva(
  "relative px-5 py-[1.125rem] outline-none transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)] hover:bg-accent/20 focus-within:bg-accent/25",
);

export function StackList({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="stack-list"
      className={cn(
        "w-full divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card",
        className,
      )}
      {...props}
    />
  );
}

export function StackListRow({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="stack-list-row"
      className={cn(stackListRowVariants(), className)}
      {...props}
    />
  );
}

export { stackListRowVariants };
