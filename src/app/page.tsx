/** 首页：主题帖列表，支持分类筛选和滚动加载 */

"use client";

import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useThreads } from "@/api/hooks/use-threads";
import type { ThreadSort, ThreadStatusFilter } from "@/api/hooks/use-threads";
import { ThreadList } from "@/components/thread/thread-list";
import { CategoryTabs } from "@/components/thread/category-tabs";
import { ThreadFilters } from "@/components/thread/thread-filters";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-shell";
import { homeFilterParsers } from "@/lib/url-state";

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [{ category, sort, status }, setFilters] = useQueryStates(
    homeFilterParsers,
    { history: "push", shallow: true },
  );

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useThreads({
    category: category ?? undefined,
    sort,
    status: status ?? undefined,
  });

  const threads = data?.pages.flatMap((page) => page?.data ?? []) ?? [];

  return (
    <PageShell>
      {/* 顶部操作栏 */}
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">发现</h1>
        {user && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => router.push("/threads/create")}
            >
              <Plus className="h-4 w-4" />
              创建主题帖
            </Button>
          </div>
        )}
      </div>

      {/* 分类筛选 */}
      <div className="mb-5">
        <CategoryTabs
          selected={category ?? undefined}
          onChange={(nextCategory) => setFilters({ category: nextCategory ?? null })}
        />
      </div>

      <div className="mb-5">
        <ThreadFilters
          sort={sort}
          status={status ?? undefined}
          onSortChange={(nextSort: ThreadSort) => setFilters({ sort: nextSort })}
          onStatusChange={(nextStatus: ThreadStatusFilter | undefined) =>
            setFilters({ status: nextStatus ?? null })
          }
        />
      </div>

      {/* 帖列表 */}
      <ThreadList
        threads={threads}
        hasNextPage={!!hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        isLoading={isLoading}
        error={error}
        onLoadMore={() => fetchNextPage()}
        onRetry={() => refetch()}
      />
    </PageShell>
  );
}
