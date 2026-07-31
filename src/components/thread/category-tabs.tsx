/** 分类筛选 Tab 组件 */

"use client";

import { cn } from "@/lib/utils";

export const categoryOptions = [
  { value: undefined, label: "全部" },
  { value: "DEDUCTION" as const, label: "演绎" },
  { value: "NATION" as const, label: "国策" },
  { value: "RPG" as const, label: "RPG" },
];

interface CategoryTabsProps {
  selected?: string;
  onChange: (category: string | undefined) => void;
}

export function CategoryTabs({ selected, onChange }: CategoryTabsProps) {
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-xl bg-muted/50 p-1">
      {categoryOptions.map((option) => {
        const isSelected =
          option.value === undefined
            ? selected === undefined
            : option.value === selected;

        return (
          <button
            key={option.label}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              isSelected
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </nav>
  );
}
