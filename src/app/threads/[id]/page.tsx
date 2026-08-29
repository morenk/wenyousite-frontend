/** 主题帖详情页：主题文档卡 + 清晰分区的楼层讨论 + 发布。 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryState, useQueryStates } from "nuqs";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { getPostHref } from "@/lib/post-navigation";
import { useThreadDetail } from "@/api/hooks/use-thread-detail";
import { useFloors, usePrefetchFloors } from "@/api/hooks/use-floors";
import { usePost } from "@/api/hooks/use-post";
import {
  API_ERROR_CODE,
  getApiErrorMessage,
  hasApiErrorCode,
  isContentUnavailableError,
} from "@/api/errors";
import { useContentAccessCache } from "@/api/hooks/use-content-access-cache";
import { useFloorAuthors } from "@/api/hooks/use-discussion-authors";
import { useLatestThreadPost } from "@/api/hooks/use-latest-thread-post";
import type { FloorFilters, FloorOrder } from "@/api/floor-query";
import { ThreadDetailHeader } from "@/components/thread/thread-detail-header";
import { ThreadReadingBar } from "@/components/thread/thread-reading-bar";
import { ThreadPostSearch } from "@/components/thread/thread-post-search";
import { SubthreadBody } from "@/components/thread/subthread-body";
import { FloorList } from "@/components/thread/floor-list";
import { FloorListControls } from "@/components/thread/floor-list-controls";
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
import {
  floorOrderParser,
  threadContentCoordinateParsers,
} from "@/lib/thread-url-state";

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
  const router = useRouter();
  const { clearPost, clearThread } = useContentAccessCache();
  const threadId = params.id as string;
  const [contentCoordinate, setContentCoordinate] = useQueryStates(
    threadContentCoordinateParsers,
    {
      history: "replace",
      shallow: true,
      clearOnDefault: true,
    },
  );
  const targetPostId = contentCoordinate.post ?? undefined;
  const querySubthreadId = contentCoordinate.subthread ?? undefined;
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
  const latestPost = useLatestThreadPost();
  const [floorAuthorSelection, setFloorAuthorSelection] = useState<{
    subthreadId: string;
    authorId: string;
  }>();

  const {
    data: thread,
    isLoading,
    isFetching,
    isFetchedAfterMount,
    error,
    refetch,
  } = useThreadDetail(threadId);

  const [isSearching, setIsSearching] = useState(false);
  const targetPostQuery = usePost(targetPostId);
  const { data: targetPost } = targetPostQuery;
  const parentFloorId = targetPost?.parentPostId ?? undefined;
  const targetFloorId = targetPost?.parentPostId ?? targetPost?.id;
  const targetFloorQuery = usePost(parentFloorId);
  const targetFloor = parentFloorId ? targetFloorQuery.data : targetPost;

  const targetContextInvalid = Boolean(
    targetPost && targetPost.thread.id !== threadId,
  );
  const threadUnavailable = isContentUnavailableError(error);
  const targetUnavailable = Boolean(
    targetPostId &&
      (isContentUnavailableError(targetPostQuery.error) ||
        isContentUnavailableError(targetFloorQuery.error) ||
        targetContextInvalid),
  );

  useEffect(() => {
    if (!threadUnavailable) return;
    void closeComposer({ force: true });
    clearThread(threadId, { preserveActive: true });
  }, [clearThread, closeComposer, threadId, threadUnavailable]);

  useEffect(() => {
    if (!targetPostId || !targetUnavailable) return;
    void closeComposer({ force: true });
    clearPost(targetPostId, { preserveActive: true });
    if (targetFloorId && targetFloorId !== targetPostId) {
      clearPost(targetFloorId, { preserveActive: true });
    }
  }, [
    closeComposer,
    clearPost,
    targetFloorId,
    targetPostId,
    targetUnavailable,
  ]);

  const querySubthread = thread?.subthreads.find(
    (subthread) => subthread.id === querySubthreadId,
  );
  // 精确楼层定位优先级高于目录选择；无效目录只回落，不发起额外探测请求。
  const effectiveSubthreadId = targetPostId
    ? targetPost?.subthreadId ?? thread?.defaultSubthreadId
    : querySubthread?.id ?? thread?.defaultSubthreadId;

  const floorAuthorsQuery = useFloorAuthors(effectiveSubthreadId, user?.id);
  const requestedFloorAuthorId = floorAuthorSelection &&
    floorAuthorSelection.subthreadId === effectiveSubthreadId
    ? floorAuthorSelection.authorId
    : undefined;
  const floorAuthorId = requestedFloorAuthorId && (
    !floorAuthorsQuery.isSuccess ||
    floorAuthorsQuery.data.some((author) => author.id === requestedFloorAuthorId)
  )
    ? requestedFloorAuthorId
    : undefined;
  const floorFilters = useMemo<FloorFilters>(() => ({
    order: floorOrder,
    ...(floorAuthorId ? { authorId: floorAuthorId } : {}),
  }), [floorAuthorId, floorOrder]);

  const {
    data: floorsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isFloorsLoading,
    error: floorsError,
    refetch: refetchFloors,
  } = useFloors(effectiveSubthreadId, floorFilters);

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
      void setContentCoordinate({ subthread: null });
      return;
    }
    if (
      !targetPostId &&
      querySubthreadId &&
      (!querySubthread || querySubthreadId === thread.defaultSubthreadId)
    ) {
      void setContentCoordinate({ subthread: null });
    }
  }, [
    querySubthread,
    querySubthreadId,
    setContentCoordinate,
    targetPostId,
    thread,
  ]);

  const selectedSubthread = thread?.subthreads.find(
    (s) => s.id === effectiveSubthreadId,
  );
  const { isThreadManager } = useThreadPermissions();
  const canManageThread = isThreadManager || user?.id === thread?.ownerId;
  const prefetchFloors = usePrefetchFloors(floorOrder);

  const prefetchSubthread = useCallback((subthreadId: string) => {
    if (!subthreadId || subthreadId === effectiveSubthreadId) return;
    prefetchFloors(subthreadId);
  }, [effectiveSubthreadId, prefetchFloors]);

  useEffect(() => {
    if (!thread || !effectiveSubthreadId || thread.subthreads.length <= 1) return;
    const selectedIndex = thread.subthreads.findIndex(
      (subthread) => subthread.id === effectiveSubthreadId,
    );
    if (selectedIndex < 0) return;
    const adjacentIds = new Set([
      thread.subthreads[
        (selectedIndex - 1 + thread.subthreads.length) % thread.subthreads.length
      ]?.id,
      thread.subthreads[(selectedIndex + 1) % thread.subthreads.length]?.id,
    ]);
    adjacentIds.forEach((subthreadId) => {
      if (subthreadId) prefetchSubthread(subthreadId);
    });
  }, [effectiveSubthreadId, prefetchSubthread, thread]);

  useEffect(() => {
    if (!isSearching) return;
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[aria-label="帖内楼层搜索"]')
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [isSearching]);

  // Loading
  const awaitingThreadValidation = isFetching && !isFetchedAfterMount;
  const awaitingTargetValidation = Boolean(
    targetPostId &&
      ((targetPostQuery.isFetching && !targetPostQuery.isFetchedAfterMount) ||
        (parentFloorId &&
          targetFloorQuery.isFetching &&
          !targetFloorQuery.isFetchedAfterMount)),
  );

  if (isLoading || awaitingThreadValidation || awaitingTargetValidation || (!isInitialized && error)) {
    return <PageRouteFallback variant="detail" />;
  }

  if (error || targetPostQuery.error || targetFloorQuery.error || targetContextInvalid) {
    const unavailable = threadUnavailable || targetUnavailable;
    const retry = targetPostQuery.error || targetFloorQuery.error || targetContextInvalid
      ? () => {
          void targetPostQuery.refetch();
          if (parentFloorId) void targetFloorQuery.refetch();
        }
      : () => void refetch();
    return (
      <PageShell width="feed" className="py-12">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 py-8">
              <AlertCircle className="h-10 w-10 text-muted-foreground" />
              {unavailable ? (
                <EmptyState
                  title={targetUnavailable ? "内容不存在或已被删除" : "主题帖不存在或已被删除"}
                  description="内容可能已被删除、尚未发布，或你没有访问权限"
                />
              ) : (
                <>
                  <EmptyState title="加载失败" />
                  <Button variant="outline" size="sm" onClick={retry}>
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
    if (subthreadId === effectiveSubthreadId) return;
    if (await closeComposer()) {
      setFloorAuthorSelection(undefined);
      await setContentCoordinate({
        post: null,
        subthread: subthreadId === thread.defaultSubthreadId
          ? null
          : subthreadId,
      });
    }
  };

  const handleFloorOrderChange = async (nextOrder: FloorOrder) => {
    if (nextOrder === floorOrder) return;
    if (await closeComposer()) {
      await setFloorOrder(nextOrder);
    }
  };

  const handleFloorAuthorChange = async (nextAuthorId?: string) => {
    if (nextAuthorId === floorAuthorId) return;
    if (await closeComposer()) {
      setFloorAuthorSelection(
        nextAuthorId && effectiveSubthreadId
          ? { subthreadId: effectiveSubthreadId, authorId: nextAuthorId }
          : undefined,
      );
    }
  };

  const handleJumpToLatest = async () => {
    try {
      const target = await latestPost.mutateAsync(thread.id);
      if (!(await closeComposer())) return;

      setFloorAuthorSelection(undefined);
      setIsSearching(false);

      if (!target.parentPostId && targetPostId === target.id) {
        const scrollToTarget = () => {
          const element = document.getElementById(`post-${target.id}`);
          element?.scrollIntoView({ behavior: "auto", block: "center" });
          return Boolean(element);
        };
        window.requestAnimationFrame(() => {
          if (!scrollToTarget()) window.requestAnimationFrame(scrollToTarget);
        });
        return;
      }

      router.push(
        getPostHref({
          threadId: thread.id,
          postId: target.id,
          parentPostId: target.parentPostId,
          floorOrder,
        }),
      );
    } catch (error: unknown) {
      toast.error(
        hasApiErrorCode(error, API_ERROR_CODE.POST_NOT_FOUND)
          ? "当前主题还没有楼层或回复"
          : getApiErrorMessage(error, "最新发言加载失败，请稍后重试"),
      );
    }
  };

  const latestAvailable = thread._count.posts > 0 || floors.length > 0;

  return (
    <PageShell width="feed">
      <ThreadReadingBar
        subthreads={thread.subthreads}
        selectedSubthreadId={effectiveSubthreadId}
        onSubthreadChange={(subthreadId) =>
          void handleSubthreadChange(subthreadId)
        }
        onSubthreadPrefetch={prefetchSubthread}
        onSearch={() => setIsSearching((open) => !open)}
        isSearchOpen={isSearching}
        onJumpToLatest={() => void handleJumpToLatest()}
        latestPending={latestPost.isPending}
        latestAvailable={latestAvailable}
      />

      {/* 主题身份、目录与当前子贴正文共用同一个文档容器。 */}
      <ThreadDetailHeader
        thread={thread}
        isSearchOpen={isSearching}
        onSearch={() => setIsSearching((open) => !open)}
        onJumpToLatest={() => void handleJumpToLatest()}
        latestPending={latestPost.isPending}
        latestAvailable={latestAvailable}
        subthreads={thread.subthreads}
        selectedSubthreadId={effectiveSubthreadId}
        defaultSubthreadId={thread.defaultSubthreadId}
        onSubthreadChange={handleSubthreadChange}
        onSubthreadPrefetch={prefetchSubthread}
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
            <FloorListControls
              order={floorOrder}
              onOrderChange={(nextOrder) => void handleFloorOrderChange(nextOrder)}
              authorId={floorAuthorId}
              onAuthorChange={(nextAuthorId) => void handleFloorAuthorChange(nextAuthorId)}
              authors={floorAuthorsQuery.data ?? []}
              authorsLoading={floorAuthorsQuery.isLoading}
              authorsError={floorAuthorsQuery.isError}
              onRetryAuthors={() => void floorAuthorsQuery.refetch()}
            />
            <FloorList
              floors={floors}
              hasNextPage={!!hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              isLoading={isFloorsLoading}
              error={floorsError}
              onLoadMore={() => fetchNextPage()}
              onRetry={() => refetchFloors()}
              // 旧楼中楼链接重定向期间不高亮父楼层，最终只在独立页高亮目标回复。
              focusedFloor={
                targetPost?.parentPostId ||
                (floorAuthorId && targetFloor?.authorId !== floorAuthorId)
                  ? undefined
                  : targetFloor
              }
              emptyTitle={floorAuthorId ? "这位成员在当前子贴还没有楼层" : undefined}
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
