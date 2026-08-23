/** 主题帖卡片封面：只展示默认主贴的第一张图片，统一裁切为 16:9。 */

"use client";

import { useState } from "react";
import { getImageUrlBySize } from "@/lib/upload-image";
import { cn } from "@/lib/utils";

interface ThreadCoverProps {
  image?: string | null;
  className?: string;
}

function isUploadedMediaUrl(url: string): boolean {
  return (
    (url.includes("/media/") || url.includes("/uploads/")) &&
    !url.endsWith("_feed.webp") &&
    !url.endsWith("_md.webp") &&
    !url.endsWith("_thumb.webp")
  );
}

function isGifUrl(url: string): boolean {
  return /\.gif(?:[?#]|$)/iu.test(url);
}

export function ThreadCover({ image, className }: ThreadCoverProps) {
  const originalUrl = image?.trim() ?? "";
  const feedUrl = isUploadedMediaUrl(originalUrl) && !isGifUrl(originalUrl)
    ? getImageUrlBySize(originalUrl, "feed")
    : originalUrl;
  const [originalFallbackUrl, setOriginalFallbackUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!originalUrl || failedUrl === originalUrl) return null;

  const useOriginal = originalFallbackUrl === originalUrl;

  return (
    <div
      className={cn(
        "pointer-events-none mt-3 aspect-video w-1/2 overflow-hidden rounded-xl bg-muted",
        className,
      )}
      data-thread-cover="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 远程封面需支持衍生图失败回退 */}
      <img
        src={useOriginal ? originalUrl : feedUrl}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        draggable={false}
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover"
        onError={() => {
          if (feedUrl !== originalUrl && !useOriginal) {
            setOriginalFallbackUrl(originalUrl);
            return;
          }
          setFailedUrl(originalUrl);
        }}
      />
    </div>
  );
}
