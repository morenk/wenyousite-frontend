/** 列表封面共享可见性调度：露出一半即播放，完全离屏才停止，不限制并播数量。 */
export const COVER_DATA_SAVER_KEY = "wenyou:cover-data-saver";
export const COVER_PREFERENCE_EVENT = "wenyou:cover-preference";

export interface CoverRect { left: number; top: number; right: number; bottom: number }
export interface CoverCandidate { id: symbol; rect: CoverRect; viewport: CoverRect; visible: CoverRect }

/** 进入需半数可见；已激活项仅在完全离屏/被遮挡时退出，避免阈值附近反复重启。 */
export function shouldPlayCover(candidate: Omit<CoverCandidate, "id">, active: boolean): boolean {
  const { rect, visible } = candidate;
  const area = Math.max(0, rect.right - rect.left) * Math.max(0, rect.bottom - rect.top);
  const visibleArea = Math.max(0, visible.right - visible.left) * Math.max(0, visible.bottom - visible.top);
  return area > 0 && (active ? visibleArea > 0 : visibleArea / area >= 0.5);
}

function intersect(a: CoverRect, b: CoverRect): CoverRect {
  return { left: Math.max(a.left, b.left), top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) };
}

export function measureCover(node: HTMLElement): Omit<CoverCandidate, "id"> | null {
  if (!node.isConnected || node.closest('[inert], [aria-hidden="true"]')) return null;
  const rect = node.getBoundingClientRect();
  const visual = window.visualViewport;
  let viewport: CoverRect = { left: visual?.offsetLeft ?? 0, top: visual?.offsetTop ?? 0,
    right: (visual?.offsetLeft ?? 0) + (visual?.width ?? window.innerWidth),
    bottom: (visual?.offsetTop ?? 0) + (visual?.height ?? window.innerHeight) };
  const initialVisible = intersect(rect, viewport);
  const area = Math.max(0, rect.right - rect.left) * Math.max(0, rect.bottom - rect.top);
  const initialArea = Math.max(0, initialVisible.right - initialVisible.left) * Math.max(0, initialVisible.bottom - initialVisible.top);
  // 无限列表先做廉价视口剔除，仅可见候选读取祖先样式。
  if (!area || initialArea <= 0) return null;
  let clip: CoverRect = viewport;
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") return null;
    const box = parent.getBoundingClientRect();
    // 普通裁切只影响可见面积，不能把各卡片自己的中心当作列表中心。
    clip = intersect(clip, {
      left: /(auto|scroll|hidden|clip)/.test(style.overflowX) ? box.left : clip.left,
      right: /(auto|scroll|hidden|clip)/.test(style.overflowX) ? box.right : clip.right,
      top: /(auto|scroll|hidden|clip)/.test(style.overflowY) ? box.top : clip.top,
      bottom: /(auto|scroll|hidden|clip)/.test(style.overflowY) ? box.bottom : clip.bottom,
    });
    viewport = intersect(viewport, {
      left: /(auto|scroll)/.test(style.overflowX) ? box.left : viewport.left,
      right: /(auto|scroll)/.test(style.overflowX) ? box.right : viewport.right,
      top: /(auto|scroll)/.test(style.overflowY) ? box.top : viewport.top,
      bottom: /(auto|scroll)/.test(style.overflowY) ? box.bottom : viewport.bottom,
    });
  }
  const visible = intersect(rect, clip);
  // 卡片的整行链接覆盖图片，不算遮挡；弹层或其他内容覆盖中心时保守静态。
  if (document.elementFromPoint && visible.right > visible.left && visible.bottom > visible.top) {
    const top = document.elementFromPoint((visible.left + visible.right) / 2, (visible.top + visible.bottom) / 2);
    const card = node.closest("article") ?? node;
    if (!top || !card.contains(top)) return null;
  }
  return { rect, viewport, visible };
}

let sessionDataSaver: boolean | null = null;
let unpersistedDataSaver: boolean | null = null;
export function readCoverDataSaver(): boolean {
  if (unpersistedDataSaver !== null) return unpersistedDataSaver;
  try { return localStorage.getItem(COVER_DATA_SAVER_KEY) === "true"; } catch { return sessionDataSaver ?? true; }
}
export function setCoverDataSaver(enabled: boolean): void {
  sessionDataSaver = enabled;
  try { localStorage.setItem(COVER_DATA_SAVER_KEY, String(enabled)); unpersistedDataSaver = null; }
  catch { unpersistedDataSaver = enabled; }
  window.dispatchEvent(new CustomEvent(COVER_PREFERENCE_EVENT, { detail: enabled }));
}

type Entry = { node: HTMLElement; change: (active: boolean) => void };
export class CoverPlaybackController {
  private entries = new Map<symbol, Entry>();
  private active = new Map<symbol, { width: number; height: number; dpr: number }>();
  private frame: number | null = null;
  private nodeIds = new WeakMap<Element, symbol>();
  private intersecting = new Set<symbol>();
  private pending = new Set<symbol>();
  private dispose: (() => void) | null = null;
  private dataSaver = false;
  private reduced: MediaQueryList | null = null;
  private routeSuspended = false;
  private resize: ResizeObserver | null = null;
  private intersection: IntersectionObserver | null = null;
  private routeKey = "";

