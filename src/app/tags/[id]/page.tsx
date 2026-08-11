/** 标签主题帖页：按稳定标签 ID 展示公开已发布主题帖。 */

"use client";

import { useParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useTag } from "@/api/hooks/use-tags";
import {
  useThreads,
  type ThreadSort,
  type ThreadStatusFilter,
} from "@/api/hooks/use-threads";
import { CategoryTabs } from "@/components/thread/category-tabs";
import { ThreadFilters } from "@/components/thread/thread-filters";
import { ThreadList } from "@/components/thread/thread-list";
import { EmptyState } from "@/components/shared/empty-state";
import { PageShell } from "@/components/layout/page-shell";
import { PageRouteFallback } from "@/components/layout/page-route-fallback";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import Link from "next/link";
import { homeFilterParsers } from "@/lib/url-state";

export default function TagThreadsPage() {
  const { id: tagId } = useParams<{ id: string }>();
  const [{ category, sort, status }, setFilters] = useQueryStates(
    homeFilterParsers,
    { history: "push", shallow: true },
  );
  const tagQuery = useTag(tagId);
  const threadsQuery = useThreads({
    tagId,
    category: category ?? undefined,
    sort,
    status: status ?? undefined,
  });
  const threads =
    threadsQuery.data?.pages.flatMap((page) => page?.data ?? []) ?? [];

  if (tagQuery.isLoading) {
    return <PageRouteFallback variant="feed" />;
  }

  if (tagQuery.error || !tagQuery.data) {
    return (
      <PageShell width="feed" className="py-10">
        <EmptyState
          title="标签不存在"
          description="该标签可能已被删除或链接有误"
        />
        <div className="mt-4 text-center">
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            返回发现
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell width="feed">
      <PageHeader
        title={`#${tagQuery.data.name}`}
        backHref="/"
        backLabel="返回发现"
      />

      <Panel padding="none" className="mb-4 overflow-hidden">
        <div className="bg-muted/35 p-3">
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

      <ThreadList
        threads={threads}
        hasNextPage={!!threadsQuery.hasNextPage}
        isFetchingNextPage={threadsQuery.isFetchingNextPage}
        isLoading={threadsQuery.isLoading}
        isRefreshing={threadsQuery.isPlaceholderData}
        error={threadsQuery.error}
        onLoadMore={() => threadsQuery.fetchNextPage()}
        onRetry={() => threadsQuery.refetch()}
      />
    </PageShell>
  );
}
