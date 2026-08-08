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
}

export function PageHeader({
  title,
  description,
  backHref,
  backLabel = "返回",
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header className={cn("mb-5", className)} {...props}>
      {backHref ? (
        <Link
          href={backHref}
          className="mb-3 inline-flex min-h-8 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-muted-foreground transition-colors duration-[var(--motion-fast)] hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
      ) : null}
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="font-display text-[1.75rem] leading-9 font-bold tracking-[0.01em] text-foreground">{title}</h1>
          {description ? (
            <div className="mt-2 text-sm leading-5 text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
