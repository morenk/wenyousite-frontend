"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Archive, ArchiveRestore, ArrowDown, Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useDirectConversation } from "@/api/hooks/use-direct-conversations";
import { useDirectMessages } from "@/api/hooks/use-direct-messages";
import { useDirectMessageActions } from "@/api/hooks/use-direct-message-actions";
import { useBlockActions } from "@/api/hooks/use-block-actions";
import { getApiErrorMessage } from "@/api/errors";
import { DirectMessageBubble } from "@/components/message/direct-message-bubble";
import { DirectMessageComposer } from "@/components/message/direct-message-composer";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import {
  formatDirectMessageTime,
  shouldShowDirectMessageTime,
} from "@/lib/direct-message-timeline";

export function DirectConversationPanel({ conversationId }: { conversationId: string }) {
  const { user } = useAuth();
  const confirmAction = useConfirm();
  const conversationQuery = useDirectConversation(conversationId, user?.id);
  const history = useDirectMessages(conversationId, user?.id);
  const otherUserId = conversationQuery.data?.otherUser.id ?? "";
  const actions = useDirectMessageActions(conversationId, user?.id, otherUserId);
  const blockActions = useBlockActions(otherUserId);
  const [now, setNow] = useState(0);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const showJumpToLatestRef = useRef(false);
  const hasScrolledRef = useRef(false);
  const activeConversationIdRef = useRef(conversationId);
  const previousLatestMessageIdRef = useRef<string | undefined>(undefined);
  const markedReadRef = useRef<string | undefined>(undefined);

  const conversation = conversationQuery.data;
  const historyOffset = history.hasNextPage ? 1 : 0;
  const getScrollElement = useCallback(() => scrollContainerRef.current, []);
  const getItemKey = useCallback((index: number) => {
    if (historyOffset && index === 0) return "load-older-messages";
    return history.messages[index - historyOffset]?.id ?? index;
  }, [history.messages, historyOffset]);
  const estimateMessageSize = useCallback(
    (index: number) => historyOffset && index === 0 ? 48 : 96,
    [historyOffset],
  );
  const setJumpToLatestVisibility = useCallback((visible: boolean) => {
    if (showJumpToLatestRef.current === visible) return;
    showJumpToLatestRef.current = visible;
    setShowJumpToLatest(visible);
  }, []);
  // Virtualizer owns mutable measurement functions; it already performs its own render minimization.
  // eslint-disable-next-line react-hooks/incompatible-library
  const messageVirtualizer = useVirtualizer({
    count: history.messages.length + historyOffset,
    getScrollElement,
    getItemKey,
    estimateSize: estimateMessageSize,
    overscan: 8,
    gap: 16,
    anchorTo: "end",
    followOnAppend: "auto",
    scrollEndThreshold: 80,
    useFlushSync: false,
    directDomUpdates: true,
    directDomUpdatesMode: "transform",
  });

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  const latestMessage = history.messages.at(-1);
  const latestMessageId = latestMessage?.id;
  useLayoutEffect(() => {
    if (activeConversationIdRef.current !== conversationId) {
      activeConversationIdRef.current = conversationId;
      hasScrolledRef.current = false;
      previousLatestMessageIdRef.current = undefined;
      markedReadRef.current = undefined;
      setJumpToLatestVisibility(false);
    }
    if (!latestMessageId) return;
    const isInitialScroll = !hasScrolledRef.current;
    const isNewOwnMessage = previousLatestMessageIdRef.current !== latestMessageId
      && latestMessage?.senderId === user?.id;

    if (isInitialScroll || isNewOwnMessage) {
      messageVirtualizer.scrollToEnd({ behavior: isInitialScroll ? "auto" : "smooth" });
      setJumpToLatestVisibility(false);
    }
    hasScrolledRef.current = true;
    previousLatestMessageIdRef.current = latestMessageId;
  }, [
    conversationId,
    latestMessage?.senderId,
    latestMessageId,
    messageVirtualizer,
    setJumpToLatestVisibility,
    user?.id,
  ]);

  useEffect(() => {
    const latestIncoming = [...history.messages]
      .reverse()
      .find((message) => message.senderId !== user?.id);
    if (!conversation?.unreadCount || !latestIncoming) return;
    if (markedReadRef.current === latestIncoming.id) return;
    markedReadRef.current = latestIncoming.id;
    actions.markRead.mutate(latestIncoming.id, {
      onError: () => {
        markedReadRef.current = undefined;
      },
    });
  }, [actions.markRead, conversation?.unreadCount, history.messages, user?.id]);

  const handleRequest = async (action: "ACCEPT" | "DECLINE") => {
    if (action === "DECLINE") {
      const confirmed = await confirmAction({
        title: "拒绝消息请求",
        description: "拒绝后，此请求中的首条消息会被删除，对方不能再次向你发起请求。",
        confirmLabel: "拒绝",
        destructive: true,
      });
      if (!confirmed) return;
    }
    try {
      await actions.handleRequest.mutateAsync(action);
      toast.success(action === "ACCEPT" ? "已接受消息请求" : "已拒绝消息请求");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "操作失败，请稍后重试"));
    }
  };

  const handleArchive = async () => {
    if (!conversation) return;
    try {
      await actions.setArchived.mutateAsync(!conversation.archivedAt);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "归档操作失败"));
    }
  };

  const handleBlock = async () => {
    if (!conversation) return;
    const confirmed = await confirmAction({
      title: "拉黑用户",
      description: "拉黑后，当前消息请求会被拒绝，既有私聊记录保留但不能继续发送。",
      confirmLabel: "拉黑",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await blockActions.block.mutateAsync();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "操作失败，请稍后重试"));
    }
  };

  const recallMessage = actions.recall.mutateAsync;
  const handleRecall = useCallback(async (messageId: string) => {
    const confirmed = await confirmAction({
      title: "撤回消息",
      description: conversation?.status === "PENDING"
        ? "撤回首条消息将同时取消这次消息请求。"
        : "确定撤回这条消息吗？",
      confirmLabel: "撤回",
    });
    if (!confirmed) return;
    try {
      await recallMessage(messageId);
      toast.success("消息已撤回");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "撤回失败"));
    }
  }, [confirmAction, conversation?.status, recallMessage]);

  if (conversationQuery.isLoading) {
    return (
      <div className="flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (conversationQuery.isError || !conversation) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        无法加载该会话
        <Button variant="outline" size="sm" onClick={() => conversationQuery.refetch()}>
          重试
        </Button>
      </div>
    );
  }

  const requestIncoming = conversation.status === "PENDING" && conversation.requestDirection === "INCOMING";
  const requestOutgoing = conversation.status === "PENDING" && conversation.requestDirection === "OUTGOING";
  const sendingDisabledReason = conversation.isBlocked
    ? "你们之间存在拉黑关系，历史消息仅供查看。"
    : conversation.otherUser.isDeactivated
      ? "该用户已注销，历史消息仅供查看。"
      : requestOutgoing
        ? "对方接受消息请求后才能继续发送。"
        : conversation.status === "DECLINED"
          ? "该消息请求已被拒绝。"
          : conversation.status === "CANCELED"
            ? "该消息请求已取消。"
            : null;

  return (
    <section className="flex min-h-0 flex-col bg-card">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
        <Link href={`/users/${conversation.otherUser.id}`} className="flex min-w-0 items-center gap-3">
          <UserAvatar
            name={conversation.otherUser.username}
            src={conversation.otherUser.avatar}
            className="h-9 w-9"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{conversation.otherUser.username}</p>
            <p className="text-xs text-muted-foreground">
              {requestIncoming ? "发来的消息请求" : requestOutgoing ? "等待对方接受" : "私聊"}
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            title={conversation.archivedAt ? "取消归档" : "归档"}
            onClick={() => void handleArchive()}
            disabled={actions.setArchived.isPending}
          >
            {conversation.archivedAt ? <ArchiveRestore /> : <Archive />}
          </Button>
          {conversation.isBlocked ? (
            <span className="inline-flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
              <Ban className="h-4 w-4" />
              联系已被阻止
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => void handleBlock()}
              disabled={blockActions.block.isPending}
            >
              <Ban />
              拉黑
            </Button>
          )}
        </div>
      </header>

      {requestIncoming && (
        <div className="flex items-center justify-between gap-4 border-b border-border bg-warning-soft/55 px-4 py-3 text-sm text-warning">
          <p>接受后双方可以继续聊天；拒绝会删除这条请求消息。</p>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={actions.handleRequest.isPending}
              onClick={() => void handleRequest("DECLINE")}
            >
              拒绝
            </Button>
            <Button
              size="sm"
              disabled={actions.handleRequest.isPending}
              onClick={() => void handleRequest("ACCEPT")}
            >
              接受
            </Button>
          </div>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollContainerRef}
          role="log"
          aria-label="消息记录"
          className="h-full overflow-y-auto px-5 py-4"
          onScroll={(event) => {
            const container = event.currentTarget;
            const distanceToEnd = container.scrollHeight - container.clientHeight - container.scrollTop;
            setJumpToLatestVisibility(distanceToEnd > 80);
          }}
        >
          {history.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.isError ? (
            <div className="py-12 text-center text-sm text-muted-foreground">消息加载失败</div>
          ) : history.messages.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">暂无可显示的消息</div>
          ) : (
            <div
              ref={messageVirtualizer.containerRef}
              className="relative w-full"
            >
              {messageVirtualizer.getVirtualItems().map((virtualRow) => {
                if (historyOffset && virtualRow.index === 0) {
                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={messageVirtualizer.measureElement}
                      className="absolute left-0 top-0 w-full text-center"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={history.isFetchingNextPage}
                        onClick={() => history.fetchNextPage()}
                      >
                        {history.isFetchingNextPage ? "加载中…" : "查看更早消息"}
                      </Button>
                    </div>
                  );
                }

                const messageIndex = virtualRow.index - historyOffset;
                const message = history.messages[messageIndex];
                if (!message) return null;
                const mine = message.senderId === user?.id;
                const canRecall = mine && message.deliveryState !== "sending" && !message.recalledAt
                  && now - new Date(message.createdAt).getTime() <= 10 * 60 * 1000;
                const showTime = shouldShowDirectMessageTime(
                  message.createdAt,
                  history.messages[messageIndex - 1]?.createdAt,
                );
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={messageVirtualizer.measureElement}
                    className="absolute left-0 top-0 w-full"
                  >
                    {showTime && now > 0 && (
                      <time
                        dateTime={message.createdAt}
                        className="mb-3 block text-center text-xs text-muted-foreground"
                      >
                        {formatDirectMessageTime(message.createdAt, new Date(now))}
                      </time>
                    )}
                    <DirectMessageBubble
                      message={message}
                      mine={mine}
                      hideRequestImage={requestIncoming && !mine}
                      canRecall={canRecall}
                      recalling={actions.recall.isPending}
                      onRecall={handleRecall}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showJumpToLatest && history.messages.length > 0 && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-md"
            onClick={() => {
              // Dynamic message heights make a long smooth virtual scroll repeatedly
              // correct its target. Land once, then let appended messages follow at end.
              messageVirtualizer.scrollToEnd({ behavior: "auto" });
              setJumpToLatestVisibility(false);
              void history.refetchLatest();
            }}
          >
            <ArrowDown className="h-4 w-4" />
            回到最新消息
          </Button>
        )}
      </div>

      {conversation.canSend ? (
        <DirectMessageComposer onSend={(value) => actions.send.mutateAsync(value)} />
      ) : (
        <div className="border-t border-border px-4 py-4 text-center text-sm text-muted-foreground">
          {requestIncoming ? "请先接受或拒绝这条消息请求。" : sendingDisabledReason ?? "当前无法发送消息。"}
        </div>
      )}
    </section>
  );
}
