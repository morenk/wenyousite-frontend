"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useCreateMomentComment } from "@/api/hooks/use-moments";
import { getApiErrorMessage } from "@/api/errors";
import { ImageUploadProgress } from "@/components/shared/image-upload-progress";
import {
  InternalReferenceEditor,
  type InternalReferenceEditorHandle,
} from "@/components/shared/internal-reference-editor";
import { InternalReferenceInsert } from "@/components/shared/internal-reference-insert";
import { usePublicInviteConfirmation } from "@/components/shared/use-public-invite-confirmation";
import { StickerPickerPopover } from "@/components/sticker/sticker-picker-popover";
import { Button } from "@/components/ui/button";
import type { UserSticker } from "@/api/hooks/use-stickers";
import { useAuth } from "@/lib/auth";
import { compressMomentImage, validateMomentImageFile } from "@/lib/moment-image";
import {
  isUploadAbortError,
  uploadImageFile,
  type UploadImageProgress as UploadImageProgressValue,
  type UploadImageStage,
} from "@/lib/upload-image";
import { getStickerDisplayUrl, STICKER_DISPLAY_STYLE } from "@/lib/sticker-display";
import type { MomentReplyTarget } from "@/components/moment/moment-comment-types";
import { useLoginRedirect } from "@/hooks/use-login-redirect";

const commentSchema = z.object({
  content: z.string().trim().max(500, "评论最多 500 个字"),
});
type CommentForm = z.infer<typeof commentSchema>;

export function MomentCommentForm({
  momentId,
  replyTarget,
  onCancelReply,
}: {
  momentId: string;
  replyTarget: MomentReplyTarget;
  onCancelReply: () => void;
}) {
  const { user } = useAuth();
  const redirectToLogin = useLoginRedirect();
  const create = useCreateMomentComment(momentId, user?.id);
  const { confirmPublicInvite, resetPublicInviteConfirmation } = usePublicInviteConfirmation();
  const contentEditorRef = useRef<InternalReferenceEditorHandle | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const uploadedRef = useRef<{ file: File; mediaId: string } | null>(null);
  const preparedImageRef = useRef<{ source: File; file: File } | null>(null);
  const requestRef = useRef<{ signature: string; requestId: string } | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sticker, setSticker] = useState<UserSticker | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [uploadStage, setUploadStage] = useState<"compressing" | UploadImageStage | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadImageProgressValue | null>(null);
  const {
    handleSubmit,
    reset,
    setError,
    clearErrors,
    control,
    formState: { errors },
  } = useForm<CommentForm>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: "" },
  });
  const contentLength = useWatch({ control, name: "content" }).length;
  const pending = create.isPending || uploadStage !== null;
  const isExpanded = expanded || replyTarget !== null;

  useEffect(() => {
    if (isExpanded) contentEditorRef.current?.focus({ preventScroll: true });
  }, [isExpanded, replyTarget]);

  useEffect(() => () => {
    uploadAbortRef.current?.abort();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => redirectToLogin()}
        className="w-full rounded-2xl bg-background/95 px-4 py-3 text-left text-sm text-muted-foreground backdrop-blur-xl transition-colors hover:bg-muted hover:text-foreground"
      >
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
    preparedImageRef.current = null;
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
    preparedImageRef.current = null;
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
    preparedImageRef.current = null;
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
    if (!(await confirmPublicInvite(normalized))) return;
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
          let compressed = preparedImageRef.current?.source === submittedImage
            ? preparedImageRef.current.file
            : null;
          if (!compressed) {
            compressed = await compressMomentImage(submittedImage, { signal: controller.signal });
            preparedImageRef.current = { source: submittedImage, file: compressed };
          }
          const uploaded = await uploadImageFile(compressed, {
            signal: controller.signal,
            purpose: "MOMENT_COMMENT",
            clientNormalized: true,
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
      resetPublicInviteConfirmation();
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
    contentEditorRef.current?.insertReference(markdown);
  };

  return (
    <form onSubmit={(event) => void handleSubmit(submit)(event)} className="rounded-2xl bg-background/95 p-3 backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>{replyTarget ? `回复 ${replyTarget.username}` : "发表评论"}</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => { onCancelReply(); setExpanded(false); }}
          className="rounded-md p-1 hover:bg-muted disabled:opacity-50"
          aria-label="收起评论框"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <Controller
        control={control}
        name="content"
        render={({ field }) => (
          <InternalReferenceEditor
            ref={contentEditorRef}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            maxLength={500}
            ariaLabel={replyTarget ? `回复 ${replyTarget.username}` : "评论内容"}
            ariaInvalid={!!errors.content}
            placeholder={replyTarget ? `回复 ${replyTarget.username}` : "说说你的想法"}
            className="min-h-16 max-h-32 border-transparent bg-muted/70"
            disabled={pending}
            onLimitExceeded={() => setError("content", { message: "评论最多 500 个字" })}
          />
        )}
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
        <ImageUploadProgress progress={uploadProgress} onCancel={clearMedia} className="mt-2" compact />
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
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => imageInputRef.current?.click()}>
            <ImagePlus className="size-4" />图片
          </Button>
          <StickerPickerPopover disabled={pending} label="表情包" onSelect={selectSticker} />
          <InternalReferenceInsert
            disabled={pending}
            getSuggestedLabel={() => contentEditorRef.current?.getSelectedText() ?? ""}
            onInsert={insertReference}
            className="text-muted-foreground"
          />
          <span className="hidden text-xs text-muted-foreground sm:inline">
            限 1 张图片或表情 · {contentLength}/500
          </span>
        </div>
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="shrink-0 text-brand-strong"
          pending={pending}
          pendingLabel={pendingLabel}
        >
          发送
        </Button>
      </div>
      {errors.content?.message ? <p className="mt-1 px-1 text-xs text-destructive">{errors.content.message}</p> : null}
    </form>
  );
}
