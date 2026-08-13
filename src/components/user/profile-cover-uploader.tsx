/** 主页背景上传器：选择图片 → 3:1 裁剪 → 1920×640 高质量 WebP 上传 → 绑定 mediaId。 */

"use client";

import { useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSetProfileCover } from "@/api/hooks/use-set-profile-cover";
import { getApiErrorMessage } from "@/api/errors";
import { ImageUploadProgress } from "@/components/shared/image-upload-progress";
import { UserAvatar } from "@/components/shared/user-avatar";
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
import { ProfileCover, type ProfileCoverMedia } from "@/components/user/profile-cover";
import { getCroppedProfileCoverBlob } from "@/lib/profile-cover-crop";
import {
  isUploadAbortError,
  uploadImageFile,
  validateProfileCoverFile,
  type UploadImageProgress as UploadImageProgressValue,
} from "@/lib/upload-image";

interface ProfileCoverUploaderProps {
  username: string;
  avatar: string | null;
  profileCover: ProfileCoverMedia | null;
}

export function ProfileCoverUploader({
  username,
  avatar,
  profileCover,
}: ProfileCoverUploaderProps) {
  const { setProfileCover, removeProfileCover } = useSetProfileCover();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area>();
  const [cropOpen, setCropOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadImageProgressValue | null>(null);

  useEffect(() => () => uploadAbortRef.current?.abort(), []);
  useEffect(() => () => {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
  }, [imageSrc]);

  const pending = isUploading || setProfileCover.isPending || removeProfileCover.isPending;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const validationError = validateProfileCoverFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setImageSrc(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(undefined);
    setCropOpen(true);
  };

  const closeCrop = () => {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    setUploadProgress(null);
    setCropOpen(false);
    setImageSrc(null);
    setCroppedArea(undefined);
  };

  const handleConfirm = async () => {
    if (!imageSrc || !croppedArea) return;
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setIsUploading(true);
    try {
      const blob = await getCroppedProfileCoverBlob(imageSrc, croppedArea);
      const file = new File([blob], "profile-cover.webp", { type: "image/webp" });
      const { mediaId } = await uploadImageFile(file, {
        signal: controller.signal,
        onProgress: setUploadProgress,
      });
      await setProfileCover.mutateAsync(mediaId);
      toast.success("主页背景已更新");
      closeCrop();
    } catch (error) {
      if (!isUploadAbortError(error)) {
        toast.error(getApiErrorMessage(error, "主页背景上传失败，请稍后重试"));
      }
    } finally {
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
      setUploadProgress(null);
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    try {
      await removeProfileCover.mutateAsync();
      toast.success("主页背景已移除");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "主页背景移除失败，请稍后重试"));
    }
  };

  return (
    <div>
      <div className="relative mb-10">
        <ProfileCover
          cover={profileCover}
          username={username}
          className="rounded-xl border border-border"
        />
        <UserAvatar
          name={username}
          src={avatar}
          className="absolute -bottom-8 left-5 size-16 ring-4 ring-card outline outline-1 outline-border"
          textClassName="text-xl"
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          支持 jpg/png/webp，上传前可移动和缩放，最终保存为 3:1 高清图
        </p>
        <div className="flex shrink-0 gap-2">
          {profileCover ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={pending}
            >
              <Trash2 className="size-4" />
              移除
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending}
          >
            <ImagePlus className="size-4" />
            {profileCover ? "更换背景" : "上传背景"}
          </Button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        data-testid="profile-cover-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

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
              <DialogPopup className="max-w-2xl p-5">
                <DialogTitle>调整主页背景</DialogTitle>
                <DialogDescription className="mt-1">
                  拖动画面选择展示区域，背景会按 3:1 裁剪。
                </DialogDescription>
                <div className="relative mt-4 aspect-3/1 overflow-hidden rounded-xl bg-foreground">
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={3}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={(_area, areaPixels) => setCroppedArea(areaPixels)}
                  />
                </div>
                <div className="mt-4">
                  <label htmlFor="profile-cover-zoom" className="mb-1 block text-xs text-muted-foreground">
                    缩放
                  </label>
                  <input
                    id="profile-cover-zoom"
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={(event) => setZoom(Number(event.target.value))}
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
                <DialogFooter className="mt-5">
                  <DialogClose
                    disabled={isUploading}
                    className={buttonVariants({ variant: "ghost" })}
                  >
                    取消
                  </DialogClose>
                  <Button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isUploading || !croppedArea}
                  >
                    {isUploading ? <Loader2 className="size-4 animate-spin" /> : null}
                    保存背景
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
