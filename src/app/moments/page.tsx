"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMoments, type MomentFeed } from "@/api/hooks/use-moments";
import { MomentMasonry } from "@/components/moment/moment-masonry";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import {
  clearMomentFeedReturn,
  rememberMomentFeed,
  takeMomentFeedRestore,
  type MomentFeedRestoreState,
} from "@/lib/moment-navigation";

export default function MomentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [feed, setFeed] = useState<MomentFeed>("DISCOVER");
  const pendingRestore = useRef<MomentFeedRestoreState | null>(null);
  const query = useMoments(feed, user?.id);
  const moments = query.data?.pages.flatMap((page) => page.data) ?? [];

  useEffect(() => {
    const restore = pendingRestore.current ?? takeMomentFeedRestore();
    clearMomentFeedReturn();
    if (!restore) return;
    pendingRestore.current = restore;
    const frame = window.requestAnimationFrame(() => setFeed(restore.feed));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    rememberMomentFeed(feed);
  }, [feed]);

  useEffect(() => {
    const restore = pendingRestore.current;
    if (!restore || restore.feed !== feed || query.isLoading || moments.length === 0) return;
    let frame = 0;
    let attempts = 0;
    let stableFrames = 0;
    const restoreScroll = () => {
      attempts += 1;
      window.scrollTo({ top: restore.scrollY, behavior: "auto" });
      const anchor = restore.anchorOffset === null
        ? null
        : Array.from(document.querySelectorAll<HTMLElement>("[data-moment-id]"))
          .find((element) => element.dataset.momentId === restore.momentId);
      if (anchor && restore.anchorOffset !== null) {
        window.scrollBy({
          top: anchor.getBoundingClientRect().top - restore.anchorOffset,
          behavior: "auto",
        });
      }
      const restored = anchor && restore.anchorOffset !== null
        ? Math.abs(anchor.getBoundingClientRect().top - restore.anchorOffset) < 2
        : Math.abs(window.scrollY - restore.scrollY) < 2;
      stableFrames = restored
        ? stableFrames + 1
        : 0;

      // 虚拟瀑布流会在首批卡片测量后修正总高度；以原卡片视口锚点为准，稳定后再消费状态。
      if (stableFrames >= 6 || attempts >= 120) {
        pendingRestore.current = null;
        return;
      }
      frame = window.requestAnimationFrame(restoreScroll);
    };
    frame = window.requestAnimationFrame(restoreScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [feed, moments.length, query.isLoading]);

  return (
    <PageShell width="feed" className="py-5">
      <PageHeader
        title="动态"
        variant="compact"
        toolbar={
          <Tabs
            value={feed}
            onValueChange={(value) => setFeed(value as MomentFeed)}
            className="gap-0"
          >
            <TabsList aria-label="动态信息流" className="h-10 p-1">
              {([['DISCOVER', '发现'], ['FOLLOWING', '关注']] as const).map(([value, label]) => (
                <TabsTrigger key={value} value={value} className="px-4">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      {feed === "FOLLOWING" && !user ? (
        <div className="rounded-3xl bg-muted/60 px-6 py-20 text-center">
          <h2 className="text-xl font-semibold">登录后查看关注动态</h2>
          <Button variant="ghost" className="mt-5 text-brand-strong" onClick={() => router.push(`/login?next=${encodeURIComponent(pathname)}`)}>登录</Button>
        </div>
      ) : (
        <MomentMasonry
          moments={moments}
          maxLanes={2}
          isLoading={query.isLoading}
          error={query.error}
          hasNextPage={!!query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
          onRetry={() => void query.refetch()}
          emptyTitle={feed === "FOLLOWING" ? "关注的人还没有新动态" : "动态区还很安静"}
        />
      )}
    </PageShell>
  );
}
