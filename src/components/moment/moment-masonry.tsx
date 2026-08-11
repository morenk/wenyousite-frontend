"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Loader2 } from "lucide-react";
import type { MomentCard as MomentCardData } from "@/api/hooks/use-moments";
import { MomentCard } from "@/components/moment/moment-card";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadError } from "@/components/shared/load-error";
import { Skeleton } from "@/components/ui/skeleton";

const GAP = 12;

interface MomentMasonryProps {
  moments: MomentCardData[];
  isLoading?: boolean;
  error?: unknown;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  onRetry?: () => void;
  maxLanes?: 1 | 2 | 3;
  emptyTitle?: string;
  emptyDescription?: string;
}

function lanesForWidth(width: number, maxLanes: 1 | 2 | 3) {
  if (maxLanes >= 3 && width >= 980) return 3;
  if (maxLanes >= 2 && width >= 560) return 2;
  return 1;
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
  emptyTitle = "还没有动态",
  emptyDescription = "发布后会显示在这里。",
}: MomentMasonryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ lanes: 1, scrollMargin: 0 });
  const uniqueMoments = Array.from(new Map(moments.map((moment) => [moment.id, moment])).values());
  const hasError = Boolean(error);
  const hasMoments = uniqueMoments.length > 0;

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      setLayout({
        lanes: lanesForWidth(rect.width, maxLanes),
        scrollMargin: rect.top + window.scrollY,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  // 首屏加载/错误/空态时瀑布流容器尚未挂载；状态切换后必须重新绑定测量。
  }, [hasError, hasMoments, isLoading, maxLanes]);

  const virtualizer = useWindowVirtualizer<HTMLDivElement>({
    count: uniqueMoments.length,
    estimateSize: () => 520,
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

  if (isLoading) return <MomentMasonrySkeleton lanes={maxLanes} />;
  if (error) {
    return <LoadError title="动态加载失败" onRetry={onRetry ?? (() => undefined)} className="py-20" />;
  }
  if (uniqueMoments.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const columnWidth = `calc((100% - ${(layout.lanes - 1) * GAP}px) / ${layout.lanes})`;
  return (
    <div className="w-full">
      <div
        ref={containerRef}
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
              <MomentCard moment={moment} priority={item.index < layout.lanes} />
            </div>
          );
        })}
      </div>
      <div className="flex min-h-14 items-center justify-center text-sm text-muted-foreground">
        {isFetchingNextPage ? (
          <span className="inline-flex items-center gap-2" role="status">
            <Loader2 className="size-4 animate-spin" />正在加载更多
          </span>
        ) : !hasNextPage ? "没有更多了" : null}
      </div>
    </div>
  );
}

function MomentMasonrySkeleton({ lanes }: { lanes: 1 | 2 | 3 }) {
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
