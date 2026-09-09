/** 列表封面共享调度：任何时刻至多一个动画实例，滚动时撤销加载。 */
export const COVER_SETTLE_MS = 300;
export const COVER_DATA_SAVER_KEY = "wenyou:cover-data-saver";
export const COVER_PREFERENCE_EVENT = "wenyou:cover-preference";

export interface CoverRect { left: number; top: number; right: number; bottom: number }
export interface CoverCandidate { id: symbol; rect: CoverRect; viewport: CoverRect; visible: CoverRect }

export function pickCover(candidates: CoverCandidate[], previous: symbol | null): symbol | null {
  let selected: symbol | null = null;
  let best = Infinity;
  for (const { id, rect, viewport, visible } of candidates) {
    const area = Math.max(0, rect.right - rect.left) * Math.max(0, rect.bottom - rect.top);
    const visibleArea = Math.max(0, visible.right - visible.left) * Math.max(0, visible.bottom - visible.top);
    if (!area || visibleArea / area < 0.5) continue;
    const distance = Math.hypot(
      (rect.left + rect.right - viewport.left - viewport.right) / 2,
      (rect.top + rect.bottom - viewport.top - viewport.bottom) / 2,
    );
    if (distance < best || (distance === best && id === previous)) {
      best = distance;
      selected = id;
    }
  }
  return selected;
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
  if (!area || initialArea / area < 0.5) return null;
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
  private active: symbol | null = null;
  private activeSize: { width: number; height: number } | null = null;
  private previous: symbol | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dispose: (() => void) | null = null;
  private dataSaver = false;
  private reduced: MediaQueryList | null = null;
  private routeSuspended = false;
  private resize: ResizeObserver | null = null;
  private routeKey = "";

  register(node: HTMLElement, change: Entry["change"]): () => void {
    const id = Symbol();
    this.entries.set(id, { node, change });
    if (!this.dispose) this.start();
    this.resize?.observe(node);
    this.reconsider();
    return () => {
      if (this.active === id) this.activate(null);
      this.entries.delete(id);
      this.resize?.unobserve(node);
      if (!this.entries.size) { this.cancel(); this.dispose?.(); this.dispose = null; this.previous = null; }
      else this.reconsider();
    };
  }

  /** 导航提交前暂停旧页面；提交后重新等待停稳。 */
  suspendRoute = (): void => { this.routeSuspended = true; this.cancel(); this.activate(null); };
  resumeRoute = (): void => { this.routeKey = location.pathname + location.search; this.routeSuspended = false; this.settle(); };
  private historyChanged = (): void => {
    if (location.pathname + location.search === this.routeKey) this.settle();
    else this.suspendRoute();
  };

  private activate(id: symbol | null) {
    if (id === this.active) return;
    if (this.active) this.entries.get(this.active)?.change(false);
    this.active = id;
    this.activeSize = null;
    if (id) {
      this.previous = id;
      const entry = this.entries.get(id);
      const rect = entry?.node.getBoundingClientRect();
      if (rect) this.activeSize = { width: rect.right - rect.left, height: rect.bottom - rect.top };
      entry?.change(true);
    }
  }
  private cancel() { if (this.timer !== null) clearTimeout(this.timer); this.timer = null; }
  settle = (): void => { this.schedule(true); };
  private reconsider = (): void => { this.schedule(false); };
  private schedule(interrupt: boolean): void {
    this.cancel();
    if (interrupt) this.activate(null);
    if (!this.entries.size || this.routeSuspended || this.dataSaver || this.reduced?.matches || document.visibilityState === "hidden") {
      this.activate(null);
      return;
    }
    if (this.active) {
      const entry = this.entries.get(this.active);
      const measurement = entry && measureCover(entry.node);
      const resized = measurement && this.activeSize
        && (measurement.rect.right - measurement.rect.left !== this.activeSize.width
          || measurement.rect.bottom - measurement.rect.top !== this.activeSize.height);
      if (!measurement || resized || !pickCover([{ id: this.active, ...measurement }], this.active)) this.activate(null);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      const candidates: CoverCandidate[] = [];
      for (const [id, entry] of this.entries) {
        const measurement = measureCover(entry.node);
        if (measurement) candidates.push({ id, ...measurement });
      }
      this.activate(pickCover(candidates, this.previous));
    }, COVER_SETTLE_MS);
  }

  private start() {
    this.routeKey = location.pathname + location.search;
    this.dataSaver = readCoverDataSaver();
    this.reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    const preference = (event: Event) => {
      this.dataSaver = event instanceof CustomEvent ? event.detail === true : readCoverDataSaver();
      this.settle();
    };
    const navigation = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]");
      if (!(event instanceof MouseEvent) || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (link && link.getAttribute("target") !== "_blank") {
        const url = new URL(link.getAttribute("href")!, window.location.href);
        if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search) this.settle();
      }
    };
    const events = ["scroll", "wheel", "touchmove", "resize", "visibilitychange", "focusin"];
    for (const name of events) window.addEventListener(name, this.settle, { capture: true, passive: true });
    const stopPreference = subscribeCoverPreference(preference);
    window.addEventListener("pagehide", this.suspendRoute);
    window.addEventListener("pageshow", this.resumeRoute);
    window.addEventListener("popstate", this.historyChanged);
    document.addEventListener("click", navigation, true);
    this.reduced?.addEventListener("change", this.settle);
    window.visualViewport?.addEventListener("resize", this.settle);
    window.visualViewport?.addEventListener("scroll", this.settle);
    const resize = this.resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(this.reconsider);
    resize?.observe(document.documentElement);
    let dialogPresent = !!document.querySelector('[role="dialog"], [role="alertdialog"]');
    const mutations = new MutationObserver(() => {
      const next = !!document.querySelector('[role="dialog"], [role="alertdialog"]');
      if (next !== dialogPresent) { dialogPresent = next; this.settle(); }
    });
    mutations.observe(document.body, { childList: true, subtree: true });
    this.dispose = () => {
      for (const name of events) window.removeEventListener(name, this.settle, true);
      stopPreference();
      window.removeEventListener("pagehide", this.suspendRoute);
      window.removeEventListener("pageshow", this.resumeRoute);
      window.removeEventListener("popstate", this.historyChanged);
      document.removeEventListener("click", navigation, true);
      this.reduced?.removeEventListener("change", this.settle);
      window.visualViewport?.removeEventListener("resize", this.settle);
      window.visualViewport?.removeEventListener("scroll", this.settle);
      resize?.disconnect(); this.resize = null; mutations.disconnect();
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
