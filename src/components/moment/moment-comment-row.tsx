"use client";

import { ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { type MomentComment, useDeleteMomentComment } from "@/api/hooks/use-moments";
import { getApiErrorMessage } from "@/api/errors";
import { AdminContentModerationDialog } from "@/components/admin/admin-content-moderation-dialog";
import { ImageLightbox } from "@/components/shared/image-lightbox";
import { InternalReferenceText } from "@/components/shared/internal-reference-text";
import { ReplyActionButton } from "@/components/shared/reply-action-button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { WenyouTime } from "@/components/shared/wenyou-time";
import type { MomentReplyTarget } from "@/components/moment/moment-comment-types";
import { useAuth } from "@/lib/auth";
import { getStickerDisplayUrl, STICKER_DISPLAY_STYLE } from "@/lib/sticker-display";
import { cn } from "@/lib/utils";

export function MomentCommentRow({
  momentId,
  comment,
  compact = false,
  onReply,
  canInteract = true,
  focused = false,
}: {
  momentId: string;
  comment: MomentComment;
  compact?: boolean;
  onReply: (target: MomentReplyTarget) => void;
  canInteract?: boolean;
  focused?: boolean;
}) {
  const { user } = useAuth();
  const remove = useDeleteMomentComment(momentId, user?.id);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [moderationOpen, setModerationOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!focused) return;
    const frame = window.requestAnimationFrame(() => {
      rowRef.current?.scrollIntoView({ behavior: "auto", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focused]);

  const deleteComment = async () => {
    try {
      await remove.mutateAsync(comment.id);
      toast.success("评论已删除");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "删除失败"));
    }
  };

  return (
    <div
      ref={rowRef}
      id={`moment-comment-${comment.id}`}
      aria-current={focused ? "location" : undefined}
      className={cn(
        "flex scroll-mt-24 gap-3 rounded-xl transition-[background-color,box-shadow]",
        focused && "bg-primary/[0.06] ring-2 ring-primary/25 ring-offset-4 ring-offset-background",
      )}
    >
      <UserAvatar
        name={comment.author.username}
        src={comment.author.avatar}
        className={compact ? "size-7" : "size-9"}
        textClassName="text-[0.625rem]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{comment.author.username}</span>
          <WenyouTime value={comment.createdAt} className="text-[0.6875rem] text-muted-foreground" />
        </div>
        {comment.deleted ? (
          <p className="mt-1 text-sm leading-6 text-muted-foreground">该评论已删除</p>
        ) : comment.content || comment.replyToComment ? (
          <p className="mt-1 whitespace-pre-wrap break-words text-base leading-7 text-foreground">
            {comment.replyToComment ? (
              <span className="mr-1 text-muted-foreground">
                回复 {comment.replyToComment.author.username}{comment.content ? "：" : ""}
              </span>
            ) : null}
            {comment.content ? <InternalReferenceText content={comment.content} /> : null}
          </p>
        ) : null}
        {!comment.deleted && (comment.media || comment.sticker) ? (
          <button
            type="button"
            onClick={() => setLightboxUrl(comment.sticker?.url ?? comment.media?.url ?? null)}
            className="mt-2 block max-w-full overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            aria-label={comment.sticker ? "查看评论表情包" : "查看评论图片"}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={comment.sticker
                ? getStickerDisplayUrl(comment.sticker)
                : comment.media?.mediumUrl ?? comment.media?.url ?? ""}
              alt={comment.sticker ? "评论表情包" : "评论图片"}
              loading="lazy"
              decoding="async"
              className={comment.sticker
                ? "sticker-display object-contain"
                : "max-h-72 max-w-60 rounded-xl object-contain"}
              style={comment.sticker ? STICKER_DISPLAY_STYLE : undefined}
            />
          </button>
        ) : null}
        {!comment.deleted ? (
          <div className="mt-1 flex items-center gap-1">
            {canInteract ? (
              <ReplyActionButton
                onClick={() => onReply({ id: comment.id, username: comment.author.username })}
              />
            ) : null}
            {comment.canDelete ? (
              <button
                type="button"
                aria-label="删除"
                disabled={remove.isPending}
                onClick={() => void deleteComment()}
                className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color,transform] hover:bg-primary hover:text-brand-strong focus-visible:bg-primary focus-visible:text-brand-strong active:scale-95 disabled:cursor-wait disabled:opacity-40"
              >
                <Trash2 className="size-4" />
              </button>
            ) : null}
            {user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" ? (
              <button
                type="button"
                aria-label="站务隐藏评论"
                onClick={() => setModerationOpen(true)}
                className="inline-flex size-8 items-center justify-center rounded-lg text-destructive transition-[background-color,color,transform] hover:bg-destructive-soft focus-visible:bg-destructive-soft active:scale-95"
              >
                <ShieldAlert className="size-4" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {lightboxUrl ? (
        <ImageLightbox
          src={lightboxUrl}
          alt={comment.sticker ? "评论表情包" : "评论图片"}
          onClose={() => setLightboxUrl(null)}
        />
      ) : null}
      {user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" ? (
        <AdminContentModerationDialog
          target={{ type: "moment_comment", id: comment.id, label: compact ? "动态回复" : "动态评论" }}
          open={moderationOpen}
          onOpenChange={setModerationOpen}
        />
      ) : null}
    </div>
  );
}
