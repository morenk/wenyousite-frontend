/** 主题帖列表组件：无限滚动加载 */

"use client";

import { Loader2 } from "lucide-react";
import type { ThreadCardData } from "@/api/hooks/use-threads";
import { ThreadCard } from "./thread-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadError } from "@/components/shared/load-error";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

interface ThreadListProps {
  threads: ThreadCardData[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  error: unknown;
  onLoadMore: () => void;
  onRetry: () => void;
}

export function ThreadList({
  threads,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  error,
  onLoadMore,
  onRetry,
}: ThreadListProps) {
  const sentinelRef = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    onLoadMore,
  });

  if (isLoading) {
    return <ThreadListSkeleton />;
  }

  if (error) {
    return (
      <LoadError
        title="加载失败"
        description="请检查网络连接后重试"
        onRetry={onRetry}
        className="py-20"
      />
    );
  }

  if (threads.length === 0) {
    return <EmptyState title="还没有主题帖" description="成为第一个创建主题帖的人吧" />;
  }

  // 兜底去重：分页数据可能因后端游标错位出现重复 id，按 id 去重避免同一帖渲染多次
  const uniqueThreads = Array.from(
    new Map(threads.map((t) => [t.id, t])).values(),
  );

  return (
    <div className="flex flex-col gap-4">
      {uniqueThreads.map((thread) => (
        <ThreadCard key={thread.id} thread={thread} />
      ))}

      {/* 加载更多 sentinel */}
      <div ref={sentinelRef} className="flex items-center justify-center py-4">
        {isFetchingNextPage && (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        )}
        {!hasNextPage && (
          <p className="text-xs text-muted-foreground">没有更多了</p>
        )}
      </div>
    </div>
  );
}

function ThreadListSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="正在加载主题帖">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="rounded-xl border border-border bg-card p-5">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-5 w-2/3" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-4/5" />
          <div className="mt-5 flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}
