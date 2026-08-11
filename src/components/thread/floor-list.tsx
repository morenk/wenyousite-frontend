/** 楼层列表组件：无限滚动加载 */

"use client";

import { Loader2 } from "lucide-react";
import type { FloorDisplayData, PostData } from "@/api/hooks/use-floors";
import { FloorCard } from "./floor-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

interface FloorListProps {
  floors: PostData[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  error: unknown;
  onLoadMore: () => void;
  onRetry: () => void;
  focusedFloor?: FloorDisplayData;
}

export function FloorList({
  floors,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  error,
  onLoadMore,
  onRetry,
  focusedFloor,
}: FloorListProps) {
  const sentinelRef = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    onLoadMore,
  });

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
        <EmptyState title="加载失败" />
        <Button variant="outline" size="sm" onClick={onRetry}>
          重试
        </Button>
      </div>
    );
  }

  if (floors.length === 0) {
    return (
      <EmptyState title="暂无回复" />
    );
  }

  const displayedFloors = focusedFloor && !floors.some((floor) => floor.id === focusedFloor.id)
    ? [focusedFloor, ...floors]
    : floors;

  return (
    <div className="flex flex-col gap-3">
      {displayedFloors.map((floor, index) => (
        <FloorCard
          key={floor.id}
          floor={floor}
          isEven={index % 2 === 1}
          focused={floor.id === focusedFloor?.id}
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
