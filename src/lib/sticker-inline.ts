export const STICKER_INLINE_NODE_NAME = "sticker-inline";
export const STICKER_MARKER_PREFIX = "wenyousite-sticker:v1:";
export const MAX_STICKERS_PER_POST = 20;

export interface InlineStickerNode {
  assetId: string;
  url: string;
}

export function serializeInlineStickerNode(sticker: InlineStickerNode) {
  return `![表情](${sticker.url} "${STICKER_MARKER_PREFIX}${sticker.assetId}")`;
}

