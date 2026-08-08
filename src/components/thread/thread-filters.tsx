/** 主题帖列表排序与状态筛选 */

"use client";

import type { ThreadSort, ThreadStatusFilter } from "@/api/hooks/use-threads";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const sortOptions: { value: ThreadSort; label: string }[] = [
  { value: "newest", label: "最新创建" },
  { value: "active", label: "最新回复" },
  { value: "recommended", label: "智能排序" },
];

const statusOptions: { value: ThreadStatusFilter | "ALL"; label: string }[] = [
  { value: "ALL", label: "全部状态" },
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
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border bg-muted/55 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="font-utility text-xs font-bold tracking-wide text-muted-foreground">排序</span>
        <Select
          items={sortOptions}
          value={sort}
          onValueChange={(value) => onSortChange(value as ThreadSort)}
        >
          <SelectTrigger size="compact" aria-label="排序" className="min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-utility text-xs font-bold tracking-wide text-muted-foreground">状态</span>
        <Select
          items={statusOptions}
          value={status ?? "ALL"}
          onValueChange={(value) =>
            onStatusChange(value === "ALL" ? undefined : value as ThreadStatusFilter)
          }
        >
          <SelectTrigger size="compact" aria-label="状态" className="min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
