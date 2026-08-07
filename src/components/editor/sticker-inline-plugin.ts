import { $nodeSchema, $remark } from "@milkdown/kit/utils";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { STICKER_INLINE_NODE_NAME, STICKER_MARKER_PREFIX } from "@/lib/sticker-inline";

type MarkdownNode = {
  type: string;
  url?: string;
  title?: string | null;
  alt?: string | null;
  assetId?: string;
  children?: MarkdownNode[];
};

function transformStickerImages(node: MarkdownNode) {
  if (!node.children) return;
  for (const child of node.children) {
    if (
      child.type === "image"
      && typeof child.title === "string"
      && child.title.startsWith(STICKER_MARKER_PREFIX)
    ) {
      child.type = "stickerInline";
      child.assetId = child.title.slice(STICKER_MARKER_PREFIX.length);
    } else {
      transformStickerImages(child);
    }
  }
}

export function createStickerInlineEditorPlugins() {
  const remarkStickerInline = $remark("sticker-inline-remark", () => () => (tree: MarkdownNode) => {
    transformStickerImages(tree);
  });

  const stickerInlineSchema = $nodeSchema(STICKER_INLINE_NODE_NAME, () => ({
    group: "inline",
    inline: true,
    atom: true,
    draggable: true,
    selectable: true,
    attrs: {
      assetId: { default: "" },
      src: { default: "" },
      alt: { default: "表情" },
    },
    parseDOM: [{
      tag: `img[data-type="${STICKER_INLINE_NODE_NAME}"]`,
      getAttrs: (dom: HTMLElement) => ({
        assetId: dom.dataset.assetId ?? "",
        src: dom.getAttribute("src") ?? "",
        alt: dom.getAttribute("alt") ?? "表情",
      }),
    }],
    toDOM: (node: ProseNode) => ["img", {
      "data-type": STICKER_INLINE_NODE_NAME,
      "data-asset-id": node.attrs.assetId,
      src: node.attrs.src,
      alt: node.attrs.alt,
      class: "sticker-inline",
      draggable: "true",
    }],
    parseMarkdown: {
      match: (node: MarkdownNode) => node.type === "stickerInline",
      runner: (state, node: MarkdownNode, type) => {
        state.addNode(type, {
          assetId: node.assetId,
          src: node.url,
          alt: node.alt ?? "表情",
        });
      },
    },
    toMarkdown: {
      match: (node: ProseNode) => node.type.name === STICKER_INLINE_NODE_NAME,
      runner: (state, node: ProseNode) => {
        state.addNode("image", undefined, undefined, {
          url: String(node.attrs.src),
          alt: "表情",
          title: `${STICKER_MARKER_PREFIX}${String(node.attrs.assetId)}`,
        });
      },
    },
  }));

  return { remarkStickerInline, stickerInlineSchema };
}
