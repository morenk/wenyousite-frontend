/** 头像上传器：选择图片 → react-easy-crop 1:1 裁剪 → 512×512 webp 上传 → PATCH/DELETE /me/avatar */

"use client";

import { useEffect, useRef, useState } from "react";
import { assertImageCanBeProcessed } from "@/lib/image-container";
import Cropper, { type Area } from "react-easy-crop";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSetAvatar } from "@/api/hooks/use-set-avatar";
import { getApiErrorMessage } from "@/api/errors";
import { ImageUploadProgress } from "@/components/shared/image-upload-progress";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  isUploadAbortError,
  uploadImageFile,
  validateAvatarFile,
  type UploadImageProgress as UploadImageProgressValue,
} from "@/lib/upload-image";
import { getCroppedBlob } from "@/lib/avatar-crop";
import { createImageFileFromBlob } from "@/lib/image-file";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
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

  const selectionGeneration = useRef(0);
  useEffect(() => () => { selectionGeneration.current++; }, []);

  const pending = isUploading || setAvatar.isPending || removeAvatar.isPending;

  const invalidatePreparedAvatar = () => {
    preparedAvatarRef.current = null;
    uploadedMediaIdRef.current = null;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const generation = ++selectionGeneration.current;
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const error = validateAvatarFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    try {
      await assertImageCanBeProcessed(file, true);
    } catch (error) {
      if (generation !== selectionGeneration.current) return;
      toast.error(error instanceof Error ? error.message : "无法读取图片，请重新选择");
      return;
    }
    if (generation !== selectionGeneration.current) return;
    setImageSrc(URL.createObjectURL(file));
    invalidatePreparedAvatar();
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(undefined);
    invalidatePreparedAvatar();
    setCropOpen(true);
  };

  const closeCrop = () => {
    selectionGeneration.current++;
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
          file = createImageFileFromBlob(blob, "avatar");
          preparedAvatarRef.current = file;
        }
        const uploaded = await uploadImageFile(file, {
          signal: controller.signal,
          onProgress: setUploadProgress,
          purpose: "AVATAR",
          clientNormalized: true,
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
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <UserAvatar
          name={username}
          src={avatar}
          className="size-16 border border-border bg-muted"
          textClassName="text-2xl"
        />
        <p className="text-sm font-semibold">头像</p>
      </div>

      <div>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending}
          >
            <Camera className="size-4" aria-hidden="true" />
            更换头像
          </Button>
          {avatar ? (
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={handleRemove}
              disabled={pending}
            >
              移除头像
            </Button>
          ) : null}
        </div>
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
                    className={buttonVariants({ variant: "outline" })}
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
