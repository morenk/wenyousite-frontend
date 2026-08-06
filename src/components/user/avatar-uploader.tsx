/** 头像上传器：选择图片 → react-easy-crop 1:1 裁剪 → 512×512 webp 上传 → PATCH/DELETE /me/avatar */

"use client";

import { useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSetAvatar } from "@/api/hooks/use-set-avatar";
import { getApiErrorMessage } from "@/api/errors";
import { getImageUrlBySize, uploadImageFile, validateAvatarFile } from "@/lib/upload-image";
import { getCroppedBlob } from "@/lib/avatar-crop";
import { Button } from "@/components/ui/button";

interface AvatarUploaderProps {
  username: string;
  avatar: string | null;
}

export function AvatarUploader({ username, avatar }: AvatarUploaderProps) {
  const { setAvatar, removeAvatar } = useSetAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | undefined>();
  const [cropOpen, setCropOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const avatarUrl = avatar ? getImageUrlBySize(avatar, "thumb") : null;
  const pending = isUploading || setAvatar.isPending || removeAvatar.isPending;

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
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(undefined);
    setCropOpen(true);
  };

  const closeCrop = () => {
    setCropOpen(false);
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(null);
    setCroppedArea(undefined);
  };

  const handleConfirm = async () => {
    if (!imageSrc || !croppedArea) return;
    setIsUploading(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedArea);
      const file = new File([blob], "avatar.webp", { type: "image/webp" });
      const { mediaId } = await uploadImageFile(file);
      await setAvatar.mutateAsync(mediaId);
      toast.success("头像已更新");
      closeCrop();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "头像上传失败，请稍后重试"));
    } finally {
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
            className="flex h-full w-full items-center justify-center text-3xl font-bold text-primary"
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

      {cropOpen && imageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-background p-4">
            <h3 className="mb-3 text-base font-semibold">裁剪头像</h3>
            <div className="relative h-64 overflow-hidden rounded-lg bg-black">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
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
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeCrop} disabled={isUploading}>
                取消
              </Button>
              <Button type="button" onClick={handleConfirm} disabled={isUploading}>
                {isUploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                确认
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
