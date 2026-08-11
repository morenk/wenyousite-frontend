/** 主题帖列表组件：无限滚动加载 */

"use client";

import { Loader2 } from "lucide-react";
import type { ThreadCardData } from "@/api/hooks/use-threads";
import { ThreadCard } from "./thread-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadError } from "@/components/shared/load-error";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { Panel } from "@/components/ui/panel";
import { StackList, StackListRow } from "@/components/ui/stack-list";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { ListRefreshIndicator } from "@/components/shared/list-refresh-indicator";

interface ThreadListProps {
  threads: ThreadCardData[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  isRefreshing?: boolean;
  error: unknown;
  onLoadMore: () => void;
  onRetry: () => void;
}

export function ThreadList({
  threads,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  isRefreshing = false,
  error,
  onLoadMore,
  onRetry,
}: ThreadListProps) {
  const sentinelRef = useInfiniteScroll({
    hasNextPage: hasNextPage && !isRefreshing,
    isFetchingNextPage: isFetchingNextPage || isRefreshing,
    onLoadMore,
  });

  if (isLoading) {
    return (
      <>
        <NavigationProgress />
        <ThreadListSkeleton />
      </>
    );
  }

  if (error) {
    return (
      <Panel padding="none">
        <LoadError
          title="加载失败"
          onRetry={onRetry}
          className="py-20"
        />
      </Panel>
    );
  }

  if (threads.length === 0) {
    return (
      <Panel padding="none">
        <EmptyState title="还没有主题帖" />
      </Panel>
    );
  }

  // 兜底去重：分页数据可能因后端游标错位出现重复 id，按 id 去重避免同一帖渲染多次
  const uniqueThreads = Array.from(
    new Map(threads.map((t) => [t.id, t])).values(),
  );

  return (
    <div className="relative w-full" aria-busy={isRefreshing || undefined}>
      {isRefreshing && <ListRefreshIndicator />}
      <StackList role="list" aria-label="主题帖列表">
        {uniqueThreads.map((thread) => (
          <ThreadCard key={thread.id} thread={thread} />
        ))}

        {/* 加载更多 sentinel；占位数据展示期间暂停，避免请求旧筛选的下一页。 */}
        <div ref={sentinelRef} className="flex min-h-14 items-center justify-center px-5 py-3">
          {!isRefreshing && isFetchingNextPage && (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-5 w-5 animate-spin" />
              正在加载更多
            </span>
          )}
          {!isRefreshing && !hasNextPage && (
            <p className="text-xs text-muted-foreground">没有更多了</p>
          )}
        </div>
      </StackList>
    </div>
  );
}

function ThreadListSkeleton() {
  return (
    <StackList role="status" aria-label="正在加载主题帖">
      {Array.from({ length: 3 }, (_, index) => (
        <StackListRow key={index}>
          <div className="flex gap-3.5">
            <Skeleton className="size-11 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-28 rounded-full" />
              </div>
              <Skeleton className="mt-3 h-5 w-2/3" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-4/5" />
              <Skeleton className="mt-4 h-4 w-28" />
            </div>
          </div>
        </StackListRow>
      ))}
    </StackList>
  );
}
