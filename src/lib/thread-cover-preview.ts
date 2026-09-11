import type { components } from "@/api/types";

type Preview = components["schemas"]["ThreadCoverPreviewVariantResponseDto"];
export interface CoverPlaybackSize { width: number; height: number; dpr: number }

/** 使用选中瞬间的实际像素需求；只消费契约 URL，不拼地址或按后缀判断格式。 */
export function selectThreadCoverPreview(
  variants: readonly Preview[] | null | undefined,
  size: CoverPlaybackSize,
): string | null {
  if (!Array.isArray(variants) || variants.length < 1 || variants.length > 2) return null;
  const valid: Preview[] = [];
  for (const variant of variants) {
    if (!variant || typeof variant.url !== "string" || !variant.url.trim()
      || ![variant.width, variant.height, variant.bytes].every((value) => Number.isSafeInteger(value) && value > 0)
      || Math.max(variant.width, variant.height) > 800
      || valid.some((previous) => previous.url === variant.url
        || previous.width === variant.width && previous.height === variant.height)) return null;
    valid.push(variant);
  }
  valid.sort((a, b) => a.width * a.height - b.width * b.height);
  const dpr = Number.isFinite(size.dpr) && size.dpr > 0 ? size.dpr : 1;
  const width = Math.max(0, size.width) * dpr;
  const height = Math.max(0, size.height) * dpr;
  return (valid.find((variant) => variant.width >= width && variant.height >= height)
    ?? valid[valid.length - 1]).url;
}
