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
import { ImageUploadStatus } from "@/components/shared/image-upload-status";
import { useUploadOperation } from "@/hooks/use-upload-operation";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  isUploadAbortError,
  uploadImageFile,
  validateAvatarFile,
  type UploadImageProgress as UploadImageProgressValue,
  type UploadedImage,
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
  onSaveAvatar?: (mediaId: string, uploaded?: UploadedImage) => Promise<unknown>;
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
  const upload = useUploadOperation();
  const preparedAvatarRef = useRef<File | null>(null);
  const uploadedMediaIdRef = useRef<string | null>(null);
  const uploadedImageRef = useRef<UploadedImage | undefined>(undefined);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | undefined>();
  const [cropOpen, setCropOpen] = useState(false);
  const [uploadProgress, setUploadProgress] =
    useState<UploadImageProgressValue | null>(null);

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

  const pending = upload.pending || setAvatar.isPending || removeAvatar.isPending;

  const invalidatePreparedAvatar = () => {
    preparedAvatarRef.current = null;
    uploadedMediaIdRef.current = null;
    uploadedImageRef.current = undefined;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const generation = ++selectionGeneration.current;
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || upload.isPending()) return;
    const error = validateAvatarFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    try {
      await assertImageCanBeProcessed(file, true);
    } catch (error) {
      if (generation !== selectionGeneration.current || upload.isPending()) return;
      toast.error(
        error instanceof Error ? error.message : "无法读取图片，请重新选择",
      );
      return;
    }
    if (generation !== selectionGeneration.current || upload.isPending()) return;
    setFailure(null);
    setImageSrc(URL.createObjectURL(file));
    invalidatePreparedAvatar();
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(undefined);
    setCropOpen(true);
  };

  const closeCrop = () => {
    selectionGeneration.current++;
    upload.cancel();
    setUploadProgress(null);
    setCropOpen(false);
    requestAnimationFrame(() => chooseButtonRef.current?.focus());
    setImageSrc(null);
    setCroppedArea(undefined);
  };

  const handleConfirm = async () => {
    if (!imageSrc || !croppedArea || pending) return;
    setFailure(null);
    const operation = upload.start();
    if (!operation) return;
    selectionGeneration.current++;
    try {
      let mediaId = uploadedMediaIdRef.current;
      if (!mediaId) {
        let file = preparedAvatarRef.current;
        if (!file) {
          const blob = await getCroppedBlob(imageSrc, croppedArea);
          if (!operation.isCurrent()) return;
          file = createImageFileFromBlob(blob, "avatar");
          preparedAvatarRef.current = file;
        }
        operation.setPhase("uploading");
        const uploaded = await uploadImageFile(file, {
          signal: operation.signal,
          onProgress: (progress) => { if (operation.isCurrent()) setUploadProgress(progress); },
          purpose: "AVATAR",
          clientNormalized: true,
        });
        if (!operation.isCurrent()) return;
        mediaId = uploaded.mediaId;
        uploadedMediaIdRef.current = mediaId;
        uploadedImageRef.current = uploaded;
      }
      if (!operation.isCurrent()) return;
      operation.setPhase("saving");
      setUploadProgress(null);
      await (onSaveAvatar ? onSaveAvatar(mediaId, uploadedImageRef.current) : setAvatar.mutateAsync(mediaId));
      if (!operation.isCurrent()) return;
      toast.success("头像已更新");
      closeCrop();
      onClose?.();
    } catch (err) {
      if (operation.isCurrent() && !isUploadAbortError(err)) {
        setFailure(getApiErrorMessage(err, "头像上传失败，请稍后重试"));
      }
    } finally {
      if (operation.isCurrent()) setUploadProgress(null);
      operation.finish();
    }
  };

  const handleRemove = async () => {
    if (pending) return;
    setFailure(null);
    const operation = upload.start("saving");
    if (!operation) return;
    selectionGeneration.current++;
    try {
      await (onRemoveAvatar ? onRemoveAvatar() : removeAvatar.mutateAsync());
      if (!operation.isCurrent()) return;
      toast.success("头像已移除");
      onClose?.();
    } catch {
      if (operation.isCurrent()) setFailure("操作失败，请稍后重试");
    } finally {
      operation.finish();
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
                if (upload.isPending()) return;
                invalidatePreparedAvatar();
                setCrop(nextCrop);
              }}
              onZoomChange={(nextZoom) => {
                if (upload.isPending()) return;
                invalidatePreparedAvatar();
                setZoom(nextZoom);
              }}
              onCropComplete={(_area, areaPixels) => { if (!upload.isPending()) setCroppedArea(areaPixels); }}
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
                if (upload.isPending()) return;
                invalidatePreparedAvatar();
                setZoom(Number(event.target.value));
              }}
              disabled={pending}
              className="w-full accent-brand-strong"
            />
          </div>
          <ImageUploadStatus
            phase={upload.phase}
            progress={uploadProgress}
            onCancel={() => { if (upload.cancel()) setUploadProgress(null); }}
            className="mt-3"
          />

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
