/** 共享楼中楼回复卡片：作者信息、正文、原位回复与低频操作。 */

"use client";

import Link from "next/link";
import { toast } from "sonner";
import { useDeletePost } from "@/api/hooks/use-delete-post";
import type { ReplyData, ReplyDisplayData } from "@/api/hooks/use-floors";
import { getApiErrorMessage } from "@/api/errors";
import { ReplyActionButton } from "@/components/shared/reply-action-button";
import { UserAvatarLink } from "@/components/shared/user-avatar";
import { WenyouTime } from "@/components/shared/wenyou-time";
import { LevelBadge } from "@/components/shared/level-badge";
import { MarkdownContent } from "@/components/thread/markdown-content";
import {
  getVisibleContentText,
  PostActionsMenu,
} from "@/components/thread/post-actions-menu";
import { ThreadComposerOutlet } from "@/components/thread/thread-composer";
import { useThreadComposer } from "@/components/thread/thread-composer-context";
import { useThreadPermissions } from "@/components/thread/thread-permissions-context";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useAuth } from "@/lib/auth";
import { getPostHref } from "@/lib/post-navigation";
import { cn } from "@/lib/utils";
import { useTransientTargetHighlight } from "@/hooks/use-transient-target-highlight";

type ReplyCardVariant = "preview" | "embedded" | "discussion";

interface ReplyCardProps {
  reply: ReplyData | ReplyDisplayData;
  parentPostId: string;
  variant?: ReplyCardVariant;
  ordinal?: number;
  focused?: boolean;
}

export function ReplyCard({
  reply,
  parentPostId,
  variant = "embedded",
  ordinal,
  focused = false,
}: ReplyCardProps) {
  const { user } = useAuth();
  const deletePost = useDeletePost();
  const confirmAction = useConfirm();
  const { session, open } = useThreadComposer();
  const { isManager } = useThreadPermissions();
  const isDiscussion = variant === "discussion";
  const isPreview = variant === "preview";
  const isAuthor = user?.id === reply.authorId;
  const canDelete = isAuthor || isManager;
  const anchorId = `reply:${reply.id}`;
  const isEditing = session?.key === `edit:${reply.id}`;
  const replyHref = getPostHref({
    threadId: reply.threadId,
    postId: reply.id,
    parentPostId,
  });
  const replyToUser = reply.replyToPost?.author?.username;
  const replyToId = reply.replyToPost?.id ?? reply.replyToPostId;
  const highlightVisible = useTransientTargetHighlight(focused ? reply.id : undefined);

  const handleStartReply = () => {
    void open({
      key: `reply:${reply.id}`,
      anchorId,
      type: "reply",
      subthreadId: reply.subthreadId,
      parentPostId,
      replyToPostId: reply.id,
      label: `回复 @${reply.author.username}`,
      initialContent: "",
    });
  };

  const handleStartEdit = () => {
    void open({
      key: `edit:${reply.id}`,
      anchorId,
      type: "edit",
      subthreadId: reply.subthreadId,
      postId: reply.id,
      parentPostId,
      version: reply.version,
      label: `编辑 @${reply.author.username} 的回复`,
      initialContent: reply.content,
      diceRolls: reply.diceRolls,
    });
  };

  const handleDelete = async () => {
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

  return (
    <div
      id={`post-${reply.id}`}
      data-testid={isPreview ? "inline-reply" : undefined}
      className={cn(
        isDiscussion
          ? "rounded-xl border border-border bg-card p-4 transition-[border-color] duration-[var(--motion-slow)] ease-out"
          : "rounded-lg border border-border bg-background p-3 transition-[border-color] duration-[var(--motion-slow)] ease-out",
        highlightVisible && "border-primary",
      )}
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <UserAvatarLink
            userId={reply.authorId}
            name={reply.author.username}
            src={reply.author.avatar}
            className={isDiscussion ? "h-8 w-8" : isPreview ? "h-5 w-5" : "h-6 w-6"}
            textClassName={isDiscussion ? "text-xs" : isPreview ? "text-[9px]" : "text-[10px]"}
          />
          <Link
            href={`/users/${reply.authorId}`}
            className="text-xs font-medium text-foreground hover:text-brand-strong"
          >
            {reply.author.username}
          </Link>
          <LevelBadge level={reply.author.level} />
          {isDiscussion && ordinal != null ? (
            <span className="font-utility text-xs tabular-nums text-muted-foreground">
              #{ordinal}
            </span>
          ) : null}
          {replyToUser && replyToId ? (
            <span className="text-xs text-muted-foreground">
              回复{" "}
              <Link
                href={`/users/${reply.replyToPost?.authorId ?? ""}`}
                className="text-muted-foreground hover:text-brand-strong"
              >
                @{replyToUser}
              </Link>
            </span>
          ) : null}
        </div>
        {!isEditing ? (
          <PostActionsMenu
            triggerLabel="更多回复操作"
            menuLabel="回复操作"
            copyText={() => getVisibleContentText(
              `reply-content-${reply.id}`,
              reply.content,
            )}
            copyContentId={`reply-content-${reply.id}`}
            copyHref={replyHref}
            onEdit={isAuthor ? handleStartEdit : undefined}
            onDelete={canDelete ? () => void handleDelete() : undefined}
            moderationTarget={{ type: "post", id: reply.id, label: "回复" }}
          />
        ) : null}
      </div>

      {!isEditing ? (
        <div id={`reply-content-${reply.id}`}>
          <MarkdownContent
            content={reply.content}
            diceRolls={reply.diceRolls}
            sourcePostId={reply.id}
            size={isPreview ? "compact" : undefined}
          />
        </div>
      ) : null}

      <div
        data-testid="reply-card-meta"
        className="mt-3 flex min-h-8 items-center justify-between gap-3"
      >
        <WenyouTime value={reply.createdAt} className="text-xs text-muted-foreground" />
        {!isEditing && user ? (
          <ReplyActionButton
            presentation="labeled"
            onClick={handleStartReply}
          />
        ) : null}
      </div>
      <ThreadComposerOutlet anchorId={anchorId} />
    </div>
  );
}
