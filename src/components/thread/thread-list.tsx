/** 主题帖列表组件：无限滚动加载 */

"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { ThreadCardData } from "@/api/hooks/use-threads";
import { ThreadCard } from "./thread-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

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
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          onLoadMore();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <EmptyState
          title="加载失败"
          description="请检查网络连接后重试"
        />
        <Button variant="outline" size="sm" onClick={onRetry}>
          重试
        </Button>
      </div>
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
