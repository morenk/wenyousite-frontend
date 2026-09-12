"use client";

import { ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type MomentComment, useDeleteMomentComment } from "@/api/hooks/use-moments";
import { getApiErrorMessage } from "@/api/errors";
import { AdminContentModerationDialog } from "@/components/admin/admin-content-moderation-dialog";
import dynamic from "next/dynamic";
import { MomentMediaImage } from "@/components/moment/moment-media-image";
import { useMomentOverlay } from "@/components/moment/moment-playback";
import { InternalReferenceText } from "@/components/shared/internal-reference-text";
import { ReplyActionButton } from "@/components/shared/reply-action-button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { WenyouTime } from "@/components/shared/wenyou-time";
import type { MomentReplyTarget } from "@/components/moment/moment-comment-types";
import { useAuth } from "@/lib/auth";
import { STICKER_DISPLAY_STYLE } from "@/lib/sticker-display";
import { useDiscussionTargetReveal } from "@/hooks/use-discussion-target-reveal";
import { cn } from "@/lib/utils";

const GalleryLightbox = dynamic(() => import("@/components/moment/moment-gallery-lightbox").then((module) => module.MomentGalleryLightbox), { ssr: false });

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
  useMomentOverlay(lightboxUrl !== null);

  useDiscussionTargetReveal(focused ? `moment-comment-${comment.id}` : undefined);

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
      id={`moment-comment-${comment.id}`}
      aria-current={focused ? "location" : undefined}
      className={cn(
        "flex scroll-mt-6 gap-3 rounded-xl transition-[background-color,box-shadow]",
        focused && "bg-primary/[0.12] ring-2 ring-brand-strong/55 ring-offset-4 ring-offset-background",
      )}
    >
      <UserAvatar
        name={comment.author.username}
        src={comment.author.avatar} display={comment.author.avatarDisplay}
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
          <MomentMediaImage
            media={comment.sticker ?? comment.media!}
            allowPlayback={lightboxUrl === null}
            mode={comment.sticker ? "sticker" : "detail"}
            // 评论按内容撑高；填满父级高度会将后续操作栏挤出本楼层。
            wrapperStyle={{ height: "auto" }}
            onClick={() => setLightboxUrl(comment.sticker?.url ?? comment.media?.url ?? null)}
            buttonClassName="mt-2 block max-w-full overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            buttonLabel={comment.sticker ? "查看评论表情包" : "查看评论图片"}
            alt={comment.sticker ? "评论表情包" : "评论图片"}
            loading="lazy"
            decoding="async"
            className={comment.sticker ? "sticker-display object-contain" : "max-h-72 max-w-60 rounded-xl object-contain"}
            style={comment.sticker ? STICKER_DISPLAY_STYLE : undefined}
          />
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
        <GalleryLightbox
          index={0}
          images={[{ src: lightboxUrl, alt: comment.sticker ? "评论表情包" : "评论图片", width: (comment.sticker ?? comment.media)?.width, height: (comment.sticker ?? comment.media)?.height, momentMedia: comment.sticker ?? comment.media! }]}
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
