/** 精确楼层定位遮罩：在完整分页列表后查找、稳定目标，再一次揭开阅读区。 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { startDiscussionTargetReveal } from "@/lib/discussion-target-reveal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/layout/page-shell";

type TargetPhase = "locating" | "revealed";

interface DiscussionTargetMaskProps {
  targetId?: string;
  activationKey?: string | number;
  subject: "楼层" | "回复";
  loadedIds: string[];
  hasNextPage: boolean;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  validationPending?: boolean;
  error: unknown;
  onLoadMore: () => unknown;
  onRetry: () => unknown;
  onBack: () => void;
  onMaskChange?: (masked: boolean) => void;
  children: React.ReactNode;
}

export function DiscussionTargetMask({
  targetId,
  activationKey,
  subject,
  loadedIds,
  hasNextPage,
  isLoading,
  isFetchingNextPage,
  validationPending = false,
  error,
  onLoadMore,
  onRetry,
  onBack,
  onMaskChange,
  children,
}: DiscussionTargetMaskProps) {
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<TargetPhase>(targetId ? "locating" : "revealed");
  const [isSlow, setIsSlow] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [pageLoadVersion, setPageLoadVersion] = useState(0);
  const loadMoreInFlight = useRef(false);
  const targetLoaded = useMemo(
    () => Boolean(targetId && loadedIds.includes(targetId)),
    [loadedIds, targetId],
  );

  useEffect(() => {
    if (!targetId) return;
    const timer = window.setTimeout(() => setIsSlow(true), 5_000);
    return () => window.clearTimeout(timer);
  }, [activationKey, attempt, targetId]);

  useEffect(() => {
    if (
      !targetId ||
      targetLoaded ||
      error ||
      isLoading ||
      isFetchingNextPage ||
      isRetrying ||
      validationPending ||
      loadMoreInFlight.current ||
      phase === "revealed"
    ) return;
    if (hasNextPage) {
      loadMoreInFlight.current = true;
      void Promise.resolve(onLoadMore())
        .catch(() => undefined)
        .finally(() => {
          loadMoreInFlight.current = false;
          setPageLoadVersion((current) => current + 1);
        });
      return;
    }
  }, [
    error,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isRetrying,
    onLoadMore,
    pageLoadVersion,
    phase,
    targetId,
    targetLoaded,
    validationPending,
  ]);

  useEffect(() => {
    if (
      !targetId ||
      !targetLoaded ||
      error ||
      isLoading ||
      isFetchingNextPage ||
      isRetrying ||
      validationPending
    ) return;
    return startDiscussionTargetReveal(`post-${targetId}`, {
      onStable: () => setPhase("revealed"),
      holdUntilStable: true,
    }).dispose;
  }, [
    activationKey,
    attempt,
    error,
    isFetchingNextPage,
    isLoading,
    isRetrying,
    targetId,
    targetLoaded,
    validationPending,
  ]);

  const masked = Boolean(targetId && phase !== "revealed");
  const failed = !isRetrying && Boolean(
    error || (
      targetId &&
      !targetLoaded &&
      !hasNextPage &&
      !isLoading &&
      !isFetchingNextPage &&
      !validationPending
    ),
  );
  useEffect(() => {
    onMaskChange?.(masked);
  }, [masked, onMaskChange]);
  useEffect(() => {
    if (!targetId || phase !== "revealed") return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`post-${targetId}`)?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [phase, targetId]);
  useEffect(() => {
    if (!masked) return;
    const preventScroll = (event: Event) => event.preventDefault();
    const preventScrollKey = (event: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) return;
      const activeTag = document.activeElement?.tagName;
      if (event.key === " " && (activeTag === "BUTTON" || activeTag === "A")) return;
      event.preventDefault();
    };
    window.addEventListener("wheel", preventScroll, { passive: false });
    window.addEventListener("touchmove", preventScroll, { passive: false });
    window.addEventListener("keydown", preventScrollKey);
    return () => {
      window.removeEventListener("wheel", preventScroll);
      window.removeEventListener("touchmove", preventScroll);
      window.removeEventListener("keydown", preventScrollKey);
    };
  }, [masked]);

  const handleRetry = async () => {
    setPhase("locating");
    setIsSlow(false);
    setIsRetrying(true);
    try {
      await Promise.resolve(onRetry());
    } finally {
      setAttempt((current) => current + 1);
      setIsRetrying(false);
    }
  };

  return (
    <div className="relative min-h-[28rem]" aria-busy={masked || undefined}>
      <div
        aria-hidden={masked || undefined}
        inert={masked ? true : undefined}
        className={masked ? "invisible" : undefined}
      >
        {children}
        {targetId ? (
          <div
            className="h-[calc(100vh-6rem)]"
            data-slot="discussion-target-alignment-runway"
            aria-hidden="true"
          />
        ) : null}
      </div>
      {masked ? (
        <div className="absolute inset-0 z-[var(--layer-sticky)] bg-background" data-testid="discussion-target-mask">
          <div
            className="sticky top-20 flex min-h-[28rem] flex-col items-center justify-start gap-4 px-4 pt-10 text-center"
            role="status"
            aria-live="polite"
            aria-label={`正在定位目标${subject}`}
          >
            {failed ? null : <Loader2 className="size-5 animate-spin text-muted-foreground" />}
            <div>
              <p className="text-sm font-medium text-foreground">
                {failed ? `未能定位目标${subject}` : `正在定位目标${subject}…`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {failed
                  ? `目标可能已删除、暂时无法访问，或讨论列表加载失败。`
                  : isSlow
                    ? "仍在定位，较早的讨论可能需要继续加载。"
                    : "正在读取完整讨论，定位完成前不会显示列表。"}
              </p>
            </div>
            {isSlow && !failed ? (
              <Button variant="ghost" size="sm" onClick={onBack}>
                返回上一页
              </Button>
            ) : null}
            {failed ? (
              <Button variant="outline" size="sm" onClick={() => void handleRetry()}>
                重试
              </Button>
            ) : (
              <div className="w-full max-w-md space-y-3" aria-hidden="true">
                <Skeleton className="h-20 w-full rounded-[var(--radius-card)]" />
                <Skeleton className="h-20 w-full rounded-[var(--radius-card)]" />
              </div>
            )}
            {failed ? (
              <Button variant="ghost" size="sm" onClick={onBack}>
                返回上一页
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {targetId && phase === "revealed" ? (
        <p className="sr-only" role="status" aria-live="polite">
          目标{subject}已定位
        </p>
      ) : null}
    </div>
  );
}

/** 目标与归属重新校验期间的路由级遮罩；不渲染任何缓存正文。 */
export function DiscussionTargetRouteFallback() {
  return (
    <PageShell width="feed">
      <div
        className="min-h-[32rem] space-y-4 bg-background"
        role="status"
        aria-live="polite"
        aria-label="正在定位目标楼层"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          正在定位目标楼层…
        </div>
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-28 w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-28 w-full rounded-[var(--radius-card)]" />
      </div>
    </PageShell>
  );
}
