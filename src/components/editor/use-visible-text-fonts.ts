"use client";
import { apiMetaQueryOptions } from "@/api/hooks/use-api-meta";
import { importedTextFontVersion, legacyTextFontRouting } from "@/lib/legacy-text-font-routing";
import { subscribeDynamicFonts } from "@/lib/dynamic-text-font-state";
import { isDynamicTextFont } from "@/lib/markdown-text-font";
import { dynamicTextFontRuntime } from "@/lib/dynamic-text-font-runtime";
import { createContext, useContext, useEffect, type RefObject } from "react";
import { QueryObserver, QueryClientContext } from "@tanstack/react-query";
import { textFontPolicyQueryOptions } from "@/api/hooks/use-text-font-policy";
import { fontMetadataRetry } from "@/api/hooks/text-font-recovery";
import { fontSessionPolicy } from "@/lib/thread-font-policy";
import { textFontCatalogQueryOptions } from "@/api/hooks/use-text-font-catalog";
import type { FontSessionPolicy } from "@/lib/thread-font-session";
import { observeFontDemands } from "./visible-font-demands";
import { threadFontRuntime, type ThreadFontCatalog, type ThreadFontRuntime } from "@/lib/thread-font-runtime";

/** 离线组件与浏览器验收可注入已核验的同协议目录/传输；产品默认走 apiClient。 */
export const TextFontEnvironment = createContext<{ catalog: ThreadFontCatalog; runtime: ThreadFontRuntime; policy?: FontSessionPolicy | null } | null>(null);

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

export function useVisibleTextFonts(rootRef: RefObject<HTMLElement | null>, contentVersion?: unknown, onStatus?: (status: "loading" | "ready" | "fallback") => void, enabled = true, scope?: symbol) {
  const client = useContext(QueryClientContext);
  const environment = useContext(TextFontEnvironment);
  useEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root || (!client && !environment)) return;
    let alive = true, users = 0, refreshing = false;
    let catalog = environment?.catalog;
    let policyValue: unknown = undefined;
    const runtime = environment?.runtime ?? threadFontRuntime();
    let unsubscribe: (() => void) | undefined;
    const refresh = () => {
      if (refreshing) return; refreshing = true;
      queueMicrotask(() => { refreshing = false; if (alive) tracking.refresh(); });
    };
    const metadata = () => {
      if (environment || unsubscribe || !client) return;
      const observer = new QueryObserver(client, textFontCatalogQueryOptions());
      const policyObserver = new QueryObserver(client, textFontPolicyQueryOptions());
      const releaseCatalog = observer.subscribe(result => {
        const next = result.error && !fontMetadataRetry(0, result.error) ? undefined : result.data;
        if (next !== catalog) { catalog = next; if (!catalog) runtime.invalidate(); refresh(); }
      });
      const releasePolicy = policyObserver.subscribe(result => {
        const next = result.error && !fontMetadataRetry(0, result.error) ? null : result.data;
        if (next !== policyValue) { policyValue = next; refresh(); }
      });
      unsubscribe = () => { releaseCatalog(); releasePolicy(); };
      catalog = observer.getCurrentResult().data;
      policyValue = policyObserver.getCurrentResult().data;
    };
    const metaObserver = !environment && client ? new QueryObserver(client, apiMetaQueryOptions()) : undefined;
    let metaReady = !metaObserver || metaObserver.getCurrentResult().isFetched || Boolean(metaObserver.getCurrentResult().data);
    legacyTextFontRouting.observeCapability(metaObserver?.getCurrentResult().data?.capabilities?.textFontV2Supported);
    let routingSnapshot = legacyTextFontRouting.snapshot;
    const routingChanged = () => {
      const next = legacyTextFontRouting.snapshot;
      if (next !== routingSnapshot) { routingSnapshot = next; refresh(); }
    };
    const releaseRouting = legacyTextFontRouting.subscribe(routingChanged);
    const releasePermissions = subscribeDynamicFonts(routingChanged);
    const releaseMeta = metaObserver?.subscribe(result => {
      legacyTextFontRouting.observeCapability(result.data?.capabilities?.textFontV2Supported);
      const ready = result.isFetched || Boolean(result.data);
      if (ready !== metaReady) { metaReady = ready; refresh(); }
    });
    const tracking = observeFontDemands(root, (fontId, text, emit) => {
      if(isDynamicTextFont(fontId)){onStatus?.("loading");return dynamicTextFontRuntime().watch(fontId,text,emit,scope);}
      const route = legacyTextFontRouting.route(fontId);
      if (route === "mapped-v2") { onStatus?.("loading"); return dynamicTextFontRuntime().watch(importedTextFontVersion(fontId)!, text, emit,scope); }
      if (route === "default-font" || !metaReady) {
        emit({ family: "var(--wenyou-font-body-family, system-ui)", status: "fallback" });
        return () => {};
      }
      users++; metadata(); onStatus?.("loading");
      const policy = environment ? environment.policy ?? null : catalog && policyValue !== undefined ? fontSessionPolicy(policyValue, catalog) : undefined;
      const release = catalog && policy !== undefined ? runtime.watch(catalog, policy, fontId, text, emit) : (() => { emit({family:"var(--wenyou-font-body-family, system-ui)",status:"fallback"}); return () => {}; })();
      return () => {
        release(); users--;
        queueMicrotask(() => { if (!users) { unsubscribe?.(); unsubscribe = undefined; } });
      };
    }, (element, fontId, result) => {
      applyFontWithoutScrollJump(root, () => root.style.setProperty("--wenyou-content-font-" + fontId, result.family));
      element.setAttribute("data-font-load", result.status); onStatus?.(result.status);
    });
    return () => { alive = false; tracking.disconnect(); unsubscribe?.(); releaseMeta?.(); releaseRouting(); releasePermissions(); };

  }, [client, environment, rootRef, contentVersion, onStatus, enabled, scope]);
}
