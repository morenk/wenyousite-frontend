import type { CSSProperties } from "react";

export const STICKER_DISPLAY_STYLE: CSSProperties = {
  width: "auto",
  height: "auto",
  maxWidth: "min(var(--sticker-display-max), 100%)",
  maxHeight: "var(--sticker-display-max)",
};

type StickerDisplayAsset = {
  url: string;
  thumbnailUrl?: string | null;
  animated?: boolean | null;
};

/** 静态表情只加载 128px 缩略图；动图使用已规范化的动画资产。 */
export function getStickerDisplayUrl(sticker: StickerDisplayAsset): string {
  if (!sticker.animated && sticker.thumbnailUrl) return sticker.thumbnailUrl;
  return sticker.url;
}
