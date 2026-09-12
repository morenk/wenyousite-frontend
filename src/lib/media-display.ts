/** 业务身份保持不变；展示源只消费服务端已发布的描述，不推导对象键。 */
import type { components } from "@/api/types";

export type MediaDisplay = components["schemas"]["MediaDisplayResponseDto"];
export type MarkdownMediaDisplay = components["schemas"]["MarkdownMediaDisplayResponseDto"];
export type DisplayMedia = { url: string; display?: MediaDisplay | null };

export function getMediaDisplayUrl(media: DisplayMedia): string {
  return media.display?.url ?? media.url;
}

/** 重复来源无法唯一对应时不替调用方猜测；历史缺映射沿用来源。 */
export function findMediaDisplay(sourceUrl: string, mappings?: readonly MarkdownMediaDisplay[]): MediaDisplay | null {
  const matches = mappings?.filter((entry) => entry.sourceUrl === sourceUrl);
  return matches?.length === 1 ? matches[0].display : null;
}
