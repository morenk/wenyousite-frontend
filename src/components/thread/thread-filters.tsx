/** 主题帖列表排序与状态筛选 */

"use client";

import type { ThreadSort, ThreadStatusFilter } from "@/api/hooks/use-threads";

const sortOptions: { value: ThreadSort; label: string }[] = [
  { value: "newest", label: "最新创建" },
  { value: "active", label: "最新回复" },
  { value: "recommended", label: "智能排序" },
];

const statusOptions: { value: ThreadStatusFilter | ""; label: string }[] = [
  { value: "", label: "全部状态" },
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

export function ThreadFilters({
  sort,
  status,
  onSortChange,
  onStatusChange,
}: ThreadFiltersProps) {
  return (
    <div className="flex items-center gap-5 rounded-xl border border-border bg-card p-3">
      <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        排序
        <select
          aria-label="排序"
          value={sort}
          onChange={(event) => onSortChange(event.target.value as ThreadSort)}
          className="h-9 min-w-32 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        状态
        <select
          aria-label="状态"
          value={status ?? ""}
          onChange={(event) =>
            onStatusChange((event.target.value || undefined) as ThreadStatusFilter | undefined)
          }
          className="h-9 min-w-32 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {statusOptions.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
