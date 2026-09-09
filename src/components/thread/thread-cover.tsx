/** 列表封面使用服务端确认的静态首帧，全局只按需挂载一张动画。 */
"use client";

import { useState, type ImgHTMLAttributes } from "react";
import { ImageIcon } from "lucide-react";
import type { components } from "@/api/types";
import { useCoverPlayback } from "@/hooks/use-cover-playback";
import { cn } from "@/lib/utils";

type CoverMedia = components["schemas"]["ThreadCoverMediaResponseDto"];
interface ThreadCoverProps {
  image?: string | null;
  media?: CoverMedia | null;
  className?: string;
}

function CoverImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  // eslint-disable-next-line @next/next/no-img-element -- 原生图片保留GIF/WebP自身动画循环，CDN跨域无需额外fetch。
  return <img alt="" aria-hidden="true" loading="lazy" decoding="async" draggable={false} referrerPolicy="no-referrer" {...props} />;
}

function PlayingCover({ url, poster, onError }: { url: string; poster: string; onError: () => void }) {
  const [ready, setReady] = useState(false);
  return <>
    <CoverImage data-cover-poster src={poster} className={cn("h-full w-full object-cover", ready && "invisible")} />
    <CoverImage data-cover-animation src={url} loading="eager" onLoad={() => setReady(true)} onError={onError}
      className={cn("absolute inset-0 h-full w-full object-cover", !ready && "invisible")} />
  </>;
}

export function ThreadCover({ image, media, className }: ThreadCoverProps) {
  const original = image?.trim() ?? "";
  const descriptor = media?.url === original ? media : null;
  // 防御不一致的响应：动画原图不能冒充静态poster。
  const poster = descriptor?.posterUrl && !(descriptor.animated === true && descriptor.posterUrl === original)
    ? descriptor.posterUrl : null;
  const identity = JSON.stringify([original, poster, descriptor?.animated]);
  const [loadedPoster, setLoadedPoster] = useState<string | null>(null);
  const [failedPoster, setFailedPoster] = useState<string | null>(null);
  const [failedAnimation, setFailedAnimation] = useState<string | null>(null);
  const showPoster = !!poster && failedPoster !== identity;
  const { ref, active } = useCoverPlayback(
    showPoster && loadedPoster === identity && descriptor?.animated === true && failedAnimation !== identity, identity,
  );

  if (!original) return null;
  return <div ref={ref}
    className={cn("pointer-events-none relative mt-3 aspect-video w-1/2 overflow-hidden rounded-xl bg-muted", className)}
    data-thread-cover="true" data-cover-url={original}>
    {showPoster ? active
      ? <PlayingCover key={identity} url={original} poster={poster} onError={() => setFailedAnimation(identity)} />
      : <CoverImage key={identity} data-cover-poster src={poster} className="h-full w-full object-cover"
          onLoad={() => setLoadedPoster(identity)} onError={() => setFailedPoster(identity)} />
      : <span className="flex h-full items-center justify-center text-muted-foreground" aria-hidden="true"><ImageIcon className="size-6" /></span>}
    {descriptor?.animated === true && <span className="absolute bottom-2 right-2 rounded bg-background/90 px-1.5 py-0.5 text-xs text-foreground" aria-hidden="true">动图</span>}
  </div>;
}
