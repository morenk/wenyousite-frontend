import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";

import { WenyouIcon } from "@/components/ui/wenyou-icon";
import { cn } from "@/lib/utils";

interface PageHeaderProps extends Omit<ComponentProps<"header">, "title"> {
  title: ReactNode;
  description?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  variant?: "default" | "compact";
  purpose?: "content" | "functional";
}

export function PageHeader({
  title,
  description,
  backHref,
  backLabel = "返回",
  actions,
  toolbar,
  variant = "default",
  purpose = "content",
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      data-variant={variant}
      data-purpose={purpose}
      className={cn("mb-5", className)}
      {...props}
    >
      {backHref ? (
        <Link
          href={backHref}
          className={cn(
            "inline-flex min-h-8 items-center gap-2 rounded-[var(--radius-control)] px-1 text-sm font-semibold text-muted-foreground transition-colors duration-[var(--motion-fast)] hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
            "mb-3",
          )}
        >
          <WenyouIcon id="navigation.back" className="size-4" />
          {backLabel}
        </Link>
      ) : null}
      <div
        className="flex items-start justify-between gap-6"
      >
        <div className="min-w-0">
          <h1
            className={cn(
              "tracking-[0.01em] text-foreground",
              "[font-size:var(--type-page-title-size)] [line-height:var(--type-page-title-line-height)]",
              purpose === "functional"
                ? "font-sans font-semibold"
                : "font-display [font-weight:var(--type-page-title-weight)]",
            )}
          >
            {title}
          </h1>
          {description ? (
            <div className="mt-2 text-muted-foreground [font-size:var(--type-compact-body-size)] [line-height:var(--type-compact-body-line-height)]">
              {description}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {toolbar ? (
        <div data-slot="page-header-toolbar" className="mt-5 rounded-[var(--radius-card)] bg-card p-3">
          {toolbar}
        </div>
      ) : null}
    </header>
  );
}
