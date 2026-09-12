/** 动态展示只消费服务端媒体元数据，不推测文件名或派生路径。 */
import type { MediaDisplay } from "@/lib/media-display";
export interface MomentMediaAsset {
  display?: MediaDisplay | null;
  url: string;
  thumbnailUrl?: string | null;
  feedUrl?: string | null;
  mediumUrl?: string | null;
  animated?: boolean;
  contentType?: string | null;
  width?: number | null;
  height?: number | null;
}

export function isMomentAnimation(media: MomentMediaAsset): boolean {
  return media.animated === true || media.contentType?.trim().toLowerCase() === "image/gif";
}

export function getMomentStaticUrl(media: MomentMediaAsset, mode: "cover" | "detail" | "thumbnail" | "sticker" | "full" = "detail"): string | null {
  const derived = (value: string | null | undefined) => {
    const url = value?.trim();
    return url && url !== media.url.trim() ? url : null;
  };
  const thumbnail = derived(media.thumbnailUrl);
  const medium = derived(media.mediumUrl);
  const feed = derived(media.feedUrl);
  if (isMomentAnimation(media)) return thumbnail;
  const contentType = media.contentType?.trim().toLowerCase();
  const original = media.animated === false || contentType?.startsWith("image/") ? (media.display?.url ?? media.url).trim() || null : null;
  if (mode === "full") return original || medium || thumbnail;
  if (mode === "sticker") return thumbnail || original;
  if (mode === "cover") return feed || medium || thumbnail;
  if (mode === "thumbnail") return thumbnail || feed || medium;
  return medium || thumbnail || original;
}
