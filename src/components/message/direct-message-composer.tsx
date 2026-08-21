"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImageUploadProgress } from "@/components/shared/image-upload-progress";
import { getApiErrorMessage } from "@/api/errors";
import {
  isUploadAbortError,
  uploadImageFile,
  validateImageFile,
  type UploadedImage,
  type UploadImageProgress as UploadImageProgressValue,
} from "@/lib/upload-image";
import { normalizeDirectMessageContent } from "@/lib/direct-message-content";
import {
  insertTextAtSelection,
  resolveInternalReferencePaste,
} from "@/lib/internal-reference";
import { StickerPickerPopover } from "@/components/sticker/sticker-picker-popover";
import type { DirectMessageSendInput } from "@/lib/direct-message";
import type { UserSticker } from "@/api/hooks/use-stickers";

export type DirectMessageComposerValue = DirectMessageSendInput;

interface DirectMessageComposerProps {
  onSend: (value: DirectMessageComposerValue) => Promise<unknown>;
  submitLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  requestHint?: boolean | string;
}

export function DirectMessageComposer({
  onSend,
  submitLabel = "发送",
  placeholder = "输入消息…",
  disabled = false,
  requestHint = false,
}: DirectMessageComposerProps) {
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const uploadedImageRef = useRef<{ file: File; uploaded: UploadedImage } | null>(null);
  const restoreFocusRef = useRef(false);
  const [uploadProgress, setUploadProgress] = useState<UploadImageProgressValue | null>(null);

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (isSending || disabled || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    textareaRef.current?.focus();
  }, [disabled, isSending]);

  const clearImage = () => {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    setUploadProgress(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setImage(null);
    uploadedImageRef.current = null;
    if (imageInputRef.current) imageInputRef.current.value = "";
    requestIdRef.current = null;
  };

  const handleImage = (file: File | undefined) => {
    if (!file) return;
    const error = validateImageFile(file);
    if (error) {
      toast.error(error);
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImage(file);
    uploadedImageRef.current = null;
    setPreviewUrl(URL.createObjectURL(file));
    requestIdRef.current = null;
  };

  const handleSubmit = async () => {
    if (disabled || isSending) return;
    const normalized = normalizeDirectMessageContent(content);
    if (!normalized && !image) {
      toast.error("请输入消息或选择一张图片");
      return;
    }
    restoreFocusRef.current = true;
    setIsSending(true);
    const submittedContent = content;
    const submittedImage = image;
    const uploadController = image ? new AbortController() : null;
    uploadAbortRef.current = uploadController;
    let clearedForOptimisticSend = false;
    try {
      const uploaded = image
        ? uploadedImageRef.current?.file === image
          ? uploadedImageRef.current.uploaded
          : await uploadImageFile(image, {
              signal: uploadController?.signal,
              onProgress: setUploadProgress,
            }).then((result) => {
              uploadedImageRef.current = { file: image, uploaded: result };
              return result;
            })
        : undefined;
      setUploadProgress(null);
      const sendPromise = onSend({
        ...(normalized ? { content: normalized } : {}),
        ...(uploaded ? { mediaId: uploaded.mediaId } : {}),
        ...(uploaded ? {
          optimisticMedia: {
            id: uploaded.mediaId,
            url: uploaded.url,
            thumbnailUrl: uploaded.thumbnailUrl ?? null,
            mediumUrl: uploaded.mediumUrl ?? null,
            contentType: uploaded.contentType ?? image?.type ?? null,
            width: uploaded.width ?? null,
            height: uploaded.height ?? null,
          },
        } : {}),
        clientRequestId: requestIdRef.current ??= crypto.randomUUID(),
      });
      clearedForOptimisticSend = true;
      setContent("");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setImage(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      await sendPromise;
      requestIdRef.current = null;
      uploadedImageRef.current = null;
    } catch (error) {
      if (clearedForOptimisticSend) {
        setContent(submittedContent);
        if (submittedImage) {
          setImage(submittedImage);
          setPreviewUrl(URL.createObjectURL(submittedImage));
        }
      }
      if (!isUploadAbortError(error)) {
        toast.error(getApiErrorMessage(error, "发送失败，请稍后重试"));
      }
    } finally {
      if (uploadAbortRef.current === uploadController) uploadAbortRef.current = null;
      setUploadProgress(null);
      setIsSending(false);
    }
  };

  const isPending = disabled || isSending;

  const handleSticker = async (sticker: UserSticker) => {
    setIsSending(true);
    try {
      await onSend({
        stickerAssetId: sticker.asset.id,
        clientRequestId: crypto.randomUUID(),
        optimisticSticker: {
          ...sticker.asset,
          mediumUrl: null,
          contentType: null,
        },
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="border-t border-border bg-muted/35 p-4">
      {requestHint && (
        <p className="mb-2 text-xs text-muted-foreground">
          {typeof requestHint === "string"
            ? requestHint
            : "这是首条消息。对方接受前，你不能继续发送。"}
        </p>
      )}
      {previewUrl && (
        <div className="relative mb-3 w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="待发送图片预览"
            className="max-h-32 max-w-52 rounded-lg border border-border object-cover"
          />
          <button
            type="button"
            onClick={clearImage}
            disabled={isPending}
            aria-label="移除图片"
            className="absolute -right-2 -top-2 rounded-full bg-foreground p-1 text-background shadow"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(event) => {
          setContent(event.target.value.slice(0, 1000));
          requestIdRef.current = null;
        }}
        onPaste={(event) => {
          const textarea = event.currentTarget;
          const start = textarea.selectionStart ?? content.length;
          const end = textarea.selectionEnd ?? start;
          const paste = resolveInternalReferencePaste({
            clipboardText: event.clipboardData.getData("text/plain"),
            selectedText: content.slice(start, end),
          });
          if (!paste) return;
          const inserted = insertTextAtSelection(content, paste.serialized, start, end);
          if (inserted.value.length > 1000) {
            event.preventDefault();
            toast.error("消息最多 1000 个字");
            return;
          }
          event.preventDefault();
          setContent(inserted.value);
          requestIdRef.current = null;
          window.requestAnimationFrame(() => {
            textareaRef.current?.setSelectionRange(inserted.cursor, inserted.cursor);
          });
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void handleSubmit();
          }
        }}
        maxLength={1000}
        rows={3}
        disabled={isPending}
        placeholder={placeholder}
        className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-60"
      />
      {uploadProgress ? (
        <ImageUploadProgress
          progress={uploadProgress}
          onCancel={() => uploadAbortRef.current?.abort()}
          className="mt-2"
          compact
        />
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
            className="hidden"
            onChange={(event) => handleImage(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending || !!image}
            onClick={() => imageInputRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" />
            图片
          </Button>
          <StickerPickerPopover
            disabled={isPending}
            onSelect={handleSticker}
          />
          <span className="text-xs text-muted-foreground">
            {content.length}/1000 · 支持传送门与 GIF
          </span>
        </div>
        <Button type="button" onClick={() => void handleSubmit()} disabled={isPending}>
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {uploadProgress?.stage === "uploading" && uploadProgress.percent !== null
            ? `上传 ${uploadProgress.percent}%`
            : submitLabel}
        </Button>
      </div>
      {image && (
        <p className="mt-2 text-xs text-warning">
          {image.type === "image/gif" && "GIF 动图会保留动画效果；"}
          图片将使用可公开访问的链接，请勿发送敏感内容。
        </p>
      )}
    </div>
  );
}
