/** 主题帖列表排序与状态筛选 */

"use client";

import { cn } from "@/lib/utils";
import type { ThreadSort, ThreadStatusFilter } from "@/api/hooks/use-threads";

const sortOptions: { value: ThreadSort; label: string }[] = [
  { value: "newest", label: "最新创建" },
  { value: "active", label: "最新回复" },
  { value: "recommended", label: "智能排序" },
];

const statusOptions: { value: ThreadStatusFilter | undefined; label: string }[] = [
  { value: undefined, label: "全部状态" },
  { value: "RECRUITING", label: "招募中" },
  { value: "CLOSED", label: "已停招" },
  { value: "FINISHED", label: "已结束" },
];

interface ThreadFiltersProps {
  sort: ThreadSort;
  status?: ThreadStatusFilter;
  onSortChange: (sort: ThreadSort) => void;
  onStatusChange: (status: ThreadStatusFilter | undefined) => void;
}

function FilterGroup<T extends string | undefined>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <div
        role="group"
        aria-label={label}
        className="flex gap-1 overflow-x-auto rounded-lg bg-muted/60 p-1"
      >
        {options.map((option) => {
          const selectedOption = option.value === selected;
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={selectedOption}
              onClick={() => onChange(option.value)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                selectedOption
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ThreadFilters({
  sort,
  status,
  onSortChange,
  onStatusChange,
}: ThreadFiltersProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-3">
      <FilterGroup
        label="排序"
        options={sortOptions}
        selected={sort}
        onChange={onSortChange}
      />
      <FilterGroup
        label="状态"
        options={statusOptions}
        selected={status}
        onChange={onStatusChange}
      />
    </div>
  );
}
