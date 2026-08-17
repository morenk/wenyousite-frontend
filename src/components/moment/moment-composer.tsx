"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { useCreateMoment } from "@/api/hooks/use-moments";
import { getApiErrorMessage } from "@/api/errors";
import { ImageUploadProgress } from "@/components/shared/image-upload-progress";
import {
  InternalReferenceEditor,
  type InternalReferenceEditorHandle,
} from "@/components/shared/internal-reference-editor";
import { InternalReferenceInsert } from "@/components/shared/internal-reference-insert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogCloseButton,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteMomentDraft, loadMomentDraft, saveMomentDraft } from "@/lib/moment-draft";
import { compressMomentImage, validateMomentImageFile } from "@/lib/moment-image";
import { markMomentFeedReturn } from "@/lib/moment-navigation";
import {
  isUploadAbortError,
  uploadImageFile,
  type UploadImageProgress as UploadImageProgressValue,
} from "@/lib/upload-image";
import { cn } from "@/lib/utils";

const schema = z.object({
  title: z.string().trim().min(2, "标题至少 2 个字").max(40, "标题最多 40 个字"),
  content: z.string().max(1000, "正文最多 1000 个字"),
});

type FormValues = z.infer<typeof schema>;
type LocalImage = { id: string; file: File; previewUrl: string };

interface MomentComposerProps {
  open: boolean;
  userId: string;
  onClose: () => void;
}

