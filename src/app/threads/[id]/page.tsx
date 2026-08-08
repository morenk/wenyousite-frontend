/** 主题帖详情页：头部 + 子贴 Tab + 楼层列表 + 发布 */

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { getPostHref } from "@/lib/post-navigation";
import { useThreadDetail } from "@/api/hooks/use-thread-detail";
import { useFloors } from "@/api/hooks/use-floors";
import { usePost } from "@/api/hooks/use-post";
import { ThreadDetailHeader } from "@/components/thread/thread-detail-header";
import { ThreadPostSearch } from "@/components/thread/thread-post-search";
import { SubthreadTabs } from "@/components/thread/subthread-tabs";
import { SubthreadBody } from "@/components/thread/subthread-body";
import { FloorList } from "@/components/thread/floor-list";
import { FloorForm } from "@/components/thread/floor-form";
import {
  ThreadComposerProvider,
  useThreadComposer,
} from "@/components/thread/thread-composer-context";
import {
  ThreadPermissionsProvider,
  useThreadPermissions,
} from "@/components/thread/thread-permissions-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageShell } from "@/components/layout/page-shell";

export default function ThreadDetailPage() {
  const params = useParams();
  const threadId = params.id as string;
  return (
    <ThreadComposerProvider threadId={threadId}>
      <ThreadPermissionsProvider threadId={threadId}>
        <ThreadDetailPageContent />
      </ThreadPermissionsProvider>
    </ThreadComposerProvider>
  );
}

function ThreadDetailPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const threadId = params.id as string;
  const targetPostId = searchParams.get("post") ?? undefined;
  const { user, isInitialized } = useAuth();
  const { close: closeComposer } = useThreadComposer();

  const {
    data: thread,
    isLoading,
    error,
    refetch,
  } = useThreadDetail(threadId);

  const [selectedSubthreadId, setSelectedSubthreadId] = useState<string>();
  const [isSearching, setIsSearching] = useState(false);
  const { data: targetPost } = usePost(targetPostId);
  const targetFloorId = targetPost?.parentPostId ?? targetPost?.id;
  const { data: targetFloor } = usePost(targetFloorId);

  const effectiveSubthreadId =
    selectedSubthreadId ?? targetPost?.subthreadId ?? thread?.defaultSubthreadId;

  const {
    data: floorsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isFloorsLoading,
    error: floorsError,
    refetch: refetchFloors,
  } = useFloors(effectiveSubthreadId);

  const floors = floorsData?.pages.flatMap((page) => page?.data ?? []) ?? [];

  // 兼容历史通知/动态链接：楼中楼统一进入独立阅读页。
  useEffect(() => {
    if (!targetPost?.parentPostId) return;
    router.replace(getPostHref({
      threadId,
      postId: targetPost.id,
      parentPostId: targetPost.parentPostId,
    }));
  }, [router, targetPost, threadId]);

  const selectedSubthread = thread?.subthreads.find(
    (s) => s.id === effectiveSubthreadId,
  );

  const { isThreadManager } = useThreadPermissions();
  const canManageThread = isThreadManager || user?.id === thread?.ownerId;

  // Loading
  if (isLoading || (!isInitialized && error)) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          加载中…
        </div>
      </div>
    );
  }

  // 404
  if (error) {
    const err = error as { code?: number };
    const is404 = err?.code === 40400;
    return (
      <PageShell width="feed" className="py-12">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 py-8">
              <AlertCircle className="h-10 w-10 text-muted-foreground" />
              {is404 ? (
                <EmptyState
                  title="主题帖不存在或已被删除"
                  description="该帖子可能尚未发布、已被删除或为私密帖"
                />
              ) : (
                <>
                  <EmptyState
                    title="加载失败"
                    description="请检查网络连接后重试"
                  />
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    重试
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (!thread) return null;

  return (
    <PageShell width="feed">
      {/* 头部 */}
      <ThreadDetailHeader
        thread={thread}
        isSearchOpen={isSearching}
        onSearch={() => setIsSearching((open) => !open)}
        onManage={canManageThread ? async () => {
          if (await closeComposer()) router.push(`/threads/${thread.id}/edit`);
        } : undefined}
      />

      {isSearching && (
        <div className="mt-5">
          <ThreadPostSearch
            threadId={thread.id}
            onClose={() => setIsSearching(false)}
            onSelect={() => {
              setSelectedSubthreadId(undefined);
              setIsSearching(false);
            }}
          />
        </div>
      )}

      <div className="mt-5 space-y-4">
        {/* 子贴 Tabs */}
        <SubthreadTabs
          subthreads={thread.subthreads}
          selectedId={effectiveSubthreadId}
          onChange={async (subthreadId) => {
            if (await closeComposer()) setSelectedSubthreadId(subthreadId);
          }}
        />

        {/* 子贴标题 + 正文（正文不占楼层号） */}
        {selectedSubthread && (
          <SubthreadBody
            subthread={selectedSubthread}
            isDefault={selectedSubthread.id === thread.defaultSubthreadId}
          />
        )}

        {/* 楼层列表 */}
        {effectiveSubthreadId && (
          <FloorList
            floors={floors}
            hasNextPage={!!hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            isLoading={isFloorsLoading}
            error={floorsError}
            onLoadMore={() => fetchNextPage()}
            onRetry={() => refetchFloors()}
            // 旧楼中楼链接重定向期间不高亮父楼层，最终只在独立页高亮目标回复。
            focusedFloor={targetPost?.parentPostId ? undefined : targetFloor}
          />
        )}

        {/* 发布楼层 */}
        {effectiveSubthreadId && thread.published && (
          <FloorForm
            subthreadId={effectiveSubthreadId}
          />
        )}
      </div>
    </PageShell>
  );
}
