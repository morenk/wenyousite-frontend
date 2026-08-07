"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { AlertCircle, ArrowLeft, ChevronRight, FolderArchive, Inbox, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  type DirectConversation,
  useDirectConversations,
} from "@/api/hooks/use-direct-conversations";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function previewText(conversation: DirectConversation) {
  if (!conversation.lastMessage) return "暂无消息";
  if (conversation.lastMessage.isRecalled) return "消息已撤回";
  if (conversation.lastMessage.contentPreview) return conversation.lastMessage.contentPreview;
  if (conversation.lastMessage.hasImage) return "[图片]";
  return "暂无消息";
}

function conversationTime(conversation: DirectConversation) {
  return new Date(conversation.lastMessageAt ?? conversation.createdAt).getTime();
}

function mergeConversations(...groups: DirectConversation[][]) {
  const unique = new Map<string, DirectConversation>();
  groups.flat().forEach((conversation) => unique.set(conversation.id, conversation));
  return [...unique.values()].sort((left, right) => {
    const timeDifference = conversationTime(right) - conversationTime(left);
    return timeDifference || right.id.localeCompare(left.id);
  });
}

function ConversationLink({
  conversation,
  selected,
}: {
  conversation: DirectConversation;
  selected: boolean;
}) {
  return (
    <Link
      href={`/messages/${conversation.id}`}
      className={cn(
        "flex gap-3 px-4 py-3 transition-colors hover:bg-muted/60",
        selected && "bg-muted",
      )}
    >
      <UserAvatar
        name={conversation.otherUser.username}
        src={conversation.otherUser.avatar}
        className="h-10 w-10 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">
            {conversation.otherUser.username}
          </span>
          {conversation.lastMessageAt && (
            <time className="shrink-0 text-[10px] text-muted-foreground">
              {format(new Date(conversation.lastMessageAt), "MM-dd HH:mm")}
            </time>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {conversation.requestDirection === "INCOMING" && conversation.status === "PENDING"
              ? "[消息请求] "
              : conversation.requestDirection === "OUTGOING" && conversation.status === "PENDING"
                ? "[等待接受] "
                : ""}
            {previewText(conversation)}
          </p>
          {conversation.unreadCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
              {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function DirectConversationList({ selectedId }: { selectedId?: string }) {
  const { user } = useAuth();
  const [showArchived, setShowArchived] = useState(false);
  const inboxQuery = useDirectConversations("INBOX", user?.id, { poll: !showArchived });
  const requestsQuery = useDirectConversations("REQUESTS", user?.id, { poll: !showArchived });
  // 隐藏时仍首查一次以决定是否展示“已归档”入口，但不持续轮询。
  const archivedQuery = useDirectConversations("ARCHIVED", user?.id, { poll: showArchived });
  const inboxConversations = useMemo(
    () => inboxQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [inboxQuery.data?.pages],
  );
  const requestConversations = useMemo(
    () => requestsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [requestsQuery.data?.pages],
  );
  const archivedConversations = useMemo(
    () => archivedQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [archivedQuery.data?.pages],
  );
  const mainConversations = useMemo(
    () => mergeConversations(inboxConversations, requestConversations),
    [inboxConversations, requestConversations],
  );
  const activeQueries = showArchived
    ? [archivedQuery]
    : [inboxQuery, requestsQuery];
  const conversations = showArchived ? archivedConversations : mainConversations;
  const isLoading = activeQueries.some((query) => query.isLoading);
  const isError = activeQueries.some((query) => query.isError);
  const hasNextPage = activeQueries.some((query) => query.hasNextPage);
  const isFetchingNextPage = activeQueries.some((query) => query.isFetchingNextPage);
  const hasArchivedFolder = archivedConversations.length > 0;

  const refetchActive = () => {
    activeQueries.forEach((query) => void query.refetch());
  };

  const fetchMore = () => {
    activeQueries.forEach((query) => {
      if (query.hasNextPage) void query.fetchNextPage();
    });
  };

  return (
    <aside className="flex min-h-0 flex-col border-r border-border bg-background">
      {showArchived && (
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="返回聊天列表"
            onClick={() => setShowArchived(false)}
          >
            <ArrowLeft />
          </Button>
          <span className="text-sm font-medium">已归档</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
            <AlertCircle className="h-6 w-6" />
            会话加载失败
            <Button variant="outline" size="sm" onClick={refetchActive}>
              重试
            </Button>
          </div>
        ) : conversations.length === 0 && !hasArchivedFolder ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-xs text-muted-foreground">
            <Inbox className="h-7 w-7" />
            {showArchived ? "暂无归档会话" : "暂无私聊"}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {!showArchived && hasArchivedFolder && (
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                onClick={() => setShowArchived(true)}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <FolderArchive className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">已归档</span>
                  <span className="block text-xs text-muted-foreground">
                    {archivedConversations.length}{archivedQuery.hasNextPage ? "+" : ""} 个会话
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            {conversations.map((conversation) => (
              <ConversationLink
                key={conversation.id}
                conversation={conversation}
                selected={selectedId === conversation.id}
              />
            ))}
          </div>
        )}
      </div>

      {hasNextPage && (
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={isFetchingNextPage}
            onClick={fetchMore}
          >
            {isFetchingNextPage ? "加载中…" : "加载更多"}
          </Button>
        </div>
      )}
    </aside>
  );
}
