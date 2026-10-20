"use client";
import { createContext, useContext, useEffect, type RefObject } from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { textFontCatalogQueryOptions } from "@/api/hooks/use-text-font-catalog";
import { TEXT_FONT_ATTRIBUTE, normalizeTextFont } from "@/lib/markdown-text-font";
import { threadFontRuntime, type ThreadFontCatalog, type ThreadFontRuntime } from "@/lib/thread-font-runtime";

/** 离线组件与浏览器验收可注入已核验的同协议目录/传输；产品默认走 apiClient。 */
export const TextFontEnvironment = createContext<{ catalog: ThreadFontCatalog; runtime: ThreadFontRuntime } | null>(null);

function scrollOwner(element: HTMLElement): HTMLElement | null {
  for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
    if (/(auto|scroll)/u.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
  }
  return document.scrollingElement as HTMLElement | null;
}
/** 字体就绪前后锚住当前可见字符；不移动编辑器选区，也不抢回用户加载期间的滚动。 */
export function applyFontWithoutScrollJump(root: HTMLElement, apply: () => void) {
  const owner = scrollOwner(root), box = root.getBoundingClientRect();
  const top = Math.max(0, box.top, owner && owner !== document.scrollingElement ? owner.getBoundingClientRect().top : 0);
  const x = Math.min(innerWidth - 1, Math.max(0, box.left + 24));
  const doc = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
  let range = doc.caretRangeFromPoint?.(x, top + 12)?.cloneRange();
  if (range && (!root.contains(range.startContainer) || range.startContainer.nodeType !== Node.TEXT_NODE)) range = undefined;
  if (range) range.setEnd(range.startContainer, Math.min(range.startOffset + 1, range.startContainer.textContent?.length ?? 0));
  const before = range?.getBoundingClientRect().top;
  apply();
  if (owner && range && before !== undefined) owner.scrollTop += range.getBoundingClientRect().top - before;
}

export function useVisibleTextFonts(rootRef: RefObject<HTMLElement | null>, contentVersion?: unknown, onStatus?: (status: "loading" | "ready" | "fallback") => void) {
  const client = useContext(QueryClientContext);
  const environment = useContext(TextFontEnvironment);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || (!client && !environment)) return;
    let alive = true;
    const visible = new Set<Element>(), seen = new Map<Element, string>();
    const runtime = environment?.runtime ?? threadFontRuntime();
    const load = async (element: Element) => {
      const fontId = normalizeTextFont(element.getAttribute(TEXT_FONT_ATTRIBUTE));
      const text = element.textContent ?? "";
      if (!fontId || !text || !root.contains(element)) return;
      const key = fontId + ":" + text;
      if (seen.get(element) === key) return;
      seen.set(element, key);
      onStatus?.("loading");
      try {
        const catalog = environment?.catalog ?? await client!.fetchQuery(textFontCatalogQueryOptions());
        const result = await runtime.load(catalog, fontId, text);
        if (!alive || !root.contains(element) || seen.get(element) !== key) return;
        applyFontWithoutScrollJump(root, () => root.style.setProperty("--wenyou-content-font-" + fontId, result.family));
        element.setAttribute("data-font-load", result.status);
        onStatus?.(result.status);
      } catch {
        // 网络、缓存和字体解码失败均只改变显示回退，不能改 Markdown 或 fontId。
        if (alive && root.contains(element)) { element.setAttribute("data-font-load", "fallback"); onStatus?.("fallback"); }
      }
    };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) { visible.add(entry.target); void load(entry.target); }
        else visible.delete(entry.target);
      }
    }, { rootMargin: "0px" });
    const scan = () => {
      for (const element of root.querySelectorAll("[" + TEXT_FONT_ATTRIBUTE + "]")) {
        if (!seen.has(element)) { if (observer) observer.observe(element); else { visible.add(element); void load(element); } }
        else if (visible.has(element)) void load(element);
      }
      for (const element of seen.keys()) if (!root.contains(element)) { observer?.unobserve(element); seen.delete(element); visible.delete(element); }
    };
    const mutations = new MutationObserver(scan);
    mutations.observe(root, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: [TEXT_FONT_ATTRIBUTE] });
    scan();
    return () => { alive = false; observer?.disconnect(); mutations.disconnect(); };
  }, [client, environment, rootRef, contentVersion, onStatus]);
}
