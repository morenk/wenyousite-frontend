"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, Ban, Loader2 } from "lucide-react";
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);
  const markedReadRef = useRef<string | undefined>(undefined);

  const conversation = conversationQuery.data;

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  const latestMessageId = history.messages.at(-1)?.id;
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !latestMessageId) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: hasScrolledRef.current ? "smooth" : "auto",
    });
    hasScrolledRef.current = true;
  }, [latestMessageId]);

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
      toast.success(conversation.archivedAt ? "已移回会话列表" : "已归档");
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
      toast.success("已拉黑");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "操作失败，请稍后重试"));
    }
  };

  const handleRecall = async (messageId: string) => {
    const confirmed = await confirmAction({
      title: "撤回消息",
      description: conversation?.status === "PENDING"
        ? "撤回首条消息将同时取消这次消息请求。"
        : "确定撤回这条消息吗？",
      confirmLabel: "撤回",
    });
    if (!confirmed) return;
    try {
      await actions.recall.mutateAsync(messageId);
      toast.success("消息已撤回");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "撤回失败"));
    }
  };

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
    <section className="flex min-h-0 flex-col bg-background">
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
        <div className="flex items-center justify-between gap-4 border-b border-border bg-amber-50 px-4 py-3 text-sm dark:bg-amber-950/20">
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

      <div
        ref={scrollContainerRef}
        role="log"
        aria-label="消息记录"
        className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
      >
        {history.hasNextPage && (
          <div className="mb-4 text-center">
            <Button
              variant="ghost"
              size="sm"
              disabled={history.isFetchingNextPage}
              onClick={() => history.fetchNextPage()}
            >
              {history.isFetchingNextPage ? "加载中…" : "查看更早消息"}
            </Button>
          </div>
        )}
        {history.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : history.isError ? (
          <div className="py-12 text-center text-sm text-muted-foreground">消息加载失败</div>
        ) : history.messages.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">暂无可显示的消息</div>
        ) : (
          <div className="space-y-4">
            {history.messages.map((message, index) => {
              const mine = message.senderId === user?.id;
              const canRecall = mine && message.deliveryState !== "sending" && !message.recalledAt
                && now - new Date(message.createdAt).getTime() <= 10 * 60 * 1000;
              const showTime = shouldShowDirectMessageTime(
                message.createdAt,
                history.messages[index - 1]?.createdAt,
              );
              return (
                <div key={message.id}>
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
                    onRecall={() => void handleRecall(message.id)}
                  />
                </div>
              );
            })}
          </div>
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
