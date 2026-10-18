"use client";

import { Loader2 } from "lucide-react";
import type { UploadOperationPhase } from "@/hooks/use-upload-operation";
import type { UploadImageProgress } from "@/lib/upload-image";
import { ImageUploadProgress } from "./image-upload-progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** 本地准备、媒体传输与业务保存分开显示，不把裁切或保存伪装成字节进度。 */
export function ImageUploadStatus({ phase, progress, onCancel, className }: {
  phase: UploadOperationPhase | null;
  progress: UploadImageProgress | null;
  onCancel: () => void;
  className?: string;
}) {
  if (!phase) return null;
  if (phase === "uploading" && progress) {
    return <ImageUploadProgress progress={progress} onCancel={onCancel} cancelLabel="取消上传" className={className} compact />;
  }
  return (
    <div role="status" className={cn("flex items-center gap-2 rounded-[var(--radius-compact)] bg-muted/70 px-3 py-2 text-xs text-muted-foreground", className)}>
      <Loader2 aria-hidden="true" className="size-3.5 animate-spin text-brand-strong motion-reduce:animate-none" />
      <span className="flex-1">{phase === "saving" ? "正在保存…" : "正在准备图片…"}</span>
      {phase !== "saving" ? <Button type="button" variant="link" size="compact" className="h-auto px-0 py-0 text-xs text-muted-foreground" onClick={onCancel}>取消上传</Button> : null}
    </div>
  );
}
