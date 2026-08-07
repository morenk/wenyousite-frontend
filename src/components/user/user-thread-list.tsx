/** 用户帖子列表通用展示组件：分类/状态徽章 + 标题 + 无限滚动 */

"use client";

import Link from "next/link";
import { Loader2, ChevronDown, LockKeyhole } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { THREAD_CATEGORY_META, THREAD_STATUS_META } from "@/lib/thread-presentation";
import type { ThreadCardData } from "@/api/hooks/use-threads";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

interface UserThreadListProps {
  threads: ThreadCardData[];
  isLoading: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  emptyTitle: string;
  errorTitle: string;
}

export function UserThreadList({
  threads,
  isLoading,
  isError,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  emptyTitle,
  errorTitle,
}: UserThreadListProps) {
  const sentinelRef = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>;
  }

  if (isError) {
    return <EmptyState title={errorTitle} />;
  }

  if (threads.length === 0) {
    return <EmptyState title={emptyTitle} />;
  }

  return (
    <div className="space-y-3">
      {threads.map((thread) => (
        <Link
          key={thread.id}
          href={`/threads/${thread.id}`}
          className="block rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md"
        >
          <div className="mb-2 flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                THREAD_CATEGORY_META[thread.category].badgeClassName,
              )}
            >
              {THREAD_CATEGORY_META[thread.category].label}
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                THREAD_STATUS_META[thread.status].badgeClassName,
              )}
            >
              {THREAD_STATUS_META[thread.status].label}
            </span>
            {thread.visibility === "PRIVATE" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                <LockKeyhole className="h-3 w-3" />
                私密帖
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-foreground line-clamp-1">
            {thread.title}
          </h3>
        </Link>
      ))}

      <div ref={sentinelRef} className="flex items-center justify-center py-2">
        {isFetchingNextPage && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {hasNextPage && !isFetchingNextPage && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchNextPage()}
            className="text-xs"
          >
            <ChevronDown className="mr-1 h-3.5 w-3.5" />
            加载更多
          </Button>
        )}
        {!hasNextPage && threads.length > 0 && (
          <span className="text-xs text-muted-foreground">没有更多了</span>
        )}
      </div>
    </div>
  );
}
