/** 主题帖详情页：头部 + 子贴 Tab + 楼层列表 + 发布 + 阅读进度 */

"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { useThreadDetail } from "@/api/hooks/use-thread-detail";
import { useFloors } from "@/api/hooks/use-floors";
import { usePost } from "@/api/hooks/use-post";
import {
  useUpdateReadingProgress,
  useNewReplies,
} from "@/api/hooks/use-reading-progress";
import { ThreadDetailHeader } from "@/components/thread/thread-detail-header";
import { SubthreadTabs } from "@/components/thread/subthread-tabs";
import { SubthreadBody } from "@/components/thread/subthread-body";
import { FloorList } from "@/components/thread/floor-list";
import { FloorForm } from "@/components/thread/floor-form";
import { ManagementPanel } from "@/components/thread/management-panel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export default function ThreadDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const threadId = params.id as string;
  const targetPostId = searchParams.get("post") ?? undefined;
  const { user } = useAuth();

  const {
    data: thread,
    isLoading,
    error,
    refetch,
  } = useThreadDetail(threadId);

  const [selectedSubthreadId, setSelectedSubthreadId] = useState<string>();
  const [isManaging, setIsManaging] = useState(false);
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
  const focusedReply = targetPost?.parentPostId ? targetPost : undefined;

  // 阅读进度：为每个子贴查询新增回复数，切换子贴时记录进度
  const newReplies = useNewReplies(effectiveSubthreadId, !!user && thread?.published);
  const updateProgress = useUpdateReadingProgress();

  const newRepliesMap = Object.fromEntries(
    thread?.subthreads.map((s) => [s.id, 0]) ?? [],
  );
  if (newReplies.data && effectiveSubthreadId) {
    newRepliesMap[effectiveSubthreadId] = newReplies.data.newReplies;
  }

  // 进入/切换子贴时记录阅读进度
  useEffect(() => {
    if (!user || !effectiveSubthreadId || !thread?.published) return;
    const lastPost = floors[floors.length - 1];
    updateProgress.mutate({
      subthreadId: effectiveSubthreadId,
      postId: lastPost?.id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSubthreadId, user, thread?.id]);

  const selectedSubthread = thread?.subthreads.find(
    (s) => s.id === effectiveSubthreadId,
  );

  const isOwner = user?.id === thread?.ownerId;

  // Loading
  if (isLoading) {
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
    const err = error as { statusCode?: number };
    const is404 = err?.statusCode === 404;
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
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
      </div>
    );
  }

  if (!thread) return null;

  // 管理面板（帖主全页覆盖）
  if (isManaging) {
    return (
      <div className="mx-auto h-[calc(100vh-3.5rem)] max-w-6xl px-4 py-4">
        <ManagementPanel
          thread={thread}
          onExit={() => setIsManaging(false)}
          onRefetch={refetch}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* 头部 */}
      <ThreadDetailHeader
        thread={thread}
        onManage={isOwner ? () => setIsManaging(true) : undefined}
      />

      <div className="mt-5 space-y-4">
        {/* 子贴 Tabs */}
        <SubthreadTabs
          subthreads={thread.subthreads}
          selectedId={effectiveSubthreadId}
          onChange={setSelectedSubthreadId}
          newRepliesMap={newRepliesMap}
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
            focusedFloor={targetFloor}
            focusedReply={focusedReply}
          />
        )}

        {/* 发布楼层 */}
        {effectiveSubthreadId && thread.published && (
          <FloorForm
            subthreadId={effectiveSubthreadId}
          />
        )}
      </div>
    </div>
  );
}
