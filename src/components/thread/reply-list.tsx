/** 楼中楼回复列表组件：展开回复 + 加载更多 + 回复串内对用户回复 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useReplies } from "@/api/hooks/use-replies";
import { useDeletePost } from "@/api/hooks/use-delete-post";
import { getApiErrorMessage } from "@/api/errors";
import { useAuth } from "@/lib/auth";
import { getPostHref } from "@/lib/post-navigation";
import { MarkdownContent } from "@/components/thread/markdown-content";
import { ThreadComposerOutlet } from "@/components/thread/thread-composer";
import { useThreadComposer } from "@/components/thread/thread-composer-context";
import { useThreadPermissions } from "@/components/thread/thread-permissions-context";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import type { ReplyData, ReplyDisplayData } from "@/api/hooks/use-floors";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { LevelBadge } from "@/components/shared/level-badge";
import { useMembers } from "@/api/hooks/use-members";
import {
  ReplyThreadControls,
  type ReplyAuthorOption,
} from "@/components/shared/reply-thread-controls";
import type { ReplyOrder } from "@/api/reply-query";
import {
  getVisibleContentText,
  PostActionsMenu,
} from "@/components/thread/post-actions-menu";

interface ReplyListProps {
  postId: string;
  threadId?: string;
  focusedReply?: ReplyDisplayData;
  variant?: "embedded" | "discussion";
}

export function ReplyList({ postId, threadId, focusedReply, variant = "embedded" }: ReplyListProps) {
  const { user } = useAuth();
  const deletePost = useDeletePost();
  const confirmAction = useConfirm();
  const { session, open } = useThreadComposer();
  const { isManager } = useThreadPermissions();
  const [order, setOrder] = useState<ReplyOrder>("OLDEST");
  const [authorId, setAuthorId] = useState<string>();
  const filters = useMemo(() => ({ order, ...(authorId ? { authorId } : {}) }), [authorId, order]);
  const membersQuery = useMembers(variant === "discussion" ? threadId : undefined);
  const authorOptions = useMemo<ReplyAuthorOption[]>(() => {
    const roleRank = { OWNER: 0, COLLABORATOR: 1, PARTICIPANT: 2 } as const;
    return (membersQuery.data ?? [])
      .filter((member) => member.playerMarked || member.role === "OWNER" || member.role === "COLLABORATOR")
      .sort((first, second) =>
        roleRank[first.role] - roleRank[second.role] ||
        first.user.username.localeCompare(second.user.username, "zh-CN"),
      )
      .map((member) => ({
        id: member.userId,
        username: member.user.username,
        detail: member.role === "OWNER" ? "楼主" : member.role === "COLLABORATOR" ? "协作者" : "玩家",
      }));
  }, [membersQuery.data]);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useReplies(postId, filters);

  const sentinelRef = useInfiniteScroll({
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  const loadedReplies = data?.pages.flatMap((page) => page?.data ?? []) ?? [];
  const canShowFocusedReply = !authorId || focusedReply?.authorId === authorId;
  const replies = focusedReply && canShowFocusedReply && !loadedReplies.some((reply) => reply.id === focusedReply.id)
    ? [...loadedReplies, focusedReply]
    : loadedReplies;

  const handleDeleteReply = async (reply: ReplyDisplayData) => {
    if (!(await confirmAction({
      title: "删除回复",
      description: "确定要删除这条回复吗？删除后无法恢复。",
      confirmLabel: "删除",
      destructive: true,
    }))) return;
    try {
      await deletePost.mutateAsync(reply.id);
      toast.success("回复已删除");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "删除失败，请稍后重试"));
    }
  };

  // 父楼展开、目标回复渲染完成后再执行第二阶段滚动，避免只停在父楼。
  useEffect(() => {
    if (!focusedReply) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`post-${focusedReply.id}`)?.scrollIntoView({
        behavior: "auto",
        block: "center",
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [focusedReply]);

  return (
    <div className={variant === "discussion" ? "space-y-3" : "mt-3 space-y-2 border-l-2 border-border pl-3"}>
      {variant === "discussion" ? (
        <ReplyThreadControls
          order={order}
          onOrderChange={setOrder}
          authorId={authorId}
          onAuthorChange={setAuthorId}
          authors={authorOptions}
          authorScopeLabel="全部玩家与管理者"
        />
      ) : null}

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
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

      {replies.map((reply: ReplyData | ReplyDisplayData, index) => {
        const replyToUser = reply.replyToPost?.author?.username;
        const replyToId = reply.replyToPost?.id ?? reply.replyToPostId;
        const isAuthor = user?.id === reply.authorId;
        const canDelete = isAuthor || isManager;
        const anchorId = `reply:${reply.id}`;
        const isEditing = session?.key === `edit:${reply.id}`;
        const replyHref = getPostHref({
          threadId: reply.threadId,
          postId: reply.id,
          parentPostId: postId,
        });
        return (
          <div
            key={reply.id}
            id={`post-${reply.id}`}
            className={[
              variant === "discussion"
                ? "rounded-xl border border-border bg-card p-4"
                : "rounded-lg border border-border bg-background p-3",
              reply.id === focusedReply?.id && "border-primary bg-primary/[0.06] ring-2 ring-primary/20",
            ].filter(Boolean).join(" ")}
          >
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <UserAvatar
                  name={reply.author.username}
                  src={reply.author.avatar}
                  className={variant === "discussion" ? "h-8 w-8" : "h-6 w-6"}
                  textClassName={variant === "discussion" ? "text-xs" : "text-[10px]"}
                />
                <Link
                  href={`/users/${reply.authorId}`}
                  className="text-xs font-medium text-foreground hover:text-brand-strong"
                >
                  {reply.author.username}
                </Link>
                <LevelBadge level={reply.author.level} />
                {variant === "discussion" && (
                  <span className="text-xs text-muted-foreground">讨论 #{index + 1}</span>
                )}
                {replyToUser && replyToId && (
                  <span className="text-xs text-muted-foreground">
                    回复{" "}
                    <Link
                      href={`/users/${reply.replyToPost?.authorId ?? ""}`}
                      className="text-muted-foreground hover:text-brand-strong"
                    >
                      @{replyToUser}
                    </Link>
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(reply.createdAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </span>
              </div>
              {!isEditing ? (
                <PostActionsMenu
                  triggerLabel="更多回复操作"
                  menuLabel="回复操作"
                  copyText={() => getVisibleContentText(
                    `reply-content-${reply.id}`,
                    reply.content,
                  )}
                  copyHref={replyHref}
                  onReply={user ? () => {
                    open({
                      key: `reply:${reply.id}`,
                      anchorId,
                      type: "reply",
                      subthreadId: reply.subthreadId,
                      parentPostId: postId,
                      replyToPostId: reply.id,
                      label: `回复 @${reply.author.username}`,
                      initialContent: "",
                    });
                  } : undefined}
                  onEdit={isAuthor ? () => {
                    open({
                      key: `edit:${reply.id}`,
                      anchorId,
                      type: "edit",
                      subthreadId: reply.subthreadId,
                      postId: reply.id,
                      parentPostId: postId,
                      version: reply.version,
                      label: `编辑 @${reply.author.username} 的回复`,
                      initialContent: reply.content,
                      diceRolls: reply.diceRolls,
                    });
                  } : undefined}
                  onDelete={canDelete ? () => void handleDeleteReply(reply) : undefined}
                  moderationTarget={{ type: "post", id: reply.id, label: "回复" }}
                />
              ) : null}
            </div>
            {!isEditing && (
              <div id={`reply-content-${reply.id}`}>
                <MarkdownContent content={reply.content} diceRolls={reply.diceRolls} sourcePostId={reply.id} />
              </div>
            )}
            <ThreadComposerOutlet anchorId={anchorId} />
          </div>
        );
      })}

      {/* 加载更多 sentinel */}
      <div ref={sentinelRef} className="flex items-center justify-center py-2">
        {isFetchingNextPage && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {hasNextPage && !isFetchingNextPage && (
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
        {!hasNextPage && replies.length > 0 && (
          <span className="text-xs text-muted-foreground">没有更多了</span>
        )}
      </div>
    </div>
  );
}
