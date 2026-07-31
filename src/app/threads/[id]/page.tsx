/** 主题帖详情页：头部 + 子贴 Tab + 楼层列表 + 发布 */

"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { useThreadDetail } from "@/api/hooks/use-thread-detail";
import { useFloors } from "@/api/hooks/use-floors";
import { useThreadMembers } from "@/api/hooks/use-member-actions";
import { ThreadDetailHeader } from "@/components/thread/thread-detail-header";
import { SubthreadTabs } from "@/components/thread/subthread-tabs";
import { FloorList } from "@/components/thread/floor-list";
import { FloorForm } from "@/components/thread/floor-form";
import { ManagementPanel } from "@/components/thread/management-panel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export default function ThreadDetailPage() {
  const params = useParams();
  const threadId = params.id as string;
  const { user } = useAuth();

  const {
    data: thread,
    isLoading,
    error,
    refetch,
  } = useThreadDetail(threadId);

  const { data: members = [] } = useThreadMembers(threadId);

  const [selectedSubthreadId, setSelectedSubthreadId] = useState<string>();
  const [isManaging, setIsManaging] = useState(false);

  const effectiveSubthreadId =
    selectedSubthreadId ?? thread?.defaultSubthreadId;

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

  const isOwner = user?.id === thread?.ownerId;
  const isMember = user
    ? isOwner || members.some((m) => m.userId === user.id)
    : false;

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
        isMember={isMember}
        onManage={isOwner ? () => setIsManaging(true) : undefined}
      />

      <div className="mt-5 space-y-4">
        {/* 子贴 Tabs */}
        <SubthreadTabs
          subthreads={thread.subthreads}
          selectedId={effectiveSubthreadId}
          onChange={setSelectedSubthreadId}
        />

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
          />
        )}

        {/* 发布楼层 */}
        {effectiveSubthreadId && thread.published && (
          <FloorForm
            subthreadId={effectiveSubthreadId}
            threadId={thread.id}
            isMember={isMember}
          />
        )}
      </div>
    </div>
  );
}
