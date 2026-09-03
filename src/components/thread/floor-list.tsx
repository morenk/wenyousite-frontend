/** 楼层列表组件：无限滚动加载 */

"use client";

import { Loader2 } from "lucide-react";
import type { FloorDisplayData, PostData } from "@/api/hooks/use-floors";
import { FloorCard } from "./floor-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  focusedFloorActivationKey?: string | number;
  emptyTitle?: string;
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
  focusedFloorActivationKey,
  emptyTitle = "暂无回复",
}: FloorListProps) {
  const sentinelRef = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    onLoadMore,
  });

  if (isLoading) {
    return (
      <div className="space-y-3" role="status" aria-label="正在加载楼层">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="rounded-2xl border border-border bg-card px-5 py-5">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-3 w-20" />
              </div>
            </div>
            <Skeleton className="mt-5 h-4 w-full" />
            <Skeleton className="mt-3 h-4 w-5/6" />
            <Skeleton className="mt-5 h-3 w-24" />
          </div>
        ))}
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
      <EmptyState title={emptyTitle} />
    );
  }

  const displayedFloors = focusedFloor && !floors.some((floor) => floor.id === focusedFloor.id)
    ? [focusedFloor, ...floors]
    : floors;
  const pinnedFloors = displayedFloors.filter((floor) => Boolean(floor.pinnedAt));
  const ordinaryFloors = displayedFloors.filter((floor) => !floor.pinnedAt);
  const renderFloor = (floor: PostData | FloorDisplayData) => (
    <FloorCard
      key={floor.id}
      floor={floor}
      focused={floor.id === focusedFloor?.id}
      focusActivationKey={
        floor.id === focusedFloor?.id
          ? focusedFloorActivationKey
          : undefined
      }
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {pinnedFloors.length > 0 ? (
        <section data-testid="pinned-floors" aria-label="置顶楼层" className="contents">
          {pinnedFloors.map(renderFloor)}
        </section>
      ) : null}
      {ordinaryFloors.map(renderFloor)}

      {hasNextPage || isFetchingNextPage ? (
        <div
          ref={sentinelRef}
          data-slot="floor-list-sentinel"
          className="flex items-center justify-center py-4"
        >
          {isFetchingNextPage ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
