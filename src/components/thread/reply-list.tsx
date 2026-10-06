/** 楼中楼回复列表组件：展开回复 + 加载更多 + 回复串内对用户回复 */

"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { API_ERROR_CODE, isContentUnavailableError } from "@/api/errors";
import { useReplyWindow } from "@/api/hooks/use-discussion-window";
import { useDiscussionReading } from "@/hooks/use-discussion-reading";
import { DiscussionPositionBar } from "@/components/shared/discussion-position-bar";
import { DiscussionVirtualList, type DiscussionPosition } from "@/components/shared/discussion-virtual-list";
import { useThreadComposerSession } from "@/components/thread/thread-composer-context";
import { useReplies } from "@/api/hooks/use-replies";
import { useReplyAuthors } from "@/api/hooks/use-discussion-authors";
import { Button } from "@/components/ui/button";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { DiscussionListControls } from "@/components/shared/discussion-list-controls";
import type { ReplyOrder } from "@/api/reply-query";
import { ReplyCard } from "@/components/thread/reply-card";
import { useAuth } from "@/lib/auth";
import { useThreadPermissions } from "@/components/thread/thread-permissions-context";
import { DiscussionTargetMask } from "@/components/thread/discussion-target-mask";

interface ReplyListProps {
  postId: string;
  variant?: "embedded" | "discussion";
  targetReplyId?: string;
  targetActivationKey?: string | number;
  targetValidationPending?: boolean;
  onTargetRetry?: () => unknown;
  onTargetBack?: () => void;
}

