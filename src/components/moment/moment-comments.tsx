"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ArrowDownUp, ChevronDown, ChevronUp, ImagePlus, Loader2, Reply, ShieldAlert, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import {
  type MomentComment,
  type MomentRootComment,
  useCreateMomentComment,
  useDeleteMomentComment,
  useMomentComments,
  useMomentReplies,
} from "@/api/hooks/use-moments";
import { getApiErrorMessage } from "@/api/errors";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ImageLightbox } from "@/components/shared/image-lightbox";
import { FloatingInputDock } from "@/components/shared/floating-input-dock";
import { ImageUploadProgress } from "@/components/shared/image-upload-progress";
import { InternalReferenceInsert } from "@/components/shared/internal-reference-insert";
import { InternalReferenceText } from "@/components/shared/internal-reference-text";
import { StickerPickerPopover } from "@/components/sticker/sticker-picker-popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { UserSticker } from "@/api/hooks/use-stickers";
import { useAuth } from "@/lib/auth";
import { compressMomentImage, validateMomentImageFile } from "@/lib/moment-image";
import {
  isUploadAbortError,
  uploadImageFile,
  type UploadImageProgress as UploadImageProgressValue,
  type UploadImageStage,
} from "@/lib/upload-image";
import type { ReplyFilters, ReplyOrder } from "@/api/reply-query";
import { getStickerDisplayUrl, STICKER_DISPLAY_STYLE } from "@/lib/sticker-display";
import { cn } from "@/lib/utils";
import { insertTextAtSelection } from "@/lib/internal-reference";
import { AdminContentModerationDialog } from "@/components/admin/admin-content-moderation-dialog";

const commentSchema = z.object({
  content: z.string().trim().max(500, "评论最多 500 个字"),
});
type CommentForm = z.infer<typeof commentSchema>;
type ReplyTarget = { id: string; username: string } | null;
const LARGE_REPLY_THREAD_THRESHOLD = 10;