export function MomentComposer({ open, userId, onClose }: MomentComposerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const createMoment = useCreateMoment();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentEditorRef = useRef<InternalReferenceEditorHandle>(null);
  const draftReadyRef = useRef(false);
  const quotaWarningRef = useRef(false);
  const composerClosedRef = useRef(!open);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const compressedFilesRef = useRef(new Map<string, File>());
  const publishRef = useRef<{ signature: string; requestId: string; mediaIds: string[] } | null>(null);
  const [images, setImages] = useState<LocalImage[]>([]);
  const [coverFileId, setCoverFileId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [imageUploadProgress, setImageUploadProgress] = useState<UploadImageProgressValue | null>(null);
  const [activeImagePosition, setActiveImagePosition] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", content: "" },
  });
  const title = useWatch({ control, name: "title" });
  const content = useWatch({ control, name: "content" });
  const isPublishing = createMoment.isPending || uploadProgress === "正在发布动态";
  const isUploading = uploadProgress !== null && !isPublishing;
  const pending = isPublishing || isUploading;

  const closeComposer = useCallback(() => {
    if (isPublishing || composerClosedRef.current) return;
    composerClosedRef.current = true;
    const upload = uploadAbortRef.current;
    if (upload && !upload.signal.aborted) {
      upload.abort();
      setUploadProgress(null);
      setImageUploadProgress(null);
      setActiveImagePosition(null);
      toast.info("已取消上传，草稿仍为你保留");
    }
    onClose();
  }, [isPublishing, onClose]);

  useEffect(() => {
    composerClosedRef.current = !open;
    if (!open) uploadAbortRef.current?.abort();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    draftReadyRef.current = false;
    void loadMomentDraft(userId)
      .then((draft) => {
        if (!active) return;
        if (draft) {
          setValue("title", draft.title);
          setValue("content", draft.content);
          const restored = draft.files.map(({ id, file }) => ({ id, file, previewUrl: URL.createObjectURL(file) }));
          setImages(restored);
          setCoverFileId(draft.coverFileId && restored.some((image) => image.id === draft.coverFileId) ? draft.coverFileId : restored[0]?.id ?? null);
        }
        draftReadyRef.current = true;
      })
      .catch(() => {
        draftReadyRef.current = true;
      });
    return () => { active = false; };
  }, [open, setValue, userId]);

  useEffect(() => {
    if (!open || !draftReadyRef.current) return;
    const timeout = window.setTimeout(() => {
      void saveMomentDraft({
        userId,
        title,
        content,
        files: images.map(({ id, file }) => ({ id, file })),
        coverFileId,
        updatedAt: Date.now(),
      }).catch(() => {
        if (quotaWarningRef.current) return;
        quotaWarningRef.current = true;
        toast.warning("浏览器空间不足，图片草稿可能无法恢复；文字内容仍可继续发布");
      });
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [content, coverFileId, images, open, title, userId]);

  useEffect(() => () => {
    uploadAbortRef.current?.abort();
  }, []);

  if (!open) return null;

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files);
    if (images.length + selected.length > 9) {
      toast.error("每条动态最多 9 张图片");
      return;
    }
    for (const file of selected) {
      const error = validateMomentImageFile(file);
      if (error) {
        toast.error(`${file.name}：${error}`);
        return;
      }
    }
    const added = selected.map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) }));
    setImages((current) => [...current, ...added]);
    setCoverFileId((current) => current ?? added[0]?.id ?? null);
    publishRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (id: string) => {
    compressedFilesRef.current.delete(id);
    setImages((current) => {
      const target = current.find((image) => image.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      const next = current.filter((image) => image.id !== id);
      setCoverFileId((cover) => cover === id ? next[0]?.id ?? null : cover);
      return next;
    });
    publishRef.current = null;
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    setImages((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    publishRef.current = null;
  };

  const clearDraft = async () => {
    images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setImages([]);
    setCoverFileId(null);
    compressedFilesRef.current.clear();
    reset({ title: "", content: "" });
    publishRef.current = null;
    await deleteMomentDraft(userId).catch(() => undefined);
    toast.success("草稿已清空");
  };

  const submit = async (values: FormValues) => {
    if (composerClosedRef.current) return;
    const signature = JSON.stringify({
      title: values.title.trim(),
      content: values.content,
      files: images.map((image) => [image.id, image.file.name, image.file.size]),
      coverFileId,
    });
    let request = publishRef.current?.signature === signature ? publishRef.current : null;
    let uploadController: AbortController | null = null;
    try {
      if (!request) {
        const mediaIds: string[] = [];
        if (images.length > 0) {
          uploadController = new AbortController();
          uploadAbortRef.current = uploadController;
        }
        for (let index = 0; index < images.length; index += 1) {
          const position = `第 ${index + 1}/${images.length} 张图片`;
          setActiveImagePosition(position);
          const image = images[index];
          let uploadFile = compressedFilesRef.current.get(image.id);
          if (!uploadFile) {
            setImageUploadProgress(null);
            setUploadProgress(`正在压缩${position}`);
            uploadFile = await compressMomentImage(image.file, {
              signal: uploadController?.signal,
            });
            compressedFilesRef.current.set(image.id, uploadFile);
          }
          const uploaded = await uploadImageFile(uploadFile, {
            signal: uploadController?.signal,
            onStage: (stage) => {
              if (stage === "preparing") setUploadProgress(`正在准备${position}`);
              if (stage === "uploading") setUploadProgress(`正在上传${position}`);
              if (stage === "processing") setUploadProgress(`正在处理${position}`);
            },
            onProgress: (progress) => {
              setImageUploadProgress(progress);
              if (progress.stage === "uploading" && progress.percent !== null) {
                setUploadProgress(`正在上传${position} · ${progress.percent}%`);
              }
            },
          });
          mediaIds.push(uploaded.mediaId);
        }
        if (composerClosedRef.current || uploadController?.signal.aborted) return;
        if (uploadAbortRef.current === uploadController) uploadAbortRef.current = null;
        request = { signature, requestId: crypto.randomUUID(), mediaIds };
        publishRef.current = request;
      }
      if (composerClosedRef.current) return;
      setUploadProgress("正在发布动态");
      const coverIndex = images.findIndex((image) => image.id === coverFileId);
      const created = await createMoment.mutateAsync({
        title: values.title.trim(),
        content: values.content,
        mediaIds: request.mediaIds,
        coverMediaId: coverIndex >= 0 ? request.mediaIds[coverIndex] : null,
        clientRequestId: request.requestId,
      });
      await deleteMomentDraft(userId).catch(() => undefined);
      images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      reset({ title: "", content: "" });
      setImages([]);
      setCoverFileId(null);
      compressedFilesRef.current.clear();
      publishRef.current = null;
      toast.success("动态已发布");
      onClose();
      markMomentFeedReturn(created.id, pathname);
      router.push(`/moments/${created.id}`);
    } catch (error) {
      if (!isUploadAbortError(error)) {
        toast.error(getApiErrorMessage(error, "发布失败，请检查网络后重试"));
      }
    } finally {
      if (uploadAbortRef.current === uploadController) uploadAbortRef.current = null;
      setUploadProgress(null);
      setImageUploadProgress(null);
      setActiveImagePosition(null);
    }
  };

  const selectedCover = images.find((image) => image.id === coverFileId);

  const insertReference = (markdown: string) => {
    contentEditorRef.current?.insertReference(markdown);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeComposer();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogViewport>
          <DialogPopup
            data-slot="moment-composer-shell"
            className="grid h-[min(92dvh,52rem)] max-h-none max-w-5xl grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)] overflow-hidden rounded-3xl border-0 p-0"
          >
        <div className="flex min-h-0 items-center justify-center overflow-hidden bg-muted/55 p-8">
          {selectedCover ? (
            <div className="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element -- 本地 Blob 草稿预览 */}
              <img src={selectedCover.previewUrl} alt="封面预览" className="h-full w-full object-cover" />
              <span className="absolute bottom-3 left-3 rounded-full bg-foreground/60 px-3 py-1 text-xs font-medium text-background">封面预览</span>
            </div>
          ) : (
            <div
              className="moment-text-cover flex aspect-[3/4] w-full max-w-sm items-center rounded-2xl px-9 py-10"
              data-cover-theme="ROSE"
            >
              <p className="line-clamp-5 font-display text-3xl font-medium leading-[1.55] tracking-wide">{title.trim() || "标题会用于文字封面"}</p>
            </div>
          )}
        </div>

        <form data-slot="moment-composer-form" onSubmit={(event) => void handleSubmit(submit)(event)} className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
          <header className="relative z-10 flex items-center justify-between bg-background px-6 py-4">
            <div>
              <DialogTitle className="text-xl">发布动态</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">可发布最多 1000 字或 9 张图片。</DialogDescription>
            </div>
            <DialogCloseButton
              disabled={isPublishing}
              label={isUploading ? "取消上传并关闭发布器" : "关闭发布器"}
            />
          </header>

          <div data-slot="moment-composer-scroll" className="moment-composer-scroll min-h-0 space-y-5 overflow-y-auto overscroll-contain px-6 pb-5">
            <div className="space-y-1.5">
              <Label htmlFor="moment-title">标题</Label>
              <Input id="moment-title" placeholder="写下这条动态想说的事" maxLength={40} aria-invalid={!!errors.title} {...register("title")} />
              <div className="flex justify-between text-xs"><span className="text-destructive">{errors.title?.message}</span><span className="font-utility text-muted-foreground">{Array.from(title).length}/40</span></div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <Label>正文</Label>
                <InternalReferenceInsert
                  disabled={pending}
                  getSuggestedLabel={() => contentEditorRef.current?.getSelectedText() ?? ""}
                  onInsert={insertReference}
                  className="text-muted-foreground"
                />
              </div>
              <Controller
                control={control}
                name="content"
                render={({ field }) => (
                  <InternalReferenceEditor
                    ref={contentEditorRef}
                    id="moment-content"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    maxLength={1000}
                    ariaLabel="正文"
                    ariaInvalid={!!errors.content}
                    placeholder="补充一些细节（可选，可插入站内传送门）"
                    disabled={pending}
                    className="min-h-36 max-h-72"
                    onLimitExceeded={() => toast.error("正文最多 1000 个字")}
                  />
                )}
              />
              <div className="flex justify-between text-xs"><span className="text-destructive">{errors.content?.message}</span><span className="font-utility text-muted-foreground">{Array.from(content).length}/1000</span></div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>图片</Label>
                <span className="font-utility text-xs text-muted-foreground">{images.length}/9</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {images.map((image, index) => (
                  <div key={image.id} className={cn("group relative aspect-[3/4] overflow-hidden rounded-xl bg-muted", coverFileId === image.id && "ring-2 ring-brand-strong ring-offset-2")}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- 本地 Blob 草稿预览 */}
                    <img src={image.previewUrl} alt={`第 ${index + 1} 张图片`} className="h-full w-full object-cover" />
                    <div className="absolute inset-x-1 bottom-1 flex items-center justify-between rounded-lg bg-foreground/60 p-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <Button type="button" variant="ghost" size="icon-compact" className="text-background hover:bg-background/15 hover:text-background" onClick={() => setCoverFileId(image.id)} aria-label="设为封面"><Star className={cn("size-3.5", coverFileId === image.id && "fill-current")} /></Button>
                      <div className="flex"><Button type="button" variant="ghost" size="icon-compact" className="text-background hover:bg-background/15 hover:text-background disabled:bg-transparent" disabled={index === 0} onClick={() => moveImage(index, -1)} aria-label="向前移动"><ArrowLeft className="size-3.5" /></Button><Button type="button" variant="ghost" size="icon-compact" className="text-background hover:bg-background/15 hover:text-background disabled:bg-transparent" disabled={index === images.length - 1} onClick={() => moveImage(index, 1)} aria-label="向后移动"><ArrowRight className="size-3.5" /></Button></div>
                      <Button type="button" variant="ghost" size="icon-compact" className="text-background hover:bg-background/15 hover:text-background" onClick={() => removeImage(image.id)} aria-label="删除图片"><Trash2 className="size-3.5" /></Button>
                    </div>
                    {coverFileId === image.id ? <span className="absolute left-2 top-2 rounded-full bg-brand-strong px-2 py-0.5 text-[0.6875rem] font-bold text-background">封面</span> : null}
                  </div>
                ))}
                {images.length < 9 ? (
                  <button type="button" className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-accent/55 hover:text-foreground" onClick={() => fileInputRef.current?.click()}><ImagePlus className="size-6" /><span className="text-xs font-medium">添加图片</span></button>
                ) : null}
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="sr-only" onChange={(event) => addFiles(event.target.files)} />
              <p className="text-xs leading-5 text-muted-foreground">点击星标选择封面；发布时压缩为 WebP，不上传原图。无图时自动生成文字封面。</p>
            </div>
          </div>

          <footer data-slot="moment-composer-actions" className="relative z-10 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 bg-background px-6 py-4">
            {isUploading ? (
              <Button type="button" variant="link" size="compact" onClick={closeComposer} className="px-0 text-muted-foreground">取消上传</Button>
            ) : (
              <Button type="button" variant="link" size="compact" onClick={() => void clearDraft()} disabled={pending} className="px-0 text-muted-foreground">清空草稿</Button>
            )}
            {imageUploadProgress ? (
              <ImageUploadProgress
                progress={imageUploadProgress}
                label={imageUploadProgress.stage === "processing"
                  ? `${activeImagePosition ?? "图片"}已上传，正在处理`
                  : `${activeImagePosition ?? "图片"}${imageUploadProgress.stage === "preparing" ? "正在准备" : "正在上传"}`}
                className="mx-auto w-full max-w-sm"
                compact
              />
            ) : <span />}
            <Button type="submit" variant="ghost" disabled={pending} className="min-w-28 text-brand-strong">
              {pending ? <><Loader2 className="animate-spin" />{uploadProgress ?? "发布中"}</> : "发布动态"}
            </Button>
          </footer>
        </form>
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}
