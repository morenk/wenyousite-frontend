import { isMarkdownEscaped, maskMarkdownCode } from "@/lib/markdown-code";

export const STICKER_INLINE_NODE_NAME = "sticker-inline";
export const STICKER_MARKER_PREFIX = "wenyousite-sticker:v1:";
export const MAX_STICKERS_PER_POST = 20;

const MARKDOWN_IMAGE_RE = /!\[([^\]\r\n]*)\]\((\S+?)(?:\s+"([^"]*)")?\)/gu;

export interface InlineStickerNode {
  assetId: string;
  url: string;
}

export type MarkdownImageNode =
  | { type: "sticker"; assetId: string; url: string; alt: string }
  | { type: "image"; url: string; alt: string; title: string | null };

export function parseStickerAssetId(title: string | null | undefined): string | null {
  if (!title?.startsWith(STICKER_MARKER_PREFIX)) return null;
  const assetId = title.slice(STICKER_MARKER_PREFIX.length);
  return assetId.length > 0 ? assetId : null;
}

/** 解析代码与转义边界外的普通图片和版本化收藏表情。 */
export function parseMarkdownImageNodes(content: string): MarkdownImageNode[] {
  const masked = maskMarkdownCode(content);
  const nodes: MarkdownImageNode[] = [];
  for (const match of masked.matchAll(MARKDOWN_IMAGE_RE)) {
    if (isMarkdownEscaped(content, match.index)) continue;
    const title = match[3] ?? null;
    const assetId = parseStickerAssetId(title);
    nodes.push(assetId
      ? { type: "sticker", assetId, url: match[2]!, alt: match[1]! }
      : { type: "image", url: match[2]!, alt: match[1]!, title });
  }
  return nodes;
}

export function serializeMarkdownImageNode(node: MarkdownImageNode): string {
  if (node.type === "sticker") return serializeInlineStickerNode(node);
  const title = node.title === null ? "" : ` "${node.title}"`;
  return `![${node.alt}](${node.url}${title})`;
}

export function serializeInlineStickerNode(sticker: InlineStickerNode) {
  return `![表情](${sticker.url} "${STICKER_MARKER_PREFIX}${sticker.assetId}")`;
}