export function MomentComments({ momentId }: { momentId: string }) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<ReplyOrder>("NEWEST");
  const filters = useMemo<ReplyFilters>(
    () => ({ order }),
    [order],
  );
  const commentsQuery = useMomentComments(momentId, user?.id, filters);
  const comments = commentsQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const [replyTarget, setReplyTarget] = useState<ReplyTarget>(null);
  const targetRootCommentId = searchParams.get("comment");
  const targetReplyId = targetRootCommentId ? searchParams.get("reply") : null;
  const targetRootLoaded = !!targetRootCommentId && comments.some(
    (comment) => comment.id === targetRootCommentId,
  );
  const loadedCommentPageCount = commentsQuery.data?.pages.length ?? 0;
  const hasNextCommentPage = commentsQuery.hasNextPage;
  const isFetchingNextCommentPage = commentsQuery.isFetchingNextPage;
  const fetchNextCommentPage = commentsQuery.fetchNextPage;
  const requestedCommentPageCountRef = useRef<number | null>(null);

  useEffect(() => {
    requestedCommentPageCountRef.current = null;
  }, [order, targetRootCommentId]);

  useEffect(() => {
    if (
      !targetRootCommentId ||
      targetRootLoaded ||
      !hasNextCommentPage ||
      isFetchingNextCommentPage ||
      requestedCommentPageCountRef.current === loadedCommentPageCount
    ) return;

    requestedCommentPageCountRef.current = loadedCommentPageCount;
    void fetchNextCommentPage();
  }, [
    fetchNextCommentPage,
    hasNextCommentPage,
    isFetchingNextCommentPage,
    loadedCommentPageCount,
    targetRootCommentId,
    targetRootLoaded,
  ]);

  return (
    <section id="comments" className="scroll-mt-6 pt-8" aria-labelledby="moment-comments-title">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-display text-xs tracking-[0.16em] text-muted-foreground">楼中楼</p>
          <h2 id="moment-comments-title" className="mt-1 font-display text-xl font-bold">评论</h2>
        </div>
        <button
          type="button"
          aria-label={`评论排序：${order === "NEWEST" ? "最新在前" : "最早在前"}`}
          aria-pressed={order === "NEWEST"}
          title={order === "NEWEST" ? "切换为最早在前" : "切换为最新在前"}
          onClick={() => setOrder((current) => current === "NEWEST" ? "OLDEST" : "NEWEST")}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowDownUp className="size-3.5" />
          {order === "NEWEST" ? "最新在前" : "最早在前"}
        </button>
      </div>

      {commentsQuery.isLoading ? (
        <div className="flex justify-center py-14" role="status"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : commentsQuery.isError ? (
        <div className="py-10 text-center"><p className="text-sm text-muted-foreground">评论加载失败</p><Button variant="ghost" size="sm" className="mt-2" onClick={() => void commentsQuery.refetch()}>重试</Button></div>
      ) : comments.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">还没有评论。发表第一条评论。</p>
      ) : (
        <div className="mt-7 divide-y divide-border/70">
          {comments.map((comment) => (
            <MomentCommentThread
              key={`${comment.id}:${comment.id === targetRootCommentId
                ? targetReplyId ?? targetRootCommentId
                : ""}`}
              momentId={momentId}
              comment={comment}
              filters={filters}
              onReply={setReplyTarget}
              focusedCommentId={comment.id === targetRootCommentId
                ? targetReplyId ?? targetRootCommentId
                : undefined}
            />
          ))}
        </div>
      )}

      {commentsQuery.hasNextPage ? (
        <div className="flex justify-center py-4"><Button variant="ghost" size="sm" disabled={commentsQuery.isFetchingNextPage} onClick={() => void commentsQuery.fetchNextPage()}>{commentsQuery.isFetchingNextPage ? <Loader2 className="animate-spin" /> : <ChevronDown />}加载更多评论</Button></div>
      ) : null}

      <FloatingInputDock slotPrefix="floating-moment-comment" layerClassName="z-[70]">
        <MomentCommentForm
          momentId={momentId}
          replyTarget={replyTarget}
          onCancelReply={() => setReplyTarget(null)}
        />
      </FloatingInputDock>
    </section>
  );
}

