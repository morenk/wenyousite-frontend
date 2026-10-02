/** 楼层列表组件：无限滚动加载 */

"use client";

import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { getDiscussionReadingTop } from "@/lib/discussion-target-reveal";
import { isContentUnavailableError } from "@/api/errors";
import type { PostData } from "@/api/hooks/use-floors";
import { FloorCard } from "./floor-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { DiscussionVirtualList, type DiscussionPosition } from "@/components/shared/discussion-virtual-list";
import { DiscussionTargetMask } from "@/components/thread/discussion-target-mask";

interface FloorListProps {
  floors: PostData[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  error: unknown;
  onLoadMore: () => void;
  onRetry: () => void;
  targetFloorId?: string;
  targetActivationKey?: string | number;
  targetValidationPending?: boolean;
  onTargetRetry?: () => unknown;
  onTargetBack?: () => void;
  emptyTitle?: string;
  windowed?: boolean;
  pinnedItems?: PostData[];
  hasPreviousPage?: boolean;
  isFetchingPreviousPage?: boolean;
  onLoadPrevious?: () => unknown;
  onPosition?: (position: DiscussionPosition) => void;
  onProtectedIdsChange?: (ids: string[]) => void;
  preserveId?: string;
  restoreOffset?: number;
}

export function FloorList({
  floors,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  error,
  onLoadMore,
  onRetry,
  targetFloorId,
  targetActivationKey,
  targetValidationPending = false,
  onTargetRetry = onRetry,
  onTargetBack = () => window.history.back(),
  emptyTitle = "暂无回复",
  windowed = false,
  pinnedItems,
  hasPreviousPage,
  isFetchingPreviousPage,
  onLoadPrevious,
  onPosition,
  onProtectedIdsChange,
  preserveId,
  restoreOffset,
}: FloorListProps) {
  const targetMaskKey = `${targetFloorId ?? ""}:${targetActivationKey ?? ""}`;
  const [targetMaskState, setTargetMaskState] = useState({
    key: targetMaskKey,
    masked: Boolean(targetFloorId),
  });
  const targetMasked = targetMaskState.key === targetMaskKey
    ? targetMaskState.masked
    : Boolean(targetFloorId);
  const handleTargetMaskChange = useCallback((masked: boolean) => {
    setTargetMaskState({ key: targetMaskKey, masked });
  }, [targetMaskKey]);
  const sentinelRef = useInfiniteScroll({
    hasNextPage: hasNextPage && !targetMasked && !windowed,
    isFetchingNextPage,
    onLoadMore,
  });

  const handlePosition = useCallback((position: DiscussionPosition) => {
    // 置顶区尚在阅读视口时，它才是当前阅读条目，不能提前报自然列表第一项。
    for (const floor of pinnedItems ?? []) {
      const node = document.getElementById(`post-${floor.id}`);
      const rect = node?.getBoundingClientRect();
      if (rect && rect.bottom > getDiscussionReadingTop() && rect.top < window.innerHeight) {
        onPosition?.({ id: floor.id, number: floor.floorNumber ?? 0, offset: rect.top - getDiscussionReadingTop() });
        return;
      }
    }
    onPosition?.(position);
  }, [onPosition, pinnedItems]);

  const loadPrevious = () => {
    // 回到置顶区阅读时不让自然窗口前插把用户带离置顶内容。
    const readingPin = (pinnedItems ?? []).some((floor) => {
      const rect = document.getElementById(`post-${floor.id}`)?.getBoundingClientRect();
      return rect && rect.bottom > getDiscussionReadingTop() && rect.top < window.innerHeight;
    });
    if (!readingPin) return onLoadPrevious?.();
  };

  let content: React.ReactNode;
  if (isLoading) {
    content = (
      <div className="flex flex-col gap-[var(--collection-card-gap)]" role="status" aria-label="正在加载楼层">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="rounded-[var(--radius-card)] border border-border bg-card px-5 py-5">
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
  } else if (error && (floors.length === 0 || isContentUnavailableError(error))) {
    content = (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <EmptyState title="加载失败" />
        <Button variant="outline" size="sm" onClick={onRetry}>
          重试
        </Button>
      </div>
    );
  } else if (floors.length === 0) {
    content = <EmptyState title={emptyTitle} />;
  } else {
    const pinnedFloors = pinnedItems ?? floors.filter((floor) => Boolean(floor.pinnedAt));
    const pinnedIds = new Set(pinnedFloors.map((floor) => floor.id));
    const ordinaryFloors = floors.filter((floor) => !pinnedIds.has(floor.id));
    const renderFloor = (floor: PostData) => (
      <FloorCard
        key={floor.id}
        floor={floor}
        focused={floor.id === targetFloorId}
        focusActivationKey={targetActivationKey}
      />
    );
    content = (
      <div className="flex flex-col gap-[var(--collection-card-gap)]">
        {pinnedFloors.length > 0 ? (
          <section data-testid="pinned-floors" aria-label="置顶楼层" className="contents">
            {pinnedFloors.map((floor) => <div key={floor.id} data-discussion-item={floor.id} data-discussion-number={floor.floorNumber}>{renderFloor(floor)}</div>)}
          </section>
        ) : null}
        {windowed ? <DiscussionVirtualList items={ordinaryFloors} numberOf={(floor) => floor.floorNumber ?? 0} renderItem={renderFloor}
          targetId={targetFloorId} activationKey={targetActivationKey} preserveId={preserveId} restoreOffset={restoreOffset} leadingContentKey={pinnedFloors.map((floor) => floor.id).join(",")}
          hasBefore={hasPreviousPage && !targetMasked && !error} hasAfter={hasNextPage && !targetMasked && !error}
          fetching={isFetchingNextPage || isFetchingPreviousPage} onBefore={loadPrevious} onAfter={onLoadMore} onPosition={handlePosition} onProtectedIdsChange={onProtectedIdsChange} /> : ordinaryFloors.map(renderFloor)}

        {error ? <div role="alert" className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">继续加载失败<Button variant="ghost" size="sm" onClick={onRetry}>重试</Button></div> : null}
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

  return (
    <DiscussionTargetMask
      key={targetMaskKey}
      targetId={targetFloorId}
      activationKey={targetActivationKey}
      restoreOffset={restoreOffset}
      subject="楼层"
      loadedIds={floors.map((floor) => floor.id)}
      hasNextPage={windowed ? false : hasNextPage}
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      validationPending={targetValidationPending}
      error={error}
      onLoadMore={onLoadMore}
      onRetry={onTargetRetry}
      onBack={onTargetBack}
      onMaskChange={handleTargetMaskChange}
    >
      {content}
    </DiscussionTargetMask>
  );
}
