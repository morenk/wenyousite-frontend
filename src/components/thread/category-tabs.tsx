/** 分类筛选 Tab 组件 */

"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useThreadCategories } from "@/api/hooks/use-thread-categories";

const ALL_CATEGORIES = "__ALL_CATEGORIES__";

interface CategoryTabsProps {
  selected?: string;
  onChange: (category: string | undefined) => void;
}

export function CategoryTabs({ selected, onChange }: CategoryTabsProps) {
  const categoriesQuery = useThreadCategories();
  const categories = categoriesQuery.data ?? [];
  const { isLoading, isError, refetch } = categoriesQuery;
  const selectedIsUnavailable = Boolean(
    selected && !categories.some((category) => category.slug === selected),
  );

  return (
    <Tabs
      value={selected ?? ALL_CATEGORIES}
      onValueChange={(value) =>
        onChange(value === ALL_CATEGORIES ? undefined : value)
      }
      className="min-w-0 flex-1 gap-0"
    >
      <TabsList
        aria-label="主题帖分类"
        className="h-10 w-full justify-start gap-0.5 overflow-x-auto overflow-y-hidden rounded-xl bg-muted/85 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <TabsTrigger
          value={ALL_CATEGORIES}
          className="group/category h-8 shrink-0 flex-none rounded-lg border-0 px-3 py-1 text-[0.8125rem] font-medium after:hidden hover:bg-card/60 data-active:bg-card data-active:font-bold data-active:ring-1 data-active:ring-border"
        >
          全部
        </TabsTrigger>
        {categories.map((category) => (
          <TabsTrigger
            key={category.id}
            value={category.slug}
            className="group/category h-8 shrink-0 flex-none rounded-lg border-0 px-3 py-1 text-[0.8125rem] font-medium after:hidden hover:bg-card/60 data-active:bg-card data-active:font-bold data-active:ring-1 data-active:ring-border"
          >
            {category.name}
          </TabsTrigger>
        ))}
        {selectedIsUnavailable ? (
          <TabsTrigger
            value={selected!}
            disabled
            className="h-8 shrink-0 flex-none rounded-lg border-0 px-3 py-1 text-[0.8125rem] after:hidden"
          >
            不可用分类
          </TabsTrigger>
        ) : null}
        {isLoading ? (
          <span className="shrink-0 px-3 text-xs text-muted-foreground">正在加载分类…</span>
        ) : null}
        {isError ? (
          <button
            type="button"
            onClick={() => void refetch()}
            className="shrink-0 rounded-lg px-3 text-xs font-semibold text-brand-strong hover:bg-card/60"
          >
            重新加载分类
          </button>
        ) : null}
      </TabsList>
    </Tabs>
  );
}
