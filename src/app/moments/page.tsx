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
    let innerFrame = 0;
    const outerFrame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(() => {
        window.scrollTo(0, restore.scrollY);
        pendingRestore.current = null;
      });
    });
    return () => {
      window.cancelAnimationFrame(outerFrame);
      window.cancelAnimationFrame(innerFrame);
    };
  }, [feed, moments.length, query.isLoading]);

  return (
    <PageShell width="feed" className="py-5">
      <PageHeader
        className="px-1"
        title="动态"
        description="浏览公开动态，或查看你关注用户的新内容。"
      />

      <Tabs
        value={feed}
        onValueChange={(value) => setFeed(value as MomentFeed)}
        className="mb-5 gap-0 px-1"
      >
        <TabsList variant="line" aria-label="动态信息流" className="h-10 p-0">
        {([['DISCOVER', '发现'], ['FOLLOWING', '关注']] as const).map(([value, label]) => (
          <TabsTrigger
            key={value}
            value={value}
            className="px-3"
          >
            {label}
          </TabsTrigger>
        ))}
        </TabsList>
      </Tabs>

      {feed === "FOLLOWING" && !user ? (
        <div className="rounded-3xl bg-muted/60 px-6 py-20 text-center">
          <h2 className="font-display text-xl font-bold">登录后查看关注动态</h2>
          <p className="mt-2 text-sm text-muted-foreground">你关注的人发布的新内容会按时间出现在这里。</p>
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
          emptyDescription={feed === "FOLLOWING" ? "切换到发现，查看公开动态。" : "从左侧发布入口创建第一条动态。"}
        />
      )}
    </PageShell>
  );
}
