"use client";

import { ChevronLeft, ChevronRight, Filter, RotateCcw } from "lucide-react";
import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AdminFilterBar({
  children,
  activeCount,
  onReset,
  summary,
  className,
}: {
  children: React.ReactNode;
  activeCount: number;
  onReset: () => void;
  summary?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-b border-border bg-card px-5 py-3 [&_input]:h-9 [&_input]:rounded-md [&_[data-slot=select-trigger]]:h-9 [&_[data-slot=select-trigger]]:rounded-md",
        className,
      )}
    >
      <div className="flex items-end gap-3">
        <div className="flex min-h-9 shrink-0 items-center gap-2 pb-0.5 text-xs font-bold text-foreground">
          <Filter className="size-4" />
          <span>筛选条件</span>
          {activeCount > 0 ? <Badge tone="brand">{activeCount}</Badge> : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">{children}</div>
        <div className="ml-auto flex min-h-9 shrink-0 items-center gap-3">
          {summary ? <span className="font-utility text-xs font-semibold text-foreground">{summary}</span> : null}
          <Button
            type="button"
            size="compact"
            variant="ghost"
            disabled={activeCount === 0}
            onClick={onReset}
          >
            <RotateCcw />重置
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AdminFilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className={cn("grid gap-1", className)}>
      <span id={labelId} className="font-utility text-[0.6875rem] font-bold tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

export function AdminPagination({
  page,
  pageSize,
  visibleCount,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  busy = false,
  className,
}: {
  page: number;
  pageSize: number;
  visibleCount: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  busy?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4 border-t border-border bg-muted/40 px-5 py-3", className)}>
      <p className="font-utility text-xs text-muted-foreground">
        第 {page} 页 · 本页 {visibleCount} 条 · 每页 {pageSize} 条
      </p>
      <div className="flex items-center gap-2" aria-label="分页器">
        <Button
          type="button"
          size="compact"
          variant="outline"
          disabled={!hasPrevious || busy}
          onClick={onPrevious}
        >
          <ChevronLeft />上一页
        </Button>
        <Button
          type="button"
          size="compact"
          variant="outline"
          disabled={!hasNext || busy}
          onClick={onNext}
        >
          下一页<ChevronRight />
        </Button>
      </div>
    </div>
  );
}
