/** 楼层卡片组件：Markdown 渲染 + 作者信息 + 时间 + 编辑/删除（作者本人，楼层均可删） */

"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getPostDiscussionHref, getPostHref } from "@/lib/post-navigation";
import { useAuth } from "@/lib/auth";
import { useDeletePost } from "@/api/hooks/use-delete-post";
import { getApiErrorMessage } from "@/api/errors";
import { MarkdownContent } from "@/components/thread/markdown-content";
import { ThreadComposerOutlet } from "@/components/thread/thread-composer";
import { useThreadComposer } from "@/components/thread/thread-composer-context";
import { useThreadPermissions } from "@/components/thread/thread-permissions-context";
import { UserAvatarLink } from "@/components/shared/user-avatar";
import { WenyouTime } from "@/components/shared/wenyou-time";
import { ReplyActionButton } from "@/components/shared/reply-action-button";
import { buttonVariants } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import type { FloorDisplayData } from "@/api/hooks/use-floors";
import { LevelBadge } from "@/components/shared/level-badge";
import {
  getVisibleContentText,
  PostActionsMenu,
} from "@/components/thread/post-actions-menu";
import { ReplyCard } from "@/components/thread/reply-card";

interface FloorCardProps {
  floor: FloorDisplayData;
  focused?: boolean;
}

/** 楼层卡片内联楼中楼预览的字符上限。 */
export const INLINE_REPLY_LIMIT = 5;
export const INLINE_REPLY_MAX_LENGTH = 500;

export function FloorCard({ floor, focused = false }: FloorCardProps) {
  const { user } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const deletePost = useDeletePost();
  const confirmAction = useConfirm();
  const { session, open } = useThreadComposer();
  const { isManager } = useThreadPermissions();

  const isAuthor = !!user && user.id === floor.authorId;
  const canDelete = isAuthor || isManager;
  const editAnchorId = `floor-edit:${floor.id}`;
  const replyAnchorId = `reply:${floor.id}`;
  const isEditing = session?.key === `edit:${floor.id}`;
  const isReplying = session?.anchorId === replyAnchorId && session.type === "reply";
  const discussionHref = getPostDiscussionHref(floor.threadId, floor.id);
  const floorHref = getPostHref({ threadId: floor.threadId, postId: floor.id });
  const inlineReplies = (floor.replies ?? []).slice(0, INLINE_REPLY_LIMIT);
  const inlineRepliesLength = inlineReplies.reduce(
    (total, reply) => total + reply.content.length,
    0,
  );
  const hasHiddenInlineReplies = floor._count.replies > inlineReplies.length;
  const inlineRepliesOverflow =
    hasHiddenInlineReplies || inlineRepliesLength > INLINE_REPLY_MAX_LENGTH;
  const hasActiveInlineComposer = inlineReplies.some(
    (reply) => session?.anchorId === `reply:${reply.id}`,
  );
  const shouldClipInlineReplies = inlineRepliesOverflow && !hasActiveInlineComposer;

  useEffect(() => {
    if (!focused) return;
    const timer = window.setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: "auto", block: "center" });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [focused]);

  const handleStartEdit = () => {
    open({
      key: `edit:${floor.id}`,
      anchorId: editAnchorId,
      type: "edit",
      subthreadId: floor.subthreadId,
      postId: floor.id,
      version: floor.version,
      label: `编辑 #${floor.floorNumber ?? ""}`,
      initialContent: floor.content,
      diceRolls: floor.diceRolls,
    });
  };

  const handleStartReply = () => {
    void open({
      key: replyAnchorId,
      anchorId: replyAnchorId,
      type: "reply",
      subthreadId: floor.subthreadId,
      parentPostId: floor.id,
      replyToPostId: floor.id,
      label: `回复 #${floor.floorNumber ?? ""} ${floor.author.username}`.trim(),
      initialContent: "",
    });
  };

  const handleDelete = async () => {
    if (!(await confirmAction({
      title: "删除楼层",
      description: "确定要删除该楼层吗？删除后无法恢复。",
      confirmLabel: "删除",
      destructive: true,
    }))) return;
    try {
      await deletePost.mutateAsync(floor.id);
      toast.success("楼层已删除");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "删除失败，请稍后重试"));
    }
  };

  return (
    <div
      ref={cardRef}
      id={`post-${floor.id}`}
      className={cn(
        "rounded-xl border border-border bg-card p-4 transition-colors",
        focused && "border-primary bg-accent/30 ring-2 ring-primary/20",
      )}
    >
      {/* 楼层头部 */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <UserAvatarLink
            userId={floor.authorId}
            name={floor.author.username}
            src={floor.author.avatar}
            className="h-8 w-8"
            textClassName="text-sm"
          />
          <Link
            href={`/users/${floor.authorId}`}
            className="text-sm font-medium text-foreground hover:text-brand-strong"
          >
            {floor.author.username}
          </Link>
          <LevelBadge level={floor.author.level} />
          {floor.floorNumber != null && (
            <span className="text-xs text-muted-foreground">
              #{floor.floorNumber}
            </span>
          )}
        </div>
        {!isEditing ? (
          <PostActionsMenu
            triggerLabel="更多楼层操作"
            menuLabel="楼层操作"
            copyText={() => getVisibleContentText(`floor-content-${floor.id}`, floor.content)}
            copyHref={floorHref}
            onEdit={isAuthor ? handleStartEdit : undefined}
            onDelete={canDelete ? () => void handleDelete() : undefined}
            moderationTarget={{ type: "post", id: floor.id, label: `楼层 #${floor.floorNumber ?? ""}`.trim() }}
          />
        ) : null}
      </div>

      {/* 楼层正文 / 编辑态 */}
      {isEditing ? (
        <ThreadComposerOutlet anchorId={editAnchorId} />
      ) : (
        <div id={`floor-content-${floor.id}`}>
          <MarkdownContent content={floor.content} diceRolls={floor.diceRolls} sourcePostId={floor.id} />
        </div>
      )}

      {/* 发布时间与直接回复入口：承接正文，并保持在楼中楼预览上方。 */}
      <div
        data-testid="floor-card-meta"
        className="mt-3 flex min-h-6 items-center justify-between gap-3"
      >
        <WenyouTime value={floor.createdAt} className="text-xs text-muted-foreground" />
        {!isEditing && user ? (
          <div data-testid="floor-card-actions" className="ml-auto flex items-center gap-1">
            <ReplyActionButton presentation="labeled" onClick={handleStartReply} />
          </div>
        ) : null}
      </div>

      {isReplying ? (
        <div className="mt-3">
          <ThreadComposerOutlet anchorId={replyAnchorId} />
        </div>
      ) : null}

      {/* 楼中楼预览：数量或正文长度超限时截断并用渐变遮罩引导完整阅读。 */}
      {!isEditing && inlineReplies.length > 0 && (
        <div
          data-testid="inline-replies"
          className={cn(
            "relative mt-2 border-l-2 border-border pl-3",
            shouldClipInlineReplies && "max-h-96 overflow-hidden",
          )}
        >
          <div className="space-y-2">
            {inlineReplies.map((reply) => (
              <ReplyCard
                key={reply.id}
                reply={reply}
                parentPostId={floor.id}
                variant="preview"
              />
            ))}
          </div>
          {shouldClipInlineReplies && (
            <>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card to-transparent" />
              <Link
                href={discussionHref}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "absolute bottom-3 left-1/2 z-10 -translate-x-1/2 bg-card/95",
                )}
              >
                查看全部 {floor._count.replies} 条回复
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
