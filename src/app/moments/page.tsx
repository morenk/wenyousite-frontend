"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useMoments, type MomentFeed } from "@/api/hooks/use-moments";
import { MomentMasonry } from "@/components/moment/moment-masonry";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-shell";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default function MomentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [feed, setFeed] = useState<MomentFeed>("DISCOVER");
  const query = useMoments(feed, user?.id);
  const moments = query.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <PageShell width="wide" className="py-5">
      <header className="mb-6 flex items-end justify-between gap-6 px-1">
        <div>
          <p className="font-display text-xs font-medium tracking-[0.2em] text-muted-foreground">温油便笺</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-wide">动态</h1>
          <p className="mt-1 text-sm text-muted-foreground">短一点，也能把此刻说清楚。</p>
        </div>
      </header>

      <div className="mb-5 flex items-center gap-5 px-1" role="tablist" aria-label="动态信息流">
        {([['DISCOVER', '发现'], ['FOLLOWING', '关注']] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={feed === value}
            onClick={() => setFeed(value)}
            className={cn(
              "relative px-1 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground",
              feed === value && "text-foreground after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary",
            )}
          >
            {label}
          </button>
        ))}
      </div>

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
          emptyDescription={feed === "FOLLOWING" ? "去发现页认识一些有趣的人吧。" : "发布第一张温油便笺。"}
        />
      )}
    </PageShell>
  );
}