export function ReplyList({
  postId,
  variant = "embedded",
  targetReplyId,
  targetActivationKey,
  targetValidationPending = false,
  onTargetRetry,
  onTargetBack = () => window.history.back(),
}: ReplyListProps) {
  const { user } = useAuth();
  const { session, close } = useThreadComposerSession();
  const windowed = variant === "discussion";
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibleId, setVisibleId] = useState<string>();
  const preserveId = session?.type === "edit" ? session.postId : session?.type === "reply" ? session.replyToPostId : undefined;
  const [order, setOrder] = useState<ReplyOrder>("OLDEST");
  const { authorFilter, setAuthorFilter, isProvided } = useThreadPermissions();
  const [localAuthorId, setLocalAuthorId] = useState<string>();
  const requestedAuthorId = isProvided
    ? authorFilter?.parentPostId === postId ? authorFilter.authorId : undefined
    : localAuthorId;
  const setAuthorId = (authorId?: string) => {
    if (isProvided) setAuthorFilter({ subthreadId: "", parentPostId: postId, authorId });
    else setLocalAuthorId(authorId);
  };
  const authorsQuery = useReplyAuthors(
    variant === "discussion" ? postId : undefined,
    user?.id,
  );
  const authorId = targetReplyId
    ? undefined
    : requestedAuthorId && (
      !authorsQuery.isSuccess ||
      authorsQuery.data.some((author) => author.id === requestedAuthorId)
    )
      ? requestedAuthorId
      : undefined;
  const filters = useMemo(() => ({ order, ...(authorId ? { authorId } : {}) }), [authorId, order]);
  const legacy = useReplies(windowed ? undefined : postId, filters);
  const windowQuery = useReplyWindow(windowed ? postId : undefined, filters, targetReplyId, [...selectedIds, ...(preserveId ? [preserveId] : []), ...(visibleId ? [visibleId] : [])]);
  const reading = useDiscussionReading({
    scope: `${windowQuery.viewerScope}:${postId}:${targetReplyId ?? ""}`, subject: "回复", filters, initialTarget: targetReplyId, locate: windowQuery.locate, beforeJump: close,
    filteredErrorCode: API_ERROR_CODE.DISCUSSION_TARGET_FILTERED,
    onFiltersChange: (next) => { setOrder(next.order); setAuthorId(next.authorId); },
  });
  const onReadingPosition = reading.onPosition;
  const handlePosition = useCallback((position: DiscussionPosition) => {
    setVisibleId((old) => old === position.id ? old : position.id);
    onReadingPosition(position);
  }, [onReadingPosition]);
  const focusId = windowed ? reading.targetId : targetReplyId;
  const activation = `${targetActivationKey ?? ""}:${reading.activation}`;
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = windowed ? windowQuery : legacy;

  const targetMaskKey = `${focusId ?? ""}:${activation}`;
  const [targetMaskState, setTargetMaskState] = useState({
    key: targetMaskKey,
    masked: Boolean(focusId),
  });
  const targetMasked = targetMaskState.key === targetMaskKey
    ? targetMaskState.masked
    : Boolean(focusId);
  const handleTargetMaskChange = useCallback((masked: boolean) => {
    setTargetMaskState({ key: targetMaskKey, masked });
  }, [targetMaskKey]);

  const sentinelRef = useInfiniteScroll({
    hasNextPage: Boolean(hasNextPage) && !targetMasked && !windowed,
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  const loadedReplies = data?.pages.flatMap((page) => page?.data ?? []) ?? [];
  const replies = isContentUnavailableError(error) ? [] : loadedReplies;
  const renderReply = (reply: (typeof replies)[number], index?: number) => (
    <ReplyCard key={reply.id} reply={reply} parentPostId={postId} variant={variant}
      ordinal={windowed ? reply.replyNumber ?? undefined : index} focused={reply.id === focusId} focusActivationKey={activation} />
  );

  const content = (
    <div className={variant === "discussion" ? "flex flex-col" : "mt-3 ml-3 rounded-[var(--radius-card)] bg-muted px-3 py-1"}>
      {variant === "discussion" ? (
        <DiscussionPositionBar key={`${windowQuery.viewerScope}:${postId}:${targetReplyId ?? ""}`} subject="回复" current={reading.current} maxNumber={windowQuery.maxNumber} total={windowQuery.total} onJump={reading.jump} onOpen={reading.cancelPending} onReturn={reading.returnToPrevious}>
        <DiscussionListControls
          subject="回复"
          order={order}
          onOrderChange={setOrder}
          authorId={authorId}
          onAuthorChange={setAuthorId}
          authors={authorsQuery.data ?? []}
          authorsLoading={authorsQuery.isLoading}
          authorsError={authorsQuery.isError}
          onRetryAuthors={() => void authorsQuery.refetch()}
        />
        </DiscussionPositionBar>
      ) : null}

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {Boolean(error) && !windowed && (
        <div className="flex items-center justify-between py-2">
          <p className="text-xs text-muted-foreground">回复加载失败</p>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            重试
          </Button>
        </div>
      )}

      {!isLoading && !error && replies.length === 0 && (
        <p className="py-2 text-xs text-muted-foreground">
          {authorId ? "这位成员还没有回复" : "还没有回复"}
        </p>
      )}

      {windowed ? <DiscussionVirtualList items={replies} numberOf={(reply) => reply.replyNumber ?? 0} renderItem={renderReply}
        targetId={focusId} activationKey={activation} preserveId={preserveId} restoreOffset={reading.restoreOffset}
        hasBefore={windowQuery.hasPreviousPage && !targetMasked && !error} hasAfter={hasNextPage && !targetMasked && !error}
        fetching={isFetchingNextPage || windowQuery.isFetchingPreviousPage} onBefore={windowQuery.fetchPreviousPage} onAfter={fetchNextPage}
        onPosition={handlePosition} onProtectedIdsChange={setSelectedIds} /> : replies.map((reply) => renderReply(reply))}

      {windowed && Boolean(error) ? <div role="alert" className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">回复加载失败<Button variant="ghost" size="sm" onClick={() => refetch()}>重试</Button></div> : null}

      {(!windowed && hasNextPage) || isFetchingNextPage ? (
        <div ref={sentinelRef} className="flex items-center justify-center py-2">
          {isFetchingNextPage ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchNextPage()}
              className="text-xs"
            >
              <ChevronDown className="mr-1 h-3.5 w-3.5" />
              加载更多回复
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );

  return (
    <DiscussionTargetMask
      key={targetMaskKey}
      targetId={focusId}
      activationKey={activation}
      restoreOffset={reading.restoreOffset}
      subject="回复"
      loadedIds={replies.map((reply) => reply.id)}
      hasNextPage={windowed ? false : Boolean(hasNextPage)}
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      validationPending={targetValidationPending}
      error={error}
      onLoadMore={fetchNextPage}
      onRetry={onTargetRetry ?? refetch}
      onBack={onTargetBack}
      onMaskChange={handleTargetMaskChange}
    >
      {content}
    </DiscussionTargetMask>
  );
}
