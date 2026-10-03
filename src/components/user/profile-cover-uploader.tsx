/** 主页背景上传器：同一原图分别裁剪 Web 3:1 与移动端 2:1 画幅后原子绑定。 */

"use client";

import type { MediaDisplay } from "@/lib/media-display";
import { useEffect, useRef, useState } from "react";
import { assertImageCanBeProcessed } from "@/lib/image-container";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSetProfileCover } from "@/api/hooks/use-set-profile-cover";
import { getApiErrorMessage } from "@/api/errors";
import { ImageUploadProgress } from "@/components/shared/image-upload-progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SettingsDialog, type SettingsDialogProps } from "./settings-controls";
import { useConfirm } from "@/components/ui/confirm-provider";
import { DialogFooter } from "@/components/ui/dialog";
import {
  ProfileCover,
  type ProfileCoverMedia,
} from "@/components/user/profile-cover";
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
import { createImageFileFromBlob } from "@/lib/image-file";

interface ProfileCoverUploaderProps extends Pick<
  SettingsDialogProps,
  "onClose" | "returnFocus"
> {
  username: string;
  avatar: string | null;
  avatarDisplay?: MediaDisplay | null;
  profileCover: ProfileCoverMedia | null;
}

interface CropPoint {
  x: number;
  y: number;
}

const SURFACES = [
  "web",
  "mobile",
] as const satisfies readonly ProfileCoverSurface[];
const INITIAL_CROPS: Record<ProfileCoverSurface, CropPoint> = {
  web: { x: 0, y: 0 },
  mobile: { x: 0, y: 0 },
};
const INITIAL_ZOOMS: Record<ProfileCoverSurface, number> = {
  web: 1,
  mobile: 1,
};

