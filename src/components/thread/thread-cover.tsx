/** 列表封面使用服务端确认的静态首帧，可见项按需挂载动画。 */
"use client";

import { getMediaDisplayUrl } from "@/lib/media-display";
import { useState, type ImgHTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
import { ImageIcon } from "lucide-react";
import type { components } from "@/api/types";
import { useCoverPlayback } from "@/hooks/use-cover-playback";
import { selectThreadCoverPreview } from "@/lib/thread-cover-preview";
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

function PlayingCover({ url, poster, onError }: { url: string; poster: string | null; onError: () => void }) {
  const [ready, setReady] = useState(false);
  return <>
    {poster && <CoverImage data-cover-poster src={poster} className={cn("h-full w-full object-cover", ready && "invisible")} />}
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
  const identity = JSON.stringify([original, poster, descriptor?.animated, descriptor?.previewVariants, descriptor?.display]);
  const [loadedPoster, setLoadedPoster] = useState<string | null>(null);
  const [failedPoster, setFailedPoster] = useState<string | null>(null);
  const [failedAnimation, setFailedAnimation] = useState<string | null>(null);
  const showPoster = !!poster && failedPoster !== identity;
  const { ref, active, size, generation } = useCoverPlayback(
    (!!descriptor?.display || (showPoster && loadedPoster === identity)) && descriptor?.animated === true && failedAnimation !== identity, identity,
  );

  const fullUrl = descriptor ? getMediaDisplayUrl(descriptor) : original;
  const playbackUrl = size ? selectThreadCoverPreview(descriptor?.previewVariants, size) ?? fullUrl : fullUrl;

  if (!original) return null;
  return <div ref={ref}
    className={cn("pointer-events-none relative mt-3 aspect-video w-1/2 overflow-hidden rounded-xl bg-muted", className)}
    data-thread-cover="true" data-cover-url={original}>
    {active ? <PlayingCover key={`${identity}:${generation}`} url={playbackUrl} poster={showPoster ? poster : null} onError={() => setFailedAnimation(identity)} />
      : showPoster ? <CoverImage key={identity} data-cover-poster src={poster} className="h-full w-full object-cover"
          onLoad={() => setLoadedPoster(identity)} onError={() => setFailedPoster(identity)} />
      : <span className="flex h-full items-center justify-center text-muted-foreground" aria-hidden="true"><ImageIcon className="size-6" /></span>}
    {failedAnimation === identity && <Button type="button" variant="secondary" size="sm" className="pointer-events-auto absolute inset-x-2 bottom-2" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setFailedAnimation(null); }}>重试封面动图</Button>}
    {descriptor?.animated === true && failedAnimation !== identity && <span className="absolute bottom-2 right-2 rounded bg-background/90 px-1.5 py-0.5 text-xs text-foreground" aria-hidden="true">动图</span>}
  </div>;
}
