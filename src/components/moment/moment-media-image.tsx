"use client";

import { getMediaDisplayUrl } from "@/lib/media-display";
import { useState, type CSSProperties, type ImgHTMLAttributes } from "react";
import { getMomentStaticUrl, isMomentAnimation, type MomentMediaAsset } from "@/lib/moment-media";
import { useMomentAnimationFailure, useMomentPlayback } from "@/components/moment/moment-playback";
import { Button } from "@/components/ui/button";

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onClick"> {
  media: MomentMediaAsset;
  allowPlayback: boolean;
  foreground?: boolean;
  mode?: "cover" | "detail" | "thumbnail" | "sticker" | "full";
  onClick?: () => void;
  buttonLabel?: string;
  buttonClassName?: string;
  buttonStyle?: CSSProperties;
  wrapperStyle?: CSSProperties;
  buttonSlot?: string;
}

export function MomentMediaImage({ media, ...props }: Props) {
  return <MediaImage key={[media.url, media.display?.url, media.thumbnailUrl, media.mediumUrl, media.feedUrl].join("|")} media={media} {...props} />;
}

function MediaImage({ media, allowPlayback, foreground, mode, onClick, buttonLabel, buttonClassName, buttonStyle, wrapperStyle, buttonSlot, alt = "", ...imageProps }: Props) {
  const { ref, playing } = useMomentPlayback(allowPlayback && isMomentAnimation(media), foreground);
  const [animationFailed, setAnimationFailed] = useMomentAnimationFailure(getMediaDisplayUrl(media));
  const [previewFailed, setPreviewFailed] = useState(false);
  const animate = playing && !animationFailed;
  const src = animate ? getMediaDisplayUrl(media) : previewFailed ? null : getMomentStaticUrl(media, mode);
  const content = src ? (
    // eslint-disable-next-line @next/next/no-img-element -- 动态原图仅在符合播放条件时挂载；静止只用明确静态派生资源
    <img {...imageProps} key={src} src={src} alt={alt} onError={() => animate ? setAnimationFailed(true) : setPreviewFailed(true)} />
  ) : <span role="img" aria-label={alt || "图片暂不可用"} className="flex h-full min-h-10 w-full items-center justify-center bg-muted text-xs text-muted-foreground">图片暂不可用</span>;
  return (
    <span ref={ref} style={wrapperStyle} className="relative block h-full w-full">
      {onClick ? <button type="button" data-slot={buttonSlot} onClick={onClick} aria-label={buttonLabel} className={buttonClassName} style={buttonStyle}>{content}</button> : content}
      {animationFailed && playing ? (
        <Button type="button" size="sm" variant="secondary" className="absolute bottom-2 left-1/2 z-20 -translate-x-1/2" onClick={(event) => { event.stopPropagation(); setAnimationFailed(false); }}>重试动图</Button>
      ) : null}
    </span>
  );
}