export function ProfileCoverUploader({
  username,
  profileCover,
  onClose,
  returnFocus,
}: ProfileCoverUploaderProps) {
  const confirm = useConfirm();
  const [failure, setFailure] = useState<string | null>(null);
  const { setProfileCover, removeProfileCover } = useSetProfileCover();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chooseButtonRef = useRef<HTMLButtonElement>(null);
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
  const [activeSurface, setActiveSurface] =
    useState<ProfileCoverSurface | null>(null);
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

  const pending =
    isUploading || setProfileCover.isPending || removeProfileCover.isPending;
  const mobilePreviewCover = profileCover?.mobile ?? profileCover;

  const invalidateUploadedSurface = (surface: ProfileCoverSurface) => {
    preparedFilesRef.current.delete(surface);
    setPendingMediaIds((current) => {
      if (!current[surface]) return current;
      return { ...current, [surface]: undefined };
    });
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const generation = ++selectionGeneration.current;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const validationError = validateProfileCoverFile(file);
    if (validationError) {
      toast.error(validationError);
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
    setCrops(INITIAL_CROPS);
    setZooms(INITIAL_ZOOMS);
    setCroppedAreas({});
    setPendingMediaIds({});
    preparedFilesRef.current.clear();
    setCropOpen(true);
  };

  const closeCrop = () => {
    selectionGeneration.current++;
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    setUploadProgress(null);
    setActiveSurface(null);
    setCropOpen(false);
    requestAnimationFrame(() => chooseButtonRef.current?.focus());
    setImageSrc(null);
    setCroppedAreas({});
    setPendingMediaIds({});
    preparedFilesRef.current.clear();
  };

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreas.web || !croppedAreas.mobile || pending)
      return;
    setFailure(null);
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setIsUploading(true);

    try {
      const mediaIds: Partial<Record<ProfileCoverSurface, string>> = {
        ...pendingMediaIds,
      };
      const files = new Map<ProfileCoverSurface, File>();
      setActiveSurface("web");
      setUploadProgress(null);
      await Promise.all(
        SURFACES.map(async (surface) => {
          const spec = PROFILE_COVER_SPECS[surface];
          let file = preparedFilesRef.current.get(surface);
          if (!file) {
            const blob = await getCroppedProfileCoverBlob(
              imageSrc,
              croppedAreas[surface]!,
              surface,
            );
            file = createImageFileFromBlob(blob, spec.filenameStem);
            preparedFilesRef.current.set(surface, file);
          }
          files.set(surface, file);
        }),
      );

      const progressBySurface = new Map<
        ProfileCoverSurface,
        UploadImageProgressValue
      >();
      const uploadSurfaces = SURFACES.filter((surface) => !mediaIds[surface]);
      await Promise.all(
        uploadSurfaces.map(async (surface) => {
          const file = files.get(surface)!;
          const { mediaId } = await uploadImageFile(file, {
            signal: controller.signal,
            purpose: "PROFILE_COVER",
            clientNormalized: true,
            onProgress: (progress) => {
              progressBySurface.set(surface, progress);
              const values = uploadSurfaces.map((item) =>
                progressBySurface.get(item),
              );
              const totalBytes = uploadSurfaces.reduce(
                (total, item) => total + files.get(item)!.size,
                0,
              );
              const loadedBytes = uploadSurfaces.reduce(
                (total, item) =>
                  total + (progressBySurface.get(item)?.loadedBytes ?? 0),
                0,
              );
              setUploadProgress({
                stage: values.every((value) => value?.stage === "processing")
                  ? "processing"
                  : values.some((value) => value?.stage === "uploading")
                    ? "uploading"
                    : "preparing",
                loadedBytes: values.every(
                  (value) => value?.loadedBytes === null,
                )
                  ? null
                  : loadedBytes,
                totalBytes: values.every((value) => value?.totalBytes === null)
                  ? null
                  : totalBytes,
                percent:
                  totalBytes > 0
                    ? Math.round((loadedBytes / totalBytes) * 100)
                    : null,
              });
            },
          });
          mediaIds[surface] = mediaId;
          setPendingMediaIds((current) => ({ ...current, [surface]: mediaId }));
        }),
      );

      setActiveSurface(null);
      setUploadProgress(null);
      await setProfileCover.mutateAsync({
        mediaId: mediaIds.web!,
        mobileMediaId: mediaIds.mobile!,
      });
      toast.success("主页背景已更新");
      closeCrop();
      onClose?.();
    } catch (error) {
      if (!isUploadAbortError(error)) {
        setFailure(getApiErrorMessage(error, "主页背景上传失败，请稍后重试"));
      }
    } finally {
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
      setUploadProgress(null);
      setActiveSurface(null);
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (pending) return;
    setFailure(null);
    try {
      await removeProfileCover.mutateAsync();
      toast.success("主页背景已移除");
      onClose?.();
    } catch (error) {
      setFailure(getApiErrorMessage(error, "主页背景移除失败，请稍后重试"));
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
      title={cropOpen ? "调整主页背景" : "主页背景"}
      onClose={onClose}
      returnFocus={returnFocus}
      dirty={cropOpen}
      busy={pending}
      wide
    >
      <input
        ref={fileInputRef}
        data-testid="profile-cover-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      {cropOpen && imageSrc ? (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {SURFACES.map((surface) => {
              const spec = PROFILE_COVER_SPECS[surface];
              return (
                <section
                  key={surface}
                  aria-labelledby={`profile-cover-${surface}-crop-title`}
                  className="min-w-0"
                >
                  <h3
                    id={`profile-cover-${surface}-crop-title`}
                    className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"
                  >
                    {spec.label}画幅
                  </h3>
                  <div
                    className={`relative overflow-hidden rounded-[var(--radius-compact)] bg-foreground ${
                      surface === "web" ? "aspect-3/1" : "aspect-2/1"
                    } ${isUploading ? "pointer-events-none" : ""}`}
                  >
                    <Cropper
                      image={imageSrc}
                      crop={crops[surface]}
                      zoom={zooms[surface]}
                      aspect={spec.aspect}
                      onInteractionStart={() =>
                        invalidateUploadedSurface(surface)
                      }
                      onCropChange={(nextCrop) => {
                        setCrops((current) => ({
                          ...current,
                          [surface]: nextCrop,
                        }));
                      }}
                      onZoomChange={(nextZoom) => {
                        setZooms((current) => ({
                          ...current,
                          [surface]: nextZoom,
                        }));
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
                label="正在上传主页背景"
                onCancel={() => uploadAbortRef.current?.abort()}
                className="mt-4"
                compact
              />
            ) : (
              <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-compact)] bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin text-brand-strong" />
                正在准备主页背景…
              </div>
            )
          ) : setProfileCover.isPending ? (
            <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-compact)] bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-brand-strong" />
              正在保存主页背景…
            </div>
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
              disabled={!croppedAreas.web || !croppedAreas.mobile}
              pendingLabel="保存中"
            >
              保存背景
            </Button>
          </DialogFooter>
        </>
      ) : (
        <>
          <Tabs defaultValue="web">
            <TabsList aria-label="背景预览画幅" className="mb-4">
              <TabsTrigger value="web">电脑端 · 3:1</TabsTrigger>
              <TabsTrigger value="mobile">移动端 · 2:1</TabsTrigger>
            </TabsList>
            <TabsContent value="web">
              <ProfileCover
                cover={profileCover}
                username={username}
                className="rounded-[var(--radius-compact)]"
              />
            </TabsContent>
            <TabsContent value="mobile" className="mx-auto max-w-narrow">
              <ProfileCover
                cover={mobilePreviewCover}
                username={username}
                surface="mobile"
                className="rounded-[var(--radius-compact)]"
              />
              {profileCover && !profileCover.mobile ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  沿用电脑端背景
                </p>
              ) : null}
            </TabsContent>
          </Tabs>
          <DialogFooter className="mt-6">
            {profileCover ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto"
                onClick={handleRemove}
                disabled={pending}
              >
                移除背景
              </Button>
            ) : null}
            <Button
              ref={chooseButtonRef}
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={pending}
            >
              {profileCover ? "更换背景" : "上传背景"}
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
