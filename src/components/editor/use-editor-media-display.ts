"use client";

import { useEffect, useState, type RefObject } from "react";
import type { CrepeBuilder } from "@milkdown/crepe/builder";
import { editorViewCtx } from "@milkdown/core";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { STICKER_INLINE_NODE_NAME } from "@/lib/sticker-inline";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
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
  const key = new PluginKey<DecorationSet>("wenyou-media-display");
  const collect = (doc: ProseNode, from = 0, to = doc.content.size) => {
    const decorations: Decoration[] = [];
    doc.nodesBetween(from, to, (node, position) => {
      if ((node.type.name === "image-block" || node.type.name === STICKER_INLINE_NODE_NAME) && typeof node.attrs.src === "string") {
        decorations.push(Decoration.node(position, position + node.nodeSize, { "data-display-url": resolve(node.attrs.src) }));
      }
    });
    return decorations;
  };
  const plugin = $prose(() => new Plugin({
    key,
    state: {
      init: (_, state) => DecorationSet.create(state.doc, collect(state.doc)),
      apply: (transaction, previous) => {
        if (transaction.getMeta("media-display")) return DecorationSet.create(transaction.doc, collect(transaction.doc));
        if (!transaction.docChanged) return previous;
        let next = previous.map(transaction.mapping, transaction.doc);
        const additions = new Map<number, Decoration>();
        transaction.mapping.maps.forEach((map, index) => {
          let mappedRange = false;
          const refresh = (from: number, to: number) => {
            const rest = transaction.mapping.slice(index + 1);
            const start = Math.max(0, Math.min(transaction.doc.content.size, rest.map(from, -1)));
            const end = Math.max(start, Math.min(transaction.doc.content.size, rest.map(to, 1)));
            const nearby = collect(transaction.doc, start, end);
            next = next.remove(next.find(start, end).filter((decoration) => decoration.from < end && decoration.to > start));
            for (const decoration of nearby) additions.set(decoration.from, decoration);
          };
          map.forEach((_oldFrom, _oldTo, from, to) => { mappedRange = true; refresh(from, to); });
          if (!mappedRange) {
            // 属性/mark step 不移动位置，但仍可能改变媒体展示来源。
            const step = transaction.steps[index]?.toJSON() as { pos?: number; from?: number; to?: number } | undefined;
            if (typeof step?.pos === "number") refresh(step.pos, step.pos + 1);
            else if (typeof step?.from === "number" && typeof step.to === "number") refresh(step.from, step.to);
          }
        });
        // 一次事务的多个 step 可命中同一媒体，按位置去重并替换映射后的旧描述。
        const decorations = [...additions.values()];
        for (const decoration of decorations) next = next.remove(next.find(decoration.from, decoration.to).filter((existing) => existing.from === decoration.from));
        return next.add(transaction.doc, decorations);
      },
    },
    props: {
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
    decorations: (state) => key.getState(state) ?? DecorationSet.empty, } }));
  return { resolve, plugin,
    update(next: readonly MarkdownMediaDisplay[] | undefined) { mappings = next; },
    completed(image: Pick<UploadedImage, "url" | "display">) { uploaded.set(image.url, image.display ?? null); },
  };
}
