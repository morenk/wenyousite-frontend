/** 楼中楼回复列表组件：展开回复 + 加载更多 + 回复串内对用户回复 */

"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Loader2, ChevronDown, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useReplies } from "@/api/hooks/use-replies";
import { useDeletePost } from "@/api/hooks/use-delete-post";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { MarkdownContent } from "@/components/thread/markdown-content";
import { ThreadComposerOutlet } from "@/components/thread/thread-composer";
import { useThreadComposer } from "@/components/thread/thread-composer-context";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import type { PostData } from "@/api/hooks/use-floors";

interface ReplyListProps {
  postId: string;
  focusedReply?: PostData;
  variant?: "embedded" | "discussion";
}

export function ReplyList({ postId, focusedReply, variant = "embedded" }: ReplyListProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const deletePost = useDeletePost();
  const { session, open } = useThreadComposer();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useReplies(postId);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const loadedReplies = data?.pages.flatMap((page) => page?.data ?? []) ?? [];
  const replies = focusedReply && !loadedReplies.some((reply) => reply.id === focusedReply.id)
    ? [...loadedReplies, focusedReply]
    : loadedReplies;

  const invalidateReplies = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["replies", postId] }),
      // 更新父楼层的回复数。
      queryClient.invalidateQueries({ queryKey: ["floors"] }),
    ]);
  };

  const handleDeleteReply = async (reply: PostData) => {
    if (!confirm("确定要删除这条回复吗？删除后无法恢复。")) return;
    try {
      await deletePost.mutateAsync(reply.id);
      await invalidateReplies();
      toast.success("回复已删除");
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "删除失败，请稍后重试");
    }
  };

  // 父楼展开、目标回复渲染完成后再执行第二阶段滚动，避免只停在父楼。
  useEffect(() => {
    if (!focusedReply) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`post-${focusedReply.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [focusedReply]);

  return (
    <div className={variant === "discussion" ? "space-y-3" : "mt-3 space-y-2 border-l-2 border-border pl-3"}>
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
        <p className="py-2 text-xs text-muted-foreground">还没有回复</p>
      )}

      {replies.map((reply: PostData, index) => {
        const replyToUser = reply.replyToPost?.author?.username;
        const replyToId = reply.replyToPost?.id ?? reply.replyToPostId;
        const isAuthor = user?.id === reply.authorId;
        const anchorId = `reply:${reply.id}`;
        const isEditing = session?.key === `edit:${reply.id}`;
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
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserAvatar
                  name={reply.author.username}
                  src={reply.author.avatar}
                  className={variant === "discussion" ? "h-8 w-8" : "h-6 w-6"}
                  textClassName={variant === "discussion" ? "text-xs" : "text-[10px]"}
                />
                <Link
                  href={`/users/${reply.authorId}`}
                  className="text-xs font-medium text-foreground hover:text-primary"
                >
                  {reply.author.username}
                </Link>
                {variant === "discussion" && (
                  <span className="text-xs text-muted-foreground">讨论 #{index + 1}</span>
                )}
                {replyToUser && replyToId && (
                  <span className="text-xs text-muted-foreground">
                    回复{" "}
                    <Link
                      href={`/users/${reply.replyToPost?.authorId ?? ""}`}
                      className="text-muted-foreground hover:text-primary"
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
              {isAuthor && !isEditing && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    title="编辑回复"
                    onClick={() => {
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
                      });
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                    title="删除回复"
                    onClick={() => handleDeleteReply(reply)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              {user && !isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => open({
                    key: `reply:${reply.id}`,
                    anchorId,
                    type: "reply",
                    subthreadId: reply.subthreadId,
                    parentPostId: postId,
                    replyToPostId: reply.id,
                    label: `回复 @${reply.author.username}`,
                    initialContent: "",
                  })}
                >
                  <MessageSquare className="mr-1 h-3.5 w-3.5" />
                  回复
                </Button>
              )}
            </div>
            {!isEditing && (
              <MarkdownContent content={reply.content} />
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
