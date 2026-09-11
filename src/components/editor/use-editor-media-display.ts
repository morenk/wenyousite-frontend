"use client";

import { useEffect, useState, type RefObject } from "react";
import type { CrepeBuilder } from "@milkdown/crepe/builder";
import { editorViewCtx } from "@milkdown/core";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { STICKER_INLINE_NODE_NAME } from "@/lib/sticker-inline";
import { Plugin } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { findMediaDisplay, type MarkdownMediaDisplay, type MediaDisplay } from "@/lib/media-display";
import type { UploadedImage } from "@/lib/upload-image";

/** 展示代理保持同步，避免异步NodeView回调覆盖已替换的图片；只保存本编辑器已授权描述。 */
export function useEditorMediaDisplay(mappings: readonly MarkdownMediaDisplay[] | undefined, editor: RefObject<CrepeBuilder | null>, loading: boolean) {
  const [api] = useState(() => createDisplayProjection(mappings));
  useEffect(() => {
    api.update(mappings);
    if (!loading) editor.current?.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      // 只刷新展示decorations，不改变文档和历史记录，复制仍由模型serializer产生。
      view.dispatch(view.state.tr.setMeta("media-display", true).setMeta("addToHistory", false));
    });
  }, [api, editor, loading, mappings]);
  return api;
}

function createDisplayProjection(initial?: readonly MarkdownMediaDisplay[]) {
  let mappings = initial;
  const uploaded = new Map<string, MediaDisplay | null>();
  const resolve = (sourceUrl: string) => (uploaded.get(sourceUrl) ?? findMediaDisplay(sourceUrl, mappings))?.url ?? sourceUrl;
  const plugin = $prose(() => new Plugin({ props: {
    // NodeView只投影屏幕DOM；schema.toDOM继续序列化来源，保证复制/拖放身份。
    nodeViews: { [STICKER_INLINE_NODE_NAME](node) {
      const dom = document.createElement("img");
      const update = (next: ProseNode) => {
        if (next.type.name !== STICKER_INLINE_NODE_NAME) return false;
        dom.dataset.type = STICKER_INLINE_NODE_NAME;
        dom.dataset.assetId = String(next.attrs.assetId);
        const url = resolve(String(next.attrs.src));
        if (dom.getAttribute("src") !== url) dom.setAttribute("src", url);
        dom.alt = String(next.attrs.alt);
        dom.className = "sticker-inline";
        dom.draggable = true;
        return true;
      };
      update(node);
      return { dom, update };
    } },
    decorations(state) {
    const decorations: Decoration[] = [];
    state.doc.descendants((node, position) => {
      if ((node.type.name === "image-block" || node.type.name === STICKER_INLINE_NODE_NAME) && typeof node.attrs.src === "string") {
        decorations.push(Decoration.node(position, position + node.nodeSize, { "data-display-url": resolve(node.attrs.src) }));
      }
    });
    return DecorationSet.create(state.doc, decorations);
  } } }));
  return { resolve, plugin,
    update(next: readonly MarkdownMediaDisplay[] | undefined) { mappings = next; },
    completed(image: Pick<UploadedImage, "url" | "display">) { uploaded.set(image.url, image.display ?? null); },
  };
}
