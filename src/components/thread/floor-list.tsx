/** 楼层列表组件：无限滚动加载 */

"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { PostData } from "@/api/hooks/use-floors";
import { FloorCard } from "./floor-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

interface FloorListProps {
  floors: PostData[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  error: unknown;
  onLoadMore: () => void;
  onRetry: () => void;
}

export function FloorList({
  floors,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  error,
  onLoadMore,
  onRetry,
}: FloorListProps) {
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

  if (floors.length === 0) {
    return (
      <EmptyState
        title="暂无回复"
        description="来发第一帖吧"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {floors.map((floor, index) => (
        <FloorCard
          key={floor.id}
          floor={floor}
          isEven={index % 2 === 1}
        />
      ))}

      {/* 加载更多 sentinel */}
      <div ref={sentinelRef} className="flex items-center justify-center py-4">
        {isFetchingNextPage && (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        )}
        {!hasNextPage && floors.length > 0 && (
          <p className="text-xs text-muted-foreground">没有更多了</p>
        )}
      </div>
    </div>
  );
}