function MomentCommentForm({ momentId, replyTarget, onCancelReply }: { momentId: string; replyTarget: ReplyTarget; onCancelReply: () => void }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const create = useCreateMomentComment(momentId, user?.id);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const uploadedRef = useRef<{ file: File; mediaId: string } | null>(null);
  const requestRef = useRef<{ signature: string; requestId: string } | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sticker, setSticker] = useState<UserSticker | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [uploadStage, setUploadStage] = useState<"compressing" | UploadImageStage | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadImageProgressValue | null>(null);
  const { register, handleSubmit, reset, setError, clearErrors, control, getValues, setValue, formState: { errors } } = useForm<CommentForm>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: "" },
  });
  const contentRegistration = register("content");
  const contentLength = useWatch({ control, name: "content" }).length;
  const pending = create.isPending || uploadStage !== null;
  const isExpanded = expanded || replyTarget !== null;

  useEffect(() => {
    if (isExpanded) textareaRef.current?.focus({ preventScroll: true });
  }, [isExpanded, replyTarget]);

  useEffect(() => () => {
    uploadAbortRef.current?.abort();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  if (!user) {
    return (
      <button type="button" onClick={() => router.push(`/login?next=${encodeURIComponent(pathname)}`)} className="w-full rounded-2xl bg-background/95 px-4 py-3 text-left text-sm text-muted-foreground backdrop-blur-xl transition-colors hover:bg-muted hover:text-foreground">
        登录后发表评论
      </button>
    );
  }

  if (!isExpanded) {
    return (
      <div className="rounded-2xl bg-background/95 p-2 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full rounded-xl bg-muted/85 px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {contentLength || image || sticker ? "继续编辑评论…" : "发表评论…"}
        </button>
      </div>
    );
  }

  const clearMedia = () => {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    uploadedRef.current = null;
    requestRef.current = null;
    setUploadStage(null);
    setUploadProgress(null);
    setImage(null);
    setSticker(null);
    setPreviewUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const selectImage = (file?: File) => {
    if (!file) return;
    const validationError = validateMomentImageFile(file);
    if (validationError) {
      toast.error(validationError);
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }
    uploadedRef.current = null;
    requestRef.current = null;
    setSticker(null);
    setImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    clearErrors("content");
  };

  const selectSticker = (selected: UserSticker) => {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    uploadedRef.current = null;
    requestRef.current = null;
    setUploadStage(null);
    setUploadProgress(null);
    setImage(null);
    setPreviewUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setSticker(selected);
    clearErrors("content");
  };

  const submit = async ({ content }: CommentForm) => {
    const normalized = content.trim();
    if (!normalized && !image && !sticker) {
      setError("content", { message: "请输入评论或选择一张图片/表情包" });
      return;
    }
    const submittedReplyTarget = replyTarget;
    const submittedImage = image;
    const submittedSticker = sticker;
    const signature = JSON.stringify([
      normalized,
      submittedReplyTarget?.id ?? null,
      submittedImage
        ? [submittedImage.name, submittedImage.type, submittedImage.size, submittedImage.lastModified]
        : null,
      submittedSticker?.asset.id ?? null,
    ]);
    const request = requestRef.current?.signature === signature
      ? requestRef.current
      : { signature, requestId: crypto.randomUUID() };
    requestRef.current = request;
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    try {
      let mediaId: string | undefined;
      if (submittedImage) {
        if (uploadedRef.current?.file === submittedImage) {
          mediaId = uploadedRef.current.mediaId;
        } else {
          setUploadStage("compressing");
          setUploadProgress(null);
          const compressed = await compressMomentImage(submittedImage, { signal: controller.signal });
          const uploaded = await uploadImageFile(compressed, {
            signal: controller.signal,
            onStage: setUploadStage,
            onProgress: setUploadProgress,
          });
          mediaId = uploaded.mediaId;
          uploadedRef.current = { file: submittedImage, mediaId };
        }
      }
      await create.mutateAsync({
        content: normalized,
        ...(mediaId ? { mediaId } : {}),
        ...(submittedSticker ? { stickerAssetId: submittedSticker.asset.id } : {}),
        replyToCommentId: submittedReplyTarget?.id,
        clientRequestId: request.requestId,
      });
      requestRef.current = null;
      uploadedRef.current = null;
      reset();
      clearMedia();
      onCancelReply();
      setExpanded(false);
      toast.success(submittedReplyTarget ? "回复已发送" : "评论已发送");
    } catch (error) {
      if (isUploadAbortError(error)) return;
      toast.error(getApiErrorMessage(error, "发送失败，请稍后重试"));
    } finally {
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
      setUploadStage(null);
      setUploadProgress(null);
    }
  };

  const pendingLabel = uploadStage === "compressing"
    ? "正在压缩"
    : uploadStage === "preparing"
      ? "正在准备"
      : uploadStage === "uploading"
        ? `正在上传${uploadProgress?.percent === null || uploadProgress?.percent === undefined ? "" : ` ${uploadProgress.percent}%`}`
        : uploadStage === "processing"
          ? "正在处理"
          : "发送";

  const insertReference = (markdown: string) => {
    const textarea = textareaRef.current;
    const current = getValues("content");
    const result = insertTextAtSelection(
      current,
      markdown,
      textarea?.selectionStart,
      textarea?.selectionEnd,
    );
    if (Array.from(result.value).length > 500) {
      setError("content", { message: "评论最多 500 个字" });
      return;
    }
    setValue("content", result.value, { shouldDirty: true, shouldValidate: true });
    window.requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(result.cursor, result.cursor);
    });
  };

  return (
    <form onSubmit={(event) => void handleSubmit(submit)(event)} className="rounded-2xl bg-background/95 p-3 backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>{replyTarget ? `回复 ${replyTarget.username}` : "发表评论"}</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            onCancelReply();
            setExpanded(false);
          }}
          className="rounded-md p-1 hover:bg-muted disabled:opacity-50"
          aria-label="收起评论框"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <Textarea
        placeholder={replyTarget ? `回复 ${replyTarget.username}` : "说说你的想法"}
        maxLength={500}
        rows={2}
        className="min-h-16 max-h-32 resize-none border-transparent bg-muted/70"
        disabled={pending}
        aria-invalid={!!errors.content}
        {...contentRegistration}
        ref={(element) => { contentRegistration.ref(element); textareaRef.current = element; }}
      />

      {previewUrl || sticker ? (
        <div className="relative mt-3 w-fit rounded-xl bg-background/75 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sticker ? getStickerDisplayUrl(sticker.asset) : previewUrl ?? ""}
            alt={sticker ? "待发送表情包" : "待发送评论图片"}
            className={sticker ? "sticker-display object-contain" : "max-h-40 max-w-56 rounded-lg object-contain"}
            style={sticker ? STICKER_DISPLAY_STYLE : undefined}
          />
          <button
            type="button"
            onClick={clearMedia}
            disabled={create.isPending}
            aria-label={sticker ? "移除表情包" : "移除评论图片"}
            className="absolute -right-2 -top-2 rounded-full bg-foreground p-1 text-background shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : null}

      {uploadProgress ? (
        <ImageUploadProgress
          progress={uploadProgress}
          onCancel={clearMedia}
          className="mt-2"
          compact
        />
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-1">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            aria-label="上传评论图片"
            className="hidden"
            onChange={(event) => selectImage(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => imageInputRef.current?.click()}
          >
            <ImagePlus className="size-4" />图片
          </Button>
          <StickerPickerPopover
            disabled={pending}
            label="表情包"
            onSelect={selectSticker}
          />
          <InternalReferenceInsert
            disabled={pending}
            getSuggestedLabel={() => {
              const textarea = textareaRef.current;
              return textarea
                ? getValues("content").slice(textarea.selectionStart, textarea.selectionEnd)
                : "";
            }}
            onInsert={insertReference}
            className="text-muted-foreground"
          />
          <span className="hidden text-xs text-muted-foreground sm:inline">限 1 张图片或表情 · {contentLength}/500</span>
        </div>
        <Button type="submit" variant="ghost" size="sm" className="shrink-0 text-brand-strong" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}{pendingLabel}
        </Button>
      </div>
      {errors.content?.message ? <p className="mt-1 px-1 text-xs text-destructive">{errors.content.message}</p> : null}
    </form>
  );
}

function MomentCommentThread({
  momentId,
  comment,
  filters,
  onReply,
  focusedCommentId,
}: {
  momentId: string;
  comment: MomentRootComment;
  filters: ReplyFilters;
  onReply: (target: ReplyTarget) => void;
  focusedCommentId?: string;
}) {
  const { user } = useAuth();
  const targetReplyId = focusedCommentId && focusedCommentId !== comment.id
    ? focusedCommentId
    : null;
  const [expanded, setExpanded] = useState(() => !!targetReplyId);
  const threadRef = useRef<HTMLElement | null>(null);
  const requestedReplyPageCountRef = useRef<number | null>(null);
  const repliesQuery = useMomentReplies(momentId, comment.id, user?.id, expanded, filters);
  const expandedReplies = repliesQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const replies = expanded
    ? repliesQuery.data ? expandedReplies : comment.replies
    : comment.replies;
  const targetReplyLoaded = !!targetReplyId && expandedReplies.some(
    (reply) => reply.id === targetReplyId,
  );
  const loadedReplyPageCount = repliesQuery.data?.pages.length ?? 0;
  const hasNextReplyPage = repliesQuery.hasNextPage;
  const isFetchingNextReplyPage = repliesQuery.isFetchingNextPage;
  const fetchNextReplyPage = repliesQuery.fetchNextPage;
  const isLargeExpandedThread = expanded && comment.replyCount > LARGE_REPLY_THREAD_THRESHOLD;

  useEffect(() => {
    requestedReplyPageCountRef.current = null;
  }, [targetReplyId]);

  useEffect(() => {
    if (
      !expanded ||
      !targetReplyId ||
      targetReplyLoaded ||
      !hasNextReplyPage ||
      isFetchingNextReplyPage ||
      requestedReplyPageCountRef.current === loadedReplyPageCount
    ) return;

    requestedReplyPageCountRef.current = loadedReplyPageCount;
    void fetchNextReplyPage();
  }, [
    expanded,
    fetchNextReplyPage,
    hasNextReplyPage,
    isFetchingNextReplyPage,
    loadedReplyPageCount,
    targetReplyId,
    targetReplyLoaded,
  ]);

  const collapseReplies = () => {
    setExpanded(false);
    window.requestAnimationFrame(() => {
      threadRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    });
  };

  return (
    <article ref={threadRef} className="scroll-mt-6 py-5">
      <CommentRow
        momentId={momentId}
        comment={comment}
        onReply={onReply}
        focused={focusedCommentId === comment.id}
      />
      {replies.length > 0 ? (
        <div className="ml-10 mt-3 space-y-3 rounded-2xl bg-muted/55 px-4 py-3">
          {isLargeExpandedThread ? (
            <div
              data-slot="moment-replies-collapse-dock"
              className="pointer-events-none sticky top-4 z-20 mb-2 flex h-8 justify-end"
            >
              <button
                type="button"
                onClick={collapseReplies}
                aria-label={`收起 ${comment.replyCount} 条回复`}
                className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/95 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur-xl transition-[background-color,color,box-shadow,transform] hover:-translate-y-0.5 hover:bg-background hover:text-brand-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <ChevronUp className="size-3.5" />
                收起 {comment.replyCount} 条回复
              </button>
            </div>
          ) : null}
          {replies.map((reply) => (
            <CommentRow
              key={reply.id}
              momentId={momentId}
              comment={reply}
              compact
              onReply={onReply}
              focused={focusedCommentId === reply.id}
            />
          ))}
          {!expanded && comment.replyCount > comment.replies.length ? (
            <button type="button" onClick={() => setExpanded(true)} className="text-xs font-semibold text-brand-strong hover:underline">展开全部 {comment.replyCount} 条回复</button>
          ) : null}
          {expanded && repliesQuery.hasNextPage ? (
            <button type="button" disabled={repliesQuery.isFetchingNextPage} onClick={() => void repliesQuery.fetchNextPage()} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-strong hover:underline disabled:opacity-50">{repliesQuery.isFetchingNextPage && <Loader2 className="size-3 animate-spin" />}继续加载</button>
          ) : null}
          {expanded && !isLargeExpandedThread ? (
            <button type="button" onClick={collapseReplies} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-strong hover:underline">
              <ChevronUp className="size-3" />收起回复
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function CommentRow({
  momentId,
  comment,
  compact = false,
  onReply,
  focused = false,
}: {
  momentId: string;
  comment: MomentComment;
  compact?: boolean;
  onReply: (target: ReplyTarget) => void;
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
      <UserAvatar name={comment.author.username} src={comment.author.avatar} className={compact ? "size-7" : "size-9"} textClassName="text-[0.625rem]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{comment.author.username}</span>
          <time className="font-utility text-[0.6875rem] text-muted-foreground" dateTime={comment.createdAt}>
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: zhCN })}
          </time>
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
            <button
              type="button"
              aria-label="回复"
              onClick={() => onReply({ id: comment.id, username: comment.author.username })}
              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color,transform] hover:bg-primary hover:text-brand-strong focus-visible:bg-primary focus-visible:text-brand-strong active:scale-95"
            >
              <Reply className="size-4" />
            </button>
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
