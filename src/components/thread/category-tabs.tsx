/** 分类筛选 Tab 组件 */

"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThreadCategoryMarker } from "@/components/thread/thread-category";
import { useThreadCategoriesContext } from "@/components/thread/thread-categories-provider";

interface CategoryTabsProps {
  selected?: string;
  onChange: (category: string | undefined) => void;
}

export function CategoryTabs({ selected, onChange }: CategoryTabsProps) {
  const { categories, isLoading, isError, refetch } = useThreadCategoriesContext();
  const selectedIsUnavailable = Boolean(
    selected && !categories.some((category) => category.slug === selected),
  );

  return (
    <Tabs
      value={selected ?? "ALL"}
      onValueChange={(value) =>
        onChange(value === "ALL" ? undefined : value)
      }
      className="gap-0 border-t border-border"
    >
      <TabsList
        variant="line"
        aria-label="主题帖分类"
        className="relative h-14 w-full justify-start gap-1 overflow-x-auto px-3 before:absolute before:inset-x-5 before:bottom-[0.6875rem] before:h-px before:bg-border"
      >
        <TabsTrigger
          value="ALL"
          className="group/category h-14 shrink-0 flex-none rounded-none border-0 px-3 pb-4 after:bottom-[0.5rem] after:inset-x-3 after:h-[3px]"
        >
          <span className="size-2 rounded-full bg-foreground ring-2 ring-white" aria-hidden="true" />
          全部
        </TabsTrigger>
        {categories.map((category) => (
          <TabsTrigger
            key={category.id}
            value={category.slug}
            className="group/category h-14 shrink-0 flex-none rounded-none border-0 px-3 pb-4 after:bottom-[0.5rem] after:inset-x-3 after:h-[3px]"
          >
            <ThreadCategoryMarker category={category.slug} className="size-2 rounded-full ring-2 ring-white" />
            {category.name}
          </TabsTrigger>
        ))}
        {selectedIsUnavailable ? (
          <TabsTrigger
            value={selected!}
            disabled
            className="h-14 shrink-0 flex-none rounded-none border-0 px-3 pb-4"
          >
            不可用分类
          </TabsTrigger>
        ) : null}
        {isLoading ? (
          <span className="px-3 text-xs text-muted-foreground">正在加载分类…</span>
        ) : null}
        {isError ? (
          <button
            type="button"
            onClick={refetch}
            className="px-3 text-xs font-semibold text-brand-strong hover:underline"
          >
            重新加载分类
          </button>
        ) : null}
      </TabsList>
    </Tabs>
  );
}
