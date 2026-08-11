import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

interface PageHeaderProps extends Omit<ComponentProps<"header">, "title"> {
  title: ReactNode;
  description?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  variant?: "default" | "compact";
}

export function PageHeader({
  title,
  description,
  backHref,
  backLabel = "返回",
  actions,
  toolbar,
  variant = "default",
  className,
  ...props
}: PageHeaderProps) {
  const compact = variant === "compact";

  return (
    <header
      data-variant={variant}
      className={cn(
        compact
          ? "mb-4 overflow-hidden rounded-2xl border border-border bg-card"
          : "mb-5",
        className,
      )}
      {...props}
    >
      {backHref ? (
        <Link
          href={backHref}
          className={cn(
            "inline-flex min-h-8 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-muted-foreground transition-colors duration-[var(--motion-fast)] hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
            compact ? "mx-4 mt-2.5" : "mb-3",
          )}
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
      ) : null}
      <div
        className={cn(
          "flex justify-between gap-6",
          compact ? "min-h-13 items-center px-4 py-2.5" : "items-start",
        )}
      >
        <div className="min-w-0">
          <h1
            className={cn(
              "font-display font-bold tracking-[0.01em] text-foreground",
              compact ? "text-xl leading-8" : "text-[1.75rem] leading-9",
            )}
          >
            {title}
          </h1>
          {description ? (
            <div className={cn("text-sm leading-5 text-muted-foreground", compact ? "mt-0.5" : "mt-2")}>
              {description}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {toolbar ? (
        <div data-slot="page-header-toolbar" className="border-t border-border bg-muted/35 p-2.5">
          {toolbar}
        </div>
      ) : null}
    </header>
  );
}
