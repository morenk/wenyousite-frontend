/** 主页背景上传器：同一原图分别裁剪 Web 3:1 与移动端 2:1 画幅后原子绑定。 */

"use client";

import { useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { ImagePlus, Loader2, Monitor, Smartphone, Trash2 } from "lucide-react";
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
import {
  getCroppedProfileCoverBlob,
  PROFILE_COVER_SPECS,
  type ProfileCoverSurface,
} from "@/lib/profile-cover-crop";
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

interface CropPoint {
  x: number;
  y: number;
}

const SURFACES = ["web", "mobile"] as const satisfies readonly ProfileCoverSurface[];
const INITIAL_CROPS: Record<ProfileCoverSurface, CropPoint> = {
  web: { x: 0, y: 0 },
  mobile: { x: 0, y: 0 },
};
const INITIAL_ZOOMS: Record<ProfileCoverSurface, number> = { web: 1, mobile: 1 };

export function ProfileCoverUploader({
  username,
  avatar,
  profileCover,
}: ProfileCoverUploaderProps) {
  const { setProfileCover, removeProfileCover } = useSetProfileCover();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const preparedFilesRef = useRef(new Map<ProfileCoverSurface, File>());
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crops, setCrops] = useState(INITIAL_CROPS);
  const [zooms, setZooms] = useState(INITIAL_ZOOMS);
  const [croppedAreas, setCroppedAreas] = useState<
    Partial<Record<ProfileCoverSurface, Area>>
  >({});
  const [pendingMediaIds, setPendingMediaIds] = useState<
    Partial<Record<ProfileCoverSurface, string>>
  >({});
  const [cropOpen, setCropOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeSurface, setActiveSurface] = useState<ProfileCoverSurface | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadImageProgressValue | null>(null);

  useEffect(() => () => uploadAbortRef.current?.abort(), []);
  useEffect(
    () => () => {
      if (imageSrc) URL.revokeObjectURL(imageSrc);
    },
    [imageSrc],
  );

  const pending = isUploading || setProfileCover.isPending || removeProfileCover.isPending;
  const mobilePreviewCover = profileCover?.mobile ?? profileCover;

  const invalidateUploadedSurface = (surface: ProfileCoverSurface) => {
    preparedFilesRef.current.delete(surface);
    setPendingMediaIds((current) => {
      if (!current[surface]) return current;
      return { ...current, [surface]: undefined };
    });
  };

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
    setCrops(INITIAL_CROPS);
    setZooms(INITIAL_ZOOMS);
    setCroppedAreas({});
    setPendingMediaIds({});
    preparedFilesRef.current.clear();
    setCropOpen(true);
  };

  const closeCrop = () => {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    setUploadProgress(null);
    setActiveSurface(null);
    setCropOpen(false);
    setImageSrc(null);
    setCroppedAreas({});
    setPendingMediaIds({});
    preparedFilesRef.current.clear();
  };

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreas.web || !croppedAreas.mobile) return;
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setIsUploading(true);

    let webMediaId = pendingMediaIds.web;
    let mobileMediaId = pendingMediaIds.mobile;

    try {
      for (const surface of SURFACES) {
        const existingMediaId = surface === "web" ? webMediaId : mobileMediaId;
        if (existingMediaId) continue;

        setActiveSurface(surface);
        setUploadProgress(null);
        const spec = PROFILE_COVER_SPECS[surface];
        let file = preparedFilesRef.current.get(surface);
        if (!file) {
          const blob = await getCroppedProfileCoverBlob(imageSrc, croppedAreas[surface]!, surface);
          file = new File([blob], spec.filename, { type: "image/webp" });
          preparedFilesRef.current.set(surface, file);
        }
        const { mediaId } = await uploadImageFile(file, {
          signal: controller.signal,
          onProgress: setUploadProgress,
        });
        setPendingMediaIds((current) => ({ ...current, [surface]: mediaId }));
        if (surface === "web") webMediaId = mediaId;
        else mobileMediaId = mediaId;
      }

      setActiveSurface(null);
      setUploadProgress(null);
      await setProfileCover.mutateAsync({
        mediaId: webMediaId!,
        mobileMediaId: mobileMediaId!,
      });
      toast.success("电脑端与移动端背景已更新");
      closeCrop();
    } catch (error) {
      if (!isUploadAbortError(error)) {
        toast.error(getApiErrorMessage(error, "主页背景上传失败，请稍后重试"));
      }
    } finally {
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
      setUploadProgress(null);
      setActiveSurface(null);
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    try {
      await removeProfileCover.mutateAsync();
      toast.success("电脑端与移动端背景已移除");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "主页背景移除失败，请稍后重试"));
    }
  };

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="profile-cover-web-preview">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p
              id="profile-cover-web-preview"
              className="flex items-center gap-1.5 text-xs font-medium text-foreground"
            >
              <Monitor className="size-3.5 text-brand-strong" aria-hidden="true" />
              电脑端 · 3:1
            </p>
            <span className="font-utility text-[11px] text-muted-foreground">1920 × 640</span>
          </div>
          <div className="relative mb-9">
            <ProfileCover
              cover={profileCover}
              username={username}
              className="rounded-xl border border-border"
            />
            <UserAvatar
              name={username}
              src={avatar}
              className="absolute -bottom-7 left-4 size-14 ring-4 ring-card outline outline-1 outline-border"
              textClassName="text-lg"
            />
          </div>
        </section>

        <section aria-labelledby="profile-cover-mobile-preview">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p
              id="profile-cover-mobile-preview"
              className="flex items-center gap-1.5 text-xs font-medium text-foreground"
            >
              <Smartphone className="size-3.5 text-brand-strong" aria-hidden="true" />
              移动端 · 2:1
            </p>
            <span className="font-utility text-[11px] text-muted-foreground">1600 × 800</span>
          </div>
          <ProfileCover
            cover={mobilePreviewCover}
            username={username}
            surface="mobile"
            className="rounded-xl border border-border"
          />
          {profileCover && !profileCover.mobile ? (
            <p className="mt-1.5 text-[11px] text-muted-foreground">当前暂用电脑端背景兜底</p>
          ) : null}
        </section>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="max-w-md text-xs leading-5 text-muted-foreground">
          选择一张 jpg/png/webp，分别调整两个展示画幅；保存后不保留原图，再次调整需重新选择。
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
              移除两端背景
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
              <DialogPopup className="max-w-5xl p-5 sm:p-6">
                <DialogTitle>为两个展示端分别取景</DialogTitle>
                <DialogDescription className="mt-1">
                  两个取景框使用同一张原图，可以独立拖动和缩放。保存时会一起更新。
                </DialogDescription>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {SURFACES.map((surface) => {
                    const spec = PROFILE_COVER_SPECS[surface];
                    const Icon = surface === "web" ? Monitor : Smartphone;
                    return (
                      <section
                        key={surface}
                        aria-labelledby={`profile-cover-${surface}-crop-title`}
                        className="rounded-2xl border border-border bg-muted/35 p-3"
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <h3
                              id={`profile-cover-${surface}-crop-title`}
                              className="flex items-center gap-2 text-sm font-semibold text-foreground"
                            >
                              <Icon className="size-4 text-brand-strong" aria-hidden="true" />
                              {spec.label}画幅
                            </h3>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {spec.aspect}:1 · {spec.width} × {spec.height}
                            </p>
                          </div>
                          <span className="rounded-full bg-accent px-2 py-1 font-utility text-[10px] font-semibold text-accent-foreground">
                            {surface === "web" ? "宽屏主页" : "紧凑头部"}
                          </span>
                        </div>
                        <div
                          className={`relative overflow-hidden rounded-xl bg-foreground ${
                            surface === "web" ? "aspect-3/1" : "aspect-2/1"
                          } ${isUploading ? "pointer-events-none" : ""}`}
                        >
                          <Cropper
                            image={imageSrc}
                            crop={crops[surface]}
                            zoom={zooms[surface]}
                            aspect={spec.aspect}
                            onInteractionStart={() => invalidateUploadedSurface(surface)}
                            onCropChange={(nextCrop) => {
                              setCrops((current) => ({ ...current, [surface]: nextCrop }));
                            }}
                            onZoomChange={(nextZoom) => {
                              setZooms((current) => ({ ...current, [surface]: nextZoom }));
                            }}
                            onCropComplete={(_area, areaPixels) =>
                              setCroppedAreas((current) => ({
                                ...current,
                                [surface]: areaPixels,
                              }))
                            }
                          />
                        </div>
                        <div className="mt-3">
                          <label
                            htmlFor={`profile-cover-${surface}-zoom`}
                            className="mb-1 block text-xs text-muted-foreground"
                          >
                            {spec.label}缩放
                          </label>
                          <input
                            id={`profile-cover-${surface}-zoom`}
                            type="range"
                            min={1}
                            max={3}
                            step={0.01}
                            value={zooms[surface]}
                            disabled={isUploading}
                            onChange={(event) => {
                              invalidateUploadedSurface(surface);
                              setZooms((current) => ({
                                ...current,
                                [surface]: Number(event.target.value),
                              }));
                            }}
                            className="w-full accent-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </div>
                      </section>
                    );
                  })}
                </div>

                {activeSurface ? (
                  uploadProgress ? (
                    <ImageUploadProgress
                      progress={uploadProgress}
                      label={`正在上传${PROFILE_COVER_SPECS[activeSurface].label}画幅（${
                        activeSurface === "web" ? "1/2" : "2/2"
                      }）`}
                      onCancel={() => uploadAbortRef.current?.abort()}
                      className="mt-4"
                      compact
                    />
                  ) : (
                    <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin text-brand-strong" />
                      正在生成{PROFILE_COVER_SPECS[activeSurface].label}画幅…
                    </div>
                  )
                ) : setProfileCover.isPending ? (
                  <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin text-brand-strong" />
                    两张图片已上传，正在一起保存…
                  </div>
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
                    disabled={isUploading || !croppedAreas.web || !croppedAreas.mobile}
                  >
                    {isUploading ? <Loader2 className="size-4 animate-spin" /> : null}
                    {isUploading ? "正在保存" : "保存两端背景"}
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
