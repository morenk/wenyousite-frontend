/** 主题帖卡片封面：1–3 张图片按数量铺满半宽预览，统一裁切为 16:9。 */

"use client";

import { useState } from "react";
import { getImageUrlBySize } from "@/lib/upload-image";
import { cn } from "@/lib/utils";

interface ThreadCoverGridProps {
  images: string[];
  className?: string;
}

interface ThreadCoverImageProps {
  originalUrl: string;
  onPermanentError: (url: string) => void;
}

function isUploadedMediaUrl(url: string): boolean {
  return (
    url.includes("/uploads/") &&
    !url.endsWith("_feed.webp") &&
    !url.endsWith("_md.webp") &&
    !url.endsWith("_thumb.webp")
  );
}

function isGifUrl(url: string): boolean {
  return /\.gif(?:[?#]|$)/iu.test(url);
}

function ThreadCoverImage({
  originalUrl,
  onPermanentError,
}: ThreadCoverImageProps) {
  const feedUrl = isUploadedMediaUrl(originalUrl) && !isGifUrl(originalUrl)
    ? getImageUrlBySize(originalUrl, "feed")
    : originalUrl;
  const [useOriginal, setUseOriginal] = useState(false);
  const displayUrl = useOriginal ? originalUrl : feedUrl;

  return (
    <div className="aspect-video min-w-0 overflow-hidden bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element -- 远程封面需支持衍生图失败回退 */}
      <img
        src={displayUrl}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        draggable={false}
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover"
        onError={() => {
          if (feedUrl !== originalUrl && !useOriginal) {
            setUseOriginal(true);
            return;
          }
          onPermanentError(originalUrl);
        }}
      />
    </div>
  );
}

export function ThreadCoverGrid({ images, className }: ThreadCoverGridProps) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const visibleImages = [...new Set(images.filter(Boolean))]
    .slice(0, 3)
    .filter((url) => !failedUrls.has(url));

  if (visibleImages.length === 0) return null;

  return (
    <div
      className={cn(
        "pointer-events-none mt-3 grid w-1/2 gap-1.5 overflow-hidden rounded-xl bg-muted",
        visibleImages.length === 1
          ? "grid-cols-1"
          : visibleImages.length === 2
            ? "grid-cols-2"
            : "grid-cols-3",
        className,
      )}
      data-image-count={visibleImages.length}
    >
      {visibleImages.map((url) => (
        <ThreadCoverImage
          key={url}
          originalUrl={url}
          onPermanentError={(failedUrl) => {
            setFailedUrls((current) => {
              const next = new Set(current);
              next.add(failedUrl);
              return next;
            });
          }}
        />
      ))}
    </div>
  );
}
