/** 主题帖详情页：主题文档卡 + 清晰分区的楼层讨论 + 发布。 */

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQueryState } from "nuqs";
import { AlertCircle } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { getPostHref, getSubthreadHref } from "@/lib/post-navigation";
import { useThreadDetail } from "@/api/hooks/use-thread-detail";
import { useFloors } from "@/api/hooks/use-floors";
import { usePost } from "@/api/hooks/use-post";
import type { FloorOrder } from "@/api/floor-query";
import { ThreadDetailHeader } from "@/components/thread/thread-detail-header";
import { ThreadReadingBar } from "@/components/thread/thread-reading-bar";
import { ThreadPostSearch } from "@/components/thread/thread-post-search";
import { SubthreadBody } from "@/components/thread/subthread-body";
import { FloorList } from "@/components/thread/floor-list";
import { FloorOrderControl } from "@/components/thread/floor-order-control";
import {
  FloorForm,
  getFloorComposerAnchorId,
} from "@/components/thread/floor-form";
import { FloatingComposerDock } from "@/components/thread/floating-composer-dock";
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
import { PageRouteFallback } from "@/components/layout/page-route-fallback";
import { floorOrderParser } from "@/lib/thread-url-state";

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
  const querySubthreadId = searchParams.get("subthread") ?? undefined;
  const [floorOrder, setFloorOrder] = useQueryState(
    "order",
    floorOrderParser.withOptions({
      history: "push",
      shallow: true,
      clearOnDefault: true,
    }),
  );
  const { user, isInitialized } = useAuth();
  const { close: closeComposer } = useThreadComposer();

  const {
    data: thread,
    isLoading,
    error,
    refetch,
  } = useThreadDetail(threadId);

  const [isSearching, setIsSearching] = useState(false);
  const { data: targetPost } = usePost(targetPostId);
  const targetFloorId = targetPost?.parentPostId ?? targetPost?.id;
  const { data: targetFloor } = usePost(targetFloorId);

  const querySubthread = thread?.subthreads.find(
    (subthread) => subthread.id === querySubthreadId,
  );
  // 精确楼层定位优先级高于目录选择；无效目录只回落，不发起额外探测请求。
  const effectiveSubthreadId = targetPostId
    ? targetPost?.subthreadId ?? thread?.defaultSubthreadId
    : querySubthread?.id ?? thread?.defaultSubthreadId;

  const {
    data: floorsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isFloorsLoading,
    error: floorsError,
    refetch: refetchFloors,
  } = useFloors(effectiveSubthreadId, floorOrder);

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

  useEffect(() => {
    if (!thread) return;
    if (targetPostId && querySubthreadId) {
      router.replace(getPostHref({
        threadId,
        postId: targetPostId,
        parentPostId: targetPost?.parentPostId,
        floorOrder,
      }));
      return;
    }
    if (!targetPostId && querySubthreadId && !querySubthread) {
      router.replace(getSubthreadHref(
        threadId,
        thread.defaultSubthreadId,
        thread.defaultSubthreadId,
        floorOrder,
      ));
    }
  }, [floorOrder, querySubthread, querySubthreadId, router, targetPost?.parentPostId, targetPostId, thread, threadId]);

  const selectedSubthread = thread?.subthreads.find(
    (s) => s.id === effectiveSubthreadId,
  );
  const { isThreadManager } = useThreadPermissions();
  const canManageThread = isThreadManager || user?.id === thread?.ownerId;

  useEffect(() => {
    if (!isSearching) return;
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[aria-label="帖内楼层搜索"]')
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [isSearching]);

  // Loading
  if (isLoading || (!isInitialized && error)) {
    return <PageRouteFallback variant="detail" />;
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
                  <EmptyState title="加载失败" />
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

  const handleSubthreadChange = async (subthreadId: string) => {
    if (await closeComposer()) {
      router.replace(getSubthreadHref(
        thread.id,
        subthreadId,
        thread.defaultSubthreadId,
        floorOrder,
      ));
    }
  };

  const handleFloorOrderChange = async (nextOrder: FloorOrder) => {
    if (nextOrder === floorOrder) return;
    if (await closeComposer()) {
      await setFloorOrder(nextOrder);
    }
  };

  return (
    <PageShell width="feed">
      <ThreadReadingBar
        threadTitle={thread.title}
        subthreads={thread.subthreads}
        selectedSubthreadId={effectiveSubthreadId}
        onSubthreadChange={(subthreadId) =>
          void handleSubthreadChange(subthreadId)
        }
        onSearch={() => setIsSearching((open) => !open)}
        isSearchOpen={isSearching}
      />

      {/* 主题身份、目录与当前子贴正文共用同一个文档容器。 */}
      <ThreadDetailHeader
        thread={thread}
        isSearchOpen={isSearching}
        onSearch={() => setIsSearching((open) => !open)}
        subthreads={thread.subthreads}
        selectedSubthreadId={effectiveSubthreadId}
        defaultSubthreadId={thread.defaultSubthreadId}
        onSubthreadChange={handleSubthreadChange}
        onManage={
          canManageThread
            ? async () => {
                if (await closeComposer()) {
                  router.push(`/threads/${thread.id}/edit`);
                }
              }
            : undefined
        }
      >
        {selectedSubthread ? (
          <SubthreadBody
            subthread={selectedSubthread}
            isDefault={selectedSubthread.id === thread.defaultSubthreadId}
            threadTitle={thread.title}
          />
        ) : null}
      </ThreadDetailHeader>

      {isSearching && (
        <div className="mt-5">
          <ThreadPostSearch
            threadId={thread.id}
            onClose={() => setIsSearching(false)}
            onSelect={() => {
              setIsSearching(false);
            }}
          />
        </div>
      )}

      <div className="mt-4 space-y-4">
        {effectiveSubthreadId && (
          <section aria-label="帖子回复">
            {floors.length > 1 || hasNextPage ? (
              <FloorOrderControl
                order={floorOrder}
                onOrderChange={(nextOrder) => void handleFloorOrderChange(nextOrder)}
              />
            ) : null}
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
          </section>
        )}

        {/* 发布楼层 */}
        {effectiveSubthreadId && thread.published && (
          <FloatingComposerDock
            sessionAnchorId={getFloorComposerAnchorId(effectiveSubthreadId)}
          >
            <FloorForm
              subthreadId={effectiveSubthreadId}
            />
          </FloatingComposerDock>
        )}
      </div>
    </PageShell>
  );
}
