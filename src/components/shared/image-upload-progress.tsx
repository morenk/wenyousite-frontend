"use client";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { UploadImageProgress as UploadImageProgressValue } from "@/lib/upload-image";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getProgressLabel(progress: UploadImageProgressValue): string {
  if (progress.stage === "preparing") return "正在获取上传地址";
  if (progress.stage === "processing") return "上传完成，正在处理图片";
  return "正在上传图片";
}

interface ImageUploadProgressProps {
  progress: UploadImageProgressValue;
  label?: string;
  onCancel?: () => void;
  className?: string;
  compact?: boolean;
}

export function ImageUploadProgress({
  progress,
  label,
  onCancel,
  className,
  compact = false,
}: ImageUploadProgressProps) {
  const value = progress.stage === "preparing" ? null : progress.percent;
  const byteLabel = progress.stage === "uploading"
    && progress.loadedBytes !== null
    && progress.totalBytes !== null
    ? `${formatBytes(progress.loadedBytes)} / ${formatBytes(progress.totalBytes)}`
    : null;

  return (
    <div
      data-slot="image-upload-progress"
      className={cn(
        "rounded-xl bg-muted/70 px-3 py-2 text-xs text-muted-foreground",
        compact && "rounded-lg px-2.5 py-1.5",
        className,
      )}
    >
      <div className="mb-1.5 flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
          {label ?? getProgressLabel(progress)}
        </span>
        {byteLabel ? <span className="shrink-0 font-utility tabular-nums">{byteLabel}</span> : null}
        {progress.stage === "uploading" && progress.percent !== null ? (
          <span className="w-9 shrink-0 text-right font-utility font-bold tabular-nums text-brand-strong">
            {progress.percent}%
          </span>
        ) : null}
        {onCancel ? (
          <Button
            type="button"
            variant="link"
            size="compact"
            className="h-auto shrink-0 px-0 py-0 text-xs text-muted-foreground"
            onClick={onCancel}
          >
            取消
          </Button>
        ) : null}
      </div>
      <Progress
        value={value}
        aria-label={label ?? getProgressLabel(progress)}
        aria-valuetext={progress.percent === null ? undefined : `${progress.percent}%`}
      />
    </div>
  );
}

export { formatBytes };