  register(node: HTMLElement, change: Entry["change"]): () => void {
    const id = Symbol(); this.entries.set(id, { node, change });
    this.nodeIds.set(node, id); this.pending.add(id);
    if (!this.dispose) this.start();
    this.resize?.observe(node); this.intersection?.observe(node); this.refresh();
    return () => {
      this.stop(id); this.entries.delete(id); this.nodeIds.delete(node); this.intersecting.delete(id); this.pending.delete(id);
      this.resize?.unobserve(node); this.intersection?.unobserve(node);
      if (!this.entries.size) { this.cancel(); this.dispose?.(); this.dispose = null; }
      else this.refresh();
    };
  }
  suspendRoute = (): void => { this.routeSuspended = true; this.cancel(); this.stopAll(); };
  resumeRoute = (): void => { this.routeKey = location.pathname + location.search; this.routeSuspended = false; this.refresh(); };
  private historyChanged = (): void => {
    if (location.pathname + location.search === this.routeKey) this.refresh();
    else this.suspendRoute();
  };
  private stop(id: symbol) {
    if (this.active.delete(id)) this.entries.get(id)?.change(false);
  }
  private stopAll() { for (const id of this.active.keys()) this.stop(id); }
  private cancel() { if (this.frame !== null) cancelAnimationFrame(this.frame); this.frame = null; }
  private blocked(): boolean {
    return !this.entries.size || this.routeSuspended || this.dataSaver || !!this.reduced?.matches
      || document.visibilityState === "hidden"
      || !!document.querySelector('[role="dialog"], [role="alertdialog"]');
  }
  /** 观察器与滚动事件每帧合并；没有停稳等待，持续可见的实例不会被中断。 */
  refresh = (): void => {
    if (this.blocked()) { this.cancel(); this.stopAll(); return; }
    if (this.frame === null) this.frame = requestAnimationFrame(this.measure);
  };
  private measure = (): void => {
    this.frame = null;
    if (this.blocked()) { this.stopAll(); return; }
    // 历史列表可累积很多卡片。IO维护候选，活动项仍需实测到完全离屏，新项不等首次IO回调。
    const ids = this.intersection ? new Set([...this.intersecting, ...this.active.keys(), ...this.pending]) : this.entries.keys();
    this.pending.clear();
    for (const id of ids) {
      const entry = this.entries.get(id); if (!entry) continue;
      const before = this.active.get(id), measurement = measureCover(entry.node);
      if (!measurement || !shouldPlayCover(measurement, !!before)) { this.stop(id); continue; }
      const { rect } = measurement;
      const next = { width: rect.right - rect.left, height: rect.bottom - rect.top, dpr: window.devicePixelRatio || 1 };
      if (before && before.width === next.width && before.height === next.height && before.dpr === next.dpr) continue;
      // 只重置实际尺寸/DPR变化的当前项；其他可见项及其动画时间线保持。
      if (before) this.stop(id);
      this.active.set(id, next); entry.change(true);
    }
  };
  private start() {
    this.routeKey = location.pathname + location.search;
    this.dataSaver = readCoverDataSaver();
    this.reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    const preference = (event: Event) => {
      this.dataSaver = event instanceof CustomEvent ? event.detail === true : readCoverDataSaver(); this.refresh();
    };
    const events = ["scroll", "resize", "visibilitychange", "focusin"];
    for (const name of events) window.addEventListener(name, this.refresh, { capture: true, passive: true });
    const stopPreference = subscribeCoverPreference(preference);
    window.addEventListener("pagehide", this.suspendRoute); window.addEventListener("pageshow", this.resumeRoute);
    window.addEventListener("popstate", this.historyChanged);
    this.reduced?.addEventListener("change", this.refresh);
    window.visualViewport?.addEventListener("resize", this.refresh); window.visualViewport?.addEventListener("scroll", this.refresh);
    this.resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(this.refresh);
    this.resize?.observe(document.documentElement);
    this.intersection = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = this.nodeIds.get(entry.target); if (!id) continue;
        if (entry.isIntersecting) this.intersecting.add(id); else this.intersecting.delete(id);
      }
      this.refresh();
    }, { threshold: [0, 0.5, 1] });
    const mutations = new MutationObserver(this.refresh);
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: ["class", "style", "role", "aria-hidden", "inert"] });
    this.dispose = () => {
      for (const name of events) window.removeEventListener(name, this.refresh, true);
      stopPreference(); window.removeEventListener("pagehide", this.suspendRoute); window.removeEventListener("pageshow", this.resumeRoute);
      window.removeEventListener("popstate", this.historyChanged);
      this.reduced?.removeEventListener("change", this.refresh);
      window.visualViewport?.removeEventListener("resize", this.refresh); window.visualViewport?.removeEventListener("scroll", this.refresh);
      this.resize?.disconnect(); this.resize = null; this.intersection?.disconnect(); this.intersection = null; mutations.disconnect();
    };
  }
}

export function subscribeCoverPreference(change: (event: Event) => void) {
  const storage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== COVER_DATA_SAVER_KEY) return;
    unpersistedDataSaver = null;
    change(event);
  };
  window.addEventListener("storage", storage);
  window.addEventListener(COVER_PREFERENCE_EVENT, change);
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener(COVER_PREFERENCE_EVENT, change);
  };
}

export const coverPlayback = new CoverPlaybackController();
