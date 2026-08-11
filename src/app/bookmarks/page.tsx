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
import { useBookmarkFolders } from "@/api/hooks/use-bookmark-folders";
import { BookmarkFolderBar } from "@/components/user/bookmark-folder-bar";
import { Button } from "@/components/ui/button";

export default function BookmarksPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"threads" | "moments">("threads");
  const [folderId, setFolderId] = useState<string | undefined>();
  const momentsQuery = useMomentBookmarks(user?.id);
  const foldersQuery = useBookmarkFolders();
  const moments = momentsQuery.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <PageShell width="feed">
      <PageHeader title="我的收藏" />
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
      {tab === "threads" ? (
        <>
          {foldersQuery.isLoading ? (
            <div className="mb-5 h-12 animate-pulse rounded-xl bg-muted" />
          ) : foldersQuery.isError ? (
            <div className="mb-5 flex items-center justify-between rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
              <span>收藏夹分类加载失败</span>
              <Button variant="ghost" size="compact" onClick={() => foldersQuery.refetch()}>
                重试
              </Button>
            </div>
          ) : (
            <BookmarkFolderBar
              folders={foldersQuery.data ?? []}
              selectedFolderId={folderId}
              onSelect={setFolderId}
            />
          )}
          <BookmarkList folderId={folderId} folders={foldersQuery.data ?? []} />
        </>
      ) : (
        <MomentMasonry moments={moments} maxLanes={2} isLoading={momentsQuery.isLoading} error={momentsQuery.error} hasNextPage={!!momentsQuery.hasNextPage} isFetchingNextPage={momentsQuery.isFetchingNextPage} onLoadMore={() => void momentsQuery.fetchNextPage()} onRetry={() => void momentsQuery.refetch()} emptyTitle="还没有收藏动态" />
      )}
    </PageShell>
  );
}
