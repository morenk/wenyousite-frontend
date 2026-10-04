/** 头像上传器：选择图片 → react-easy-crop 1:1 裁剪 → 512×512 webp 上传 → PATCH/DELETE /me/avatar */

"use client";

import type { MediaDisplay } from "@/lib/media-display";
import { useEffect, useRef, useState } from "react";
import { assertImageCanBeProcessed } from "@/lib/image-container";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
import { Button } from "@/components/ui/button";
import { SettingsDialog, type SettingsDialogProps } from "./settings-controls";
import { useConfirm } from "@/components/ui/confirm-provider";
import { DialogFooter } from "@/components/ui/dialog";

interface AvatarUploaderProps extends Pick<
  SettingsDialogProps,
  "onClose" | "returnFocus"
> {
  username: string;
  avatar: string | null;
  avatarDisplay?: MediaDisplay | null;
  /** 帖内头像复用裁剪链路，保存权属交给调用方。 */
  onSaveAvatar?: (mediaId: string) => Promise<unknown>;
  onRemoveAvatar?: () => Promise<unknown>;
  title?: string;
}

export function AvatarUploader({
  username,
  avatar,
  avatarDisplay,
  onSaveAvatar,
  onRemoveAvatar,
  title = "头像",
  onClose,
  returnFocus,
}: AvatarUploaderProps) {
  const confirm = useConfirm();
  const [failure, setFailure] = useState<string | null>(null);
  const { setAvatar, removeAvatar } = useSetAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chooseButtonRef = useRef<HTMLButtonElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const preparedAvatarRef = useRef<File | null>(null);
  const uploadedMediaIdRef = useRef<string | null>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | undefined>();
  const [cropOpen, setCropOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [uploadProgress, setUploadProgress] =
    useState<UploadImageProgressValue | null>(null);

  useEffect(() => () => uploadAbortRef.current?.abort(), []);
  useEffect(
    () => () => {
      if (imageSrc) URL.revokeObjectURL(imageSrc);
    },
    [imageSrc],
  );

  const selectionGeneration = useRef(0);
  useEffect(
    () => () => {
      selectionGeneration.current++;
    },
    [],
  );

  const pending = isUploading || isRemoving || setAvatar.isPending || removeAvatar.isPending;

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
      toast.error(
        error instanceof Error ? error.message : "无法读取图片，请重新选择",
      );
      return;
    }
    if (generation !== selectionGeneration.current) return;
    setFailure(null);
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
    requestAnimationFrame(() => chooseButtonRef.current?.focus());
    setImageSrc(null);
    setCroppedArea(undefined);
  };

  const handleConfirm = async () => {
    if (!imageSrc || !croppedArea || pending) return;
    setFailure(null);
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
      await (onSaveAvatar ? onSaveAvatar(mediaId) : setAvatar.mutateAsync(mediaId));
      toast.success("头像已更新");
      closeCrop();
      onClose?.();
    } catch (err) {
      if (!isUploadAbortError(err)) {
        setFailure(getApiErrorMessage(err, "头像上传失败，请稍后重试"));
      }
    } finally {
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
      setUploadProgress(null);
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (pending) return;
    setFailure(null);
    setIsRemoving(true);
    try {
      await (onRemoveAvatar ? onRemoveAvatar() : removeAvatar.mutateAsync());
      toast.success("头像已移除");
      onClose?.();
    } catch {
      setFailure("操作失败，请稍后重试");
    } finally {
      setIsRemoving(false);
    }
  };

  const discardCrop = async () => {
    if (
      !pending &&
      (await confirm({
        title: "放弃未保存修改",
        description: "当前裁剪尚未保存，确定要放弃吗？",
        confirmLabel: "放弃修改",
        cancelLabel: "继续编辑",
        destructive: true,
      }))
    )
      closeCrop();
  };

  return (
    <SettingsDialog
      title={cropOpen ? "裁剪头像" : title}
      onClose={onClose}
      returnFocus={returnFocus}
      dirty={cropOpen}
      busy={pending}
    >
      <input
        data-testid="avatar-file-input"
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      {cropOpen && imageSrc ? (
        <>
          <div
            className={cn(
              "relative mt-3 h-64 overflow-hidden rounded-[var(--radius-control)] bg-foreground",
              pending && "pointer-events-none",
            )}
          >
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
            <label
              htmlFor="crop-zoom"
              className="mb-1 block text-xs text-muted-foreground"
            >
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
              disabled={pending}
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

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => void discardCrop()}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              pending={pending}
              disabled={!croppedArea}
              pendingLabel="保存中"
            >
              保存头像
            </Button>
          </DialogFooter>
        </>
      ) : (
        <>
          <UserAvatar
            name={username}
            src={avatar}
            display={avatarDisplay}
            className="mx-auto size-24"
            textClassName="text-2xl"
          />
          <DialogFooter className="mt-6">
            {avatar ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto"
                onClick={handleRemove}
                disabled={pending}
              >
                移除头像
              </Button>
            ) : null}
            <Button
              ref={chooseButtonRef}
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={pending}
            >
              {avatar ? "更换头像" : "上传头像"}
            </Button>
          </DialogFooter>
        </>
      )}
      {failure ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {failure}
        </p>
      ) : null}
    </SettingsDialog>
  );
}
