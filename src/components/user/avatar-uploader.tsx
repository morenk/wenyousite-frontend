/** 头像上传器：选择图片 → react-easy-crop 1:1 裁剪 → 512×512 webp 上传 → PATCH/DELETE /me/avatar */

"use client";

import { useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSetAvatar } from "@/api/hooks/use-set-avatar";
import { getApiErrorMessage } from "@/api/errors";
import { ImageUploadProgress } from "@/components/shared/image-upload-progress";
import {
  getImageUrlBySize,
  isUploadAbortError,
  uploadImageFile,
  validateAvatarFile,
  type UploadImageProgress as UploadImageProgressValue,
} from "@/lib/upload-image";
import { getCroppedBlob } from "@/lib/avatar-crop";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog";

interface AvatarUploaderProps {
  username: string;
  avatar: string | null;
}

export function AvatarUploader({ username, avatar }: AvatarUploaderProps) {
  const { setAvatar, removeAvatar } = useSetAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const preparedAvatarRef = useRef<File | null>(null);
  const uploadedMediaIdRef = useRef<string | null>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | undefined>();
  const [cropOpen, setCropOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadImageProgressValue | null>(null);

  useEffect(() => () => uploadAbortRef.current?.abort(), []);

  const avatarUrl = avatar ? getImageUrlBySize(avatar, "thumb") : null;
  const pending = isUploading || setAvatar.isPending || removeAvatar.isPending;

  const invalidatePreparedAvatar = () => {
    preparedAvatarRef.current = null;
    uploadedMediaIdRef.current = null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const error = validateAvatarFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    setImageSrc(URL.createObjectURL(file));
    invalidatePreparedAvatar();
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(undefined);
    invalidatePreparedAvatar();
    setCropOpen(true);
  };

  const closeCrop = () => {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    setUploadProgress(null);
    setCropOpen(false);
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(null);
    setCroppedArea(undefined);
  };

  const handleConfirm = async () => {
    if (!imageSrc || !croppedArea) return;
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setIsUploading(true);
    try {
      let mediaId = uploadedMediaIdRef.current;
      if (!mediaId) {
        let file = preparedAvatarRef.current;
        if (!file) {
          const blob = await getCroppedBlob(imageSrc, croppedArea);
          file = new File([blob], "avatar.webp", { type: "image/webp" });
          preparedAvatarRef.current = file;
        }
        const uploaded = await uploadImageFile(file, {
          signal: controller.signal,
          onProgress: setUploadProgress,
        });
        mediaId = uploaded.mediaId;
        uploadedMediaIdRef.current = mediaId;
      }
      await setAvatar.mutateAsync(mediaId);
      toast.success("头像已更新");
      closeCrop();
    } catch (err) {
      if (!isUploadAbortError(err)) {
        toast.error(getApiErrorMessage(err, "头像上传失败，请稍后重试"));
      }
    } finally {
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
      setUploadProgress(null);
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    try {
      await removeAvatar.mutateAsync();
      toast.success("头像已移除");
    } catch {
      toast.error("操作失败，请稍后重试");
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={username} className="h-full w-full object-cover" />
        ) : (
          <div
            data-testid="avatar-placeholder"
            className="flex h-full w-full items-center justify-center text-3xl font-bold text-brand-strong"
          >
            {username.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending}
          >
            <Camera className="mr-1.5 h-4 w-4" />
            更换头像
          </Button>
          {avatarUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={pending}
            >
              移除头像
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">支持 jpg/png/webp，裁剪后 512×512</p>
        <input
          data-testid="avatar-file-input"
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <Dialog
        open={cropOpen}
        disablePointerDismissal={isUploading}
        onOpenChange={(open) => {
          if (!open && !isUploading) closeCrop();
        }}
      >
        {imageSrc ? (
          <DialogPortal>
            <DialogBackdrop />
            <DialogViewport>
              <DialogPopup className="max-w-md p-4">
                <DialogTitle>裁剪头像</DialogTitle>
                <DialogDescription className="sr-only">
                  移动画面并调整缩放，使头像主体位于正方形裁剪区域内。
                </DialogDescription>
                <div className="relative mt-3 h-64 overflow-hidden rounded-lg bg-foreground">
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={(nextCrop) => {
                      invalidatePreparedAvatar();
                      setCrop(nextCrop);
                    }}
                    onZoomChange={(nextZoom) => {
                      invalidatePreparedAvatar();
                      setZoom(nextZoom);
                    }}
                    onCropComplete={(_area, areaPixels) => setCroppedArea(areaPixels)}
                  />
                </div>
                <div className="mt-3">
                  <label htmlFor="crop-zoom" className="mb-1 block text-xs text-muted-foreground">
                    缩放
                  </label>
                  <input
                    id="crop-zoom"
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={(event) => {
                      invalidatePreparedAvatar();
                      setZoom(Number(event.target.value));
                    }}
                    className="w-full accent-brand-strong"
                  />
                </div>
                {uploadProgress ? (
                  <ImageUploadProgress
                    progress={uploadProgress}
                    onCancel={() => uploadAbortRef.current?.abort()}
                    className="mt-3"
                    compact
                  />
                ) : null}
                <DialogFooter className="mt-4">
                  <DialogClose
                    disabled={isUploading}
                    className={buttonVariants({ variant: "ghost" })}
                  >
                    取消
                  </DialogClose>
                  <Button type="button" onClick={handleConfirm} disabled={isUploading}>
                    {isUploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                    保存头像
                  </Button>
                </DialogFooter>
              </DialogPopup>
            </DialogViewport>
          </DialogPortal>
        ) : null}
      </Dialog>
    </div>
  );
}
