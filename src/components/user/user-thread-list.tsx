/** 用户帖子列表通用展示组件：分类/状态徽章 + 标题 + 无限滚动 */

"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Loader2, ChevronDown, LockKeyhole } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ThreadCardData } from "@/api/hooks/use-threads";

const categoryLabel: Record<string, string> = {
  DEDUCTION: "演绎",
  NATION: "国策",
  RPG: "RPG",
};

const statusLabel: Record<string, string> = {
  RECRUITING: "招募中",
  CLOSED: "已停招",
  FINISHED: "已结束",
};

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
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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
                categoryColor(thread.category),
              )}
            >
              {categoryLabel[thread.category] ?? thread.category}
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                statusColor(thread.status),
              )}
            >
              {statusLabel[thread.status] ?? thread.status}
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

function categoryColor(category: string): string {
  const map: Record<string, string> = {
    DEDUCTION: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    NATION: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    RPG: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  };
  return map[category] ?? "bg-muted text-muted-foreground";
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    RECRUITING: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    CLOSED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    FINISHED: "bg-muted text-muted-foreground",
  };
  return map[status] ?? "bg-muted text-muted-foreground";
}
