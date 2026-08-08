/** 主题帖列表排序与状态筛选 */

"use client";

import { ArrowDownUp, CircleDot } from "lucide-react";

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
    <div
      role="group"
      aria-label="主题帖筛选"
      className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:items-center"
    >
      <Select
        items={sortOptions}
        value={sort}
        onValueChange={(value) => onSortChange(value as ThreadSort)}
      >
        <SelectTrigger
          size="compact"
          aria-label="排序"
          className="group h-10 w-full min-w-0 gap-1.5 rounded-xl border-border/80 bg-card py-0 pr-2.5 pl-2 text-[0.8125rem] shadow-[0_1px_2px_rgb(52_47_62_/_0.06)] hover:border-primary hover:bg-accent/15 data-[size=compact]:h-10 data-popup-open:border-primary data-popup-open:bg-accent/20 data-popup-open:ring-2 data-popup-open:ring-primary/25 sm:w-auto sm:min-w-32"
        >
          <span
            aria-hidden="true"
            className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-accent group-hover:text-brand-strong group-data-[popup-open]:bg-primary/70 group-data-[popup-open]:text-brand-strong max-[479px]:hidden"
          >
            <ArrowDownUp className="size-3.5" />
          </span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          align="start"
          alignItemWithTrigger={false}
          sideOffset={7}
          className="min-w-40 rounded-xl border-border/80 p-1.5 shadow-floating"
        >
          {sortOptions.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="rounded-lg font-medium data-highlighted:bg-accent/65 data-selected:bg-muted"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={statusOptions}
        value={status ?? "ALL"}
        onValueChange={(value) =>
          onStatusChange(value === "ALL" ? undefined : value as ThreadStatusFilter)
        }
      >
        <SelectTrigger
          size="compact"
          aria-label="状态"
          className="group h-10 w-full min-w-0 gap-1.5 rounded-xl border-border/80 bg-card py-0 pr-2.5 pl-2 text-[0.8125rem] shadow-[0_1px_2px_rgb(52_47_62_/_0.06)] hover:border-primary hover:bg-accent/15 data-[size=compact]:h-10 data-popup-open:border-primary data-popup-open:bg-accent/20 data-popup-open:ring-2 data-popup-open:ring-primary/25 sm:w-auto sm:min-w-32"
        >
          <span
            aria-hidden="true"
            className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-accent group-hover:text-brand-strong group-data-[popup-open]:bg-primary/70 group-data-[popup-open]:text-brand-strong max-[479px]:hidden"
          >
            <CircleDot className="size-3.5" />
          </span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          align="start"
          alignItemWithTrigger={false}
          sideOffset={7}
          className="min-w-40 rounded-xl border-border/80 p-1.5 shadow-floating"
        >
          {statusOptions.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="rounded-lg font-medium data-highlighted:bg-accent/65 data-selected:bg-muted"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
