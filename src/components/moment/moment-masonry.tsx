"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Loader2 } from "lucide-react";
import type { MomentCard as MomentCardData } from "@/api/hooks/use-moments";
import { MomentCard } from "@/components/moment/moment-card";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadError } from "@/components/shared/load-error";
import { Skeleton } from "@/components/ui/skeleton";

const GAP = 12;
const TWO_LANE_MIN_WIDTH = 560;
const THREE_LANE_MIN_WIDTH = 640;
const DEFAULT_ESTIMATED_SIZE = 520;
const CARD_CHROME_ESTIMATE = 96;
type LaneCount = 1 | 2 | 3;

interface MomentMasonryProps {
  moments: MomentCardData[];
  isLoading?: boolean;
  error?: unknown;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  onRetry?: () => void;
  maxLanes?: LaneCount;
  showPaginationStatus?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  renderMoment?: (moment: MomentCardData) => ReactNode;
}

function lanesForWidth(width: number, maxLanes: LaneCount): LaneCount {
  if (maxLanes >= 3 && width >= THREE_LANE_MIN_WIDTH) return 3;
  if (maxLanes >= 2 && width >= TWO_LANE_MIN_WIDTH) return 2;
  return 1;
}

function estimateMomentCardSize(width: number, lanes: number) {
  if (width <= 0) return DEFAULT_ESTIMATED_SIZE;
  const columnWidth = (width - (lanes - 1) * GAP) / lanes;
  return Math.round(columnWidth * 4 / 3 + CARD_CHROME_ESTIMATE);
}

export function MomentMasonry({
  moments,
  isLoading = false,
  error,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  onRetry,
  maxLanes = 3,
  showPaginationStatus = true,
  emptyTitle = "还没有动态",
  emptyDescription = "发布后会显示在这里。",
  renderMoment,
}: MomentMasonryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{
    lanes: LaneCount;
    width: number;
    scrollMargin: number;
  }>({ lanes: 1, width: 0, scrollMargin: 0 });
  const uniqueMoments = Array.from(new Map(moments.map((moment) => [moment.id, moment])).values());

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      const nextLayout = {
        lanes: lanesForWidth(rect.width, maxLanes),
        width: rect.width,
        scrollMargin: rect.top + window.scrollY,
      };
      setLayout((current) => (
        current.lanes === nextLayout.lanes &&
        current.width === nextLayout.width &&
        current.scrollMargin === nextLayout.scrollMargin
          ? current
          : nextLayout
      ));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [maxLanes]);

  const virtualizer = useWindowVirtualizer<HTMLDivElement>({
    count: uniqueMoments.length,
    estimateSize: () => estimateMomentCardSize(layout.width, layout.lanes),
    getItemKey: (index) => uniqueMoments[index]?.id ?? index,
    lanes: layout.lanes,
    laneAssignmentMode: "measured",
    gap: GAP,
    overscan: layout.lanes * 3,
    scrollMargin: layout.scrollMargin,
    useAnimationFrameWithResizeObserver: true,
  });
  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    if (!onLoadMore || !hasNextPage || isFetchingNextPage) return;
    if (virtualItems.some((item) => item.index >= uniqueMoments.length - layout.lanes * 2)) {
      onLoadMore();
    }
  }, [hasNextPage, isFetchingNextPage, layout.lanes, onLoadMore, uniqueMoments.length, virtualItems]);

  const columnWidth = `calc((100% - ${(layout.lanes - 1) * GAP}px) / ${layout.lanes})`;
  return (
    <div ref={containerRef} className="w-full">
      {isLoading ? (
        <MomentMasonrySkeleton lanes={layout.lanes} />
      ) : error ? (
        <LoadError title="动态加载失败" onRetry={onRetry ?? (() => undefined)} className="py-20" />
      ) : uniqueMoments.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          <div
            role="feed"
            aria-label="动态瀑布流"
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualItems.map((item) => {
              const moment = uniqueMoments[item.index];
              if (!moment) return null;
              return (
                <div
                  key={item.key}
                  ref={virtualizer.measureElement}
                  data-index={item.index}
                  className="absolute left-0 top-0"
                  style={{
                    width: columnWidth,
                    left: `calc(${item.lane * 100 / layout.lanes}% + ${item.lane * GAP / layout.lanes}px)`,
                    transform: `translate3d(0, ${item.start - layout.scrollMargin}px, 0)`,
                    contain: "layout paint style",
                  }}
                >
                  {renderMoment
                    ? renderMoment(moment)
                    : <MomentCard moment={moment} priority={item.index < layout.lanes} />}
                </div>
              );
            })}
          </div>
          {showPaginationStatus ? (
            <div className="flex min-h-14 items-center justify-center text-sm text-muted-foreground">
              {isFetchingNextPage ? (
                <span className="inline-flex items-center gap-2" role="status">
                  <Loader2 className="size-4 animate-spin" />正在加载更多
                </span>
              ) : !hasNextPage ? "没有更多了" : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function MomentMasonrySkeleton({ lanes }: { lanes: LaneCount }) {
  const count = lanes * 2;
  return (
    <div className={lanes === 3 ? "grid grid-cols-3 gap-4" : lanes === 2 ? "grid grid-cols-2 gap-4" : "grid grid-cols-1 gap-4"} role="status" aria-label="正在加载动态">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="space-y-3">
          <Skeleton className="aspect-[3/4] rounded-xl" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}
