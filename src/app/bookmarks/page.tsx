/** 我的收藏管理页 */

"use client";

import { useState } from "react";
import { BookmarkList } from "@/components/user/bookmark-list";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { useMomentBookmarks } from "@/api/hooks/use-moments";
import { MomentMasonry } from "@/components/moment/moment-masonry";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";

export default function BookmarksPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"threads" | "moments">("threads");
  const momentsQuery = useMomentBookmarks(user?.id);
  const moments = momentsQuery.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <PageShell width="feed">
      <PageHeader title="我的收藏" description="稍后继续阅读或参与的内容。" />
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as "threads" | "moments")}
        className="mb-5 gap-0"
      >
        <TabsList variant="line" aria-label="收藏分类" className="h-10 p-0">
        {([['threads', '主题帖'], ['moments', '动态']] as const).map(([value, label]) => (
          <TabsTrigger key={value} value={value} className="px-3">{label}</TabsTrigger>
        ))}
        </TabsList>
      </Tabs>
      {tab === "threads" ? <BookmarkList /> : (
        <MomentMasonry moments={moments} maxLanes={2} isLoading={momentsQuery.isLoading} error={momentsQuery.error} hasNextPage={!!momentsQuery.hasNextPage} isFetchingNextPage={momentsQuery.isFetchingNextPage} onLoadMore={() => void momentsQuery.fetchNextPage()} onRetry={() => void momentsQuery.refetch()} emptyTitle="还没有收藏动态" emptyDescription="在动态区点一下收藏，之后就能从这里找到。" />
      )}
    </PageShell>
  );
}
