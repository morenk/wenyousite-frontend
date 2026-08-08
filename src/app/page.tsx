/** 首页：主题帖列表，支持分类筛选和滚动加载 */

"use client";

import { useQueryStates } from "nuqs";
import { useThreads } from "@/api/hooks/use-threads";
import type { ThreadSort, ThreadStatusFilter } from "@/api/hooks/use-threads";
import { ThreadList } from "@/components/thread/thread-list";
import { CategoryTabs } from "@/components/thread/category-tabs";
import { ThreadFilters } from "@/components/thread/thread-filters";
import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { homeFilterParsers } from "@/lib/url-state";

export default function HomePage() {
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
    isPlaceholderData,
    error,
    refetch,
  } = useThreads({
    category: category ?? undefined,
    sort,
    status: status ?? undefined,
  });

  const threads = data?.pages.flatMap((page) => page?.data ?? []) ?? [];

  return (
    <PageShell width="feed" className="py-5">
      <main data-slot="home-feed" className="min-w-0">
        <Panel padding="none" className="overflow-hidden">
          <PageHeader
            title="发现主题帖"
            description="按玩法、状态和活跃度筛选公开主题帖。"
            className="mb-0 px-5 pt-6 pb-5"
          />

          <div className="border-t border-border bg-muted/35 p-3">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <CategoryTabs
                selected={category ?? undefined}
                onChange={(nextCategory) => setFilters({ category: nextCategory ?? null })}
              />

              <ThreadFilters
                sort={sort}
                status={status ?? undefined}
                onSortChange={(nextSort: ThreadSort) => setFilters({ sort: nextSort })}
                onStatusChange={(nextStatus: ThreadStatusFilter | undefined) =>
                  setFilters({ status: nextStatus ?? null })
                }
              />
            </div>
          </div>
        </Panel>

        <div className="mt-4">
          <ThreadList
            threads={threads}
            hasNextPage={!!hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isLoading={isLoading}
            isRefreshing={isPlaceholderData}
            error={error}
            onLoadMore={() => fetchNextPage()}
            onRetry={() => refetch()}
          />
        </div>
      </main>
    </PageShell>
  );
}
