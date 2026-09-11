import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { COVER_DATA_SAVER_KEY, CoverPlaybackController, measureCover, shouldPlayCover, readCoverDataSaver, setCoverDataSaver } from "../cover-playback";
const viewport = { left: 0, top: 0, right: 1000, bottom: 1000 };
const box = (top: number, bottom = top + 100) => ({ left: 400, right: 600, top, bottom });
let disposers: (() => void)[] = [];
let reduced: MediaQueryList;
let reducedChange: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear(); setCoverDataSaver(false); history.replaceState(null, "", "/");
  vi.stubGlobal("innerWidth", 1000); vi.stubGlobal("innerHeight", 1000);
  // happy-dom的默认IO不派发可见性事件；普通用例验证无IO回退，专门IO用例显式投递事件。
  vi.stubGlobal("IntersectionObserver", undefined);
  reduced = { matches: false, addEventListener: vi.fn((_event, listener) => { reducedChange = listener; }), removeEventListener: vi.fn() } as unknown as MediaQueryList;
  vi.stubGlobal("matchMedia", vi.fn(() => reduced));
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.spyOn(document, "elementFromPoint").mockImplementation(() => document.querySelector("article"));
});
afterEach(() => {
  disposers.forEach((dispose) => dispose()); disposers = []; document.body.innerHTML = "";
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});
function node(top: number) {
  let article = document.querySelector("article");
  if (!article) { article = document.createElement("article"); document.body.append(article); }
  const element = document.createElement("div"); article.append(element);
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(box(top) as DOMRect); return element;
}
function register(controller: CoverPlaybackController, top: number) {
  const change = vi.fn(), element = node(top); disposers.push(controller.register(element, change)); return { change, element };
}
const frame = () => vi.advanceTimersByTime(17);
describe("可见性与滞回", () => {
  test("50%含边界进入，已播放只需>0，零面积拒绝", () => {
    const candidate = (visible: ReturnType<typeof box>) => ({ rect: box(450), visible, viewport });
    expect(shouldPlayCover(candidate(box(500, 550)), false)).toBe(true);
    expect(shouldPlayCover(candidate(box(501, 550)), false)).toBe(false);
    expect(shouldPlayCover(candidate(box(549, 550)), true)).toBe(true);
    expect(shouldPlayCover(candidate(box(550, 550)), true)).toBe(false);
    expect(shouldPlayCover({ ...candidate(box(450)), rect: box(450, 450) }, true)).toBe(false);
  });
  test("嵌套滚动容器裁切保留小于一半但非零可见，遮挡/隐藏/脱离均拒绝", () => {
    const element = node(450), parent = element.parentElement!; parent.style.overflowY = "auto";
    vi.spyOn(parent, "getBoundingClientRect").mockReturnValue({ ...viewport, top: 549, bottom: 900 } as DOMRect);
    expect(measureCover(element)?.visible.top).toBe(549);
    expect(shouldPlayCover(measureCover(element)!, true)).toBe(true);
    parent.style.visibility = "hidden"; expect(measureCover(element)).toBeNull(); parent.style.visibility = "visible";
    vi.mocked(document.elementFromPoint).mockReturnValue(document.body); expect(measureCover(element)).toBeNull();
    element.setAttribute("aria-hidden", "true"); expect(measureCover(element)).toBeNull(); element.remove(); expect(measureCover(element)).toBeNull();
  });
  test("完全离屏先剔除，不读取无限列表所有祖先样式", () => {
    const element = node(2000), style = vi.spyOn(window, "getComputedStyle"); expect(measureCover(element)).toBeNull(); expect(style).not.toHaveBeenCalled();
  });
});
describe("所有可见项同时播放", () => {
  test("露出一半的12项下一帧同时激活，没有停稳或数量上限", () => {
    const controller = new CoverPlaybackController(); const entries = Array.from({ length: 12 }, () => register(controller, 450));
    expect(entries.every(({ change }) => change.mock.calls.length === 0)).toBe(true); frame();
    for (const { change } of entries) expect(change).toHaveBeenCalledExactlyOnceWith(true);
    for (let i = 0; i < 20; i++) { window.dispatchEvent(new Event("scroll")); frame(); }
    for (const { change } of entries) expect(change).toHaveBeenCalledExactlyOnceWith(true);
  });
  test("保持1%可见不重建，完全离屏退出，49%重入不播直到50%", () => {
    const controller = new CoverPlaybackController(); const { element, change } = register(controller, 950); frame();
    expect(change).toHaveBeenCalledExactlyOnceWith(true);
    const move = (top: number) => { vi.mocked(element.getBoundingClientRect).mockReturnValue(box(top) as DOMRect); window.dispatchEvent(new Event("scroll")); frame(); };
    move(999); expect(change).toHaveBeenCalledTimes(1); move(1000); expect(change).toHaveBeenLastCalledWith(false);
    move(951); expect(change).toHaveBeenCalledTimes(2); move(950); expect(change).toHaveBeenLastCalledWith(true); expect(change).toHaveBeenCalledTimes(3);
  });
  test("分页注册/移除及无关布局不重启其他活动项，只有尺寸变化的项重启", () => {
    let resized = () => {}; vi.stubGlobal("ResizeObserver", class { constructor(callback: () => void) { resized = callback; } observe() {} unobserve() {} disconnect() {} });
    const controller = new CoverPlaybackController(); const a = register(controller, 100), b = register(controller, 450); frame();
    register(controller, 2000); resized(); frame(); disposers.pop()?.(); frame();
    expect(a.change).toHaveBeenCalledExactlyOnceWith(true); expect(b.change).toHaveBeenCalledExactlyOnceWith(true);
    vi.mocked(a.element.getBoundingClientRect).mockReturnValue({ ...box(100), right: 700 } as DOMRect); resized(); frame();
    expect(a.change.mock.calls).toEqual([[true], [false], [true]]); expect(b.change).toHaveBeenCalledExactlyOnceWith(true);
  });
  test("IntersectionObserver触发可见性变化并合并单帧，卸载清理观察器", () => {
    let intersected: (entries: { target: Element; isIntersecting: boolean }[]) => void = () => {}; const disconnect = vi.fn();
    vi.stubGlobal("IntersectionObserver", class { constructor(callback: typeof intersected) { intersected = callback; } observe() {} unobserve() {} disconnect = disconnect; });
    const controller = new CoverPlaybackController(); const { element, change } = register(controller, 2000); frame(); expect(change).not.toHaveBeenCalled();
    vi.mocked(element.getBoundingClientRect).mockReturnValue(box(450) as DOMRect); intersected([{ target: element, isIntersecting: true }]); intersected([{ target: element, isIntersecting: true }]); frame(); expect(change).toHaveBeenCalledExactlyOnceWith(true);
    disposers.pop()?.(); expect(change).toHaveBeenLastCalledWith(false); expect(disconnect).toHaveBeenCalledOnce(); intersected([{ target: element, isIntersecting: true }]); frame(); expect(change).toHaveBeenCalledTimes(2);
  });
  test("IO维护1000历史卡片候选，初次回调前测新项，滚动不再逐项读取离屏几何", () => {
    let notify: (entries: { target: Element; isIntersecting: boolean }[]) => void = () => {};
    vi.stubGlobal("IntersectionObserver", class { constructor(callback: typeof notify) { notify = callback; } observe() {} unobserve() {} disconnect() {} });
    const controller = new CoverPlaybackController(); const current = register(controller, 450);
    const history = Array.from({ length: 1000 }, (_, i) => register(controller, 2000 + i * 100));
    frame(); expect(current.change).toHaveBeenCalledExactlyOnceWith(true);
    notify([{ target: current.element, isIntersecting: true }, ...history.map(({ element }) => ({ target: element, isIntersecting: false }))]); frame();
    for (const { element } of history) vi.mocked(element.getBoundingClientRect).mockClear();
    window.dispatchEvent(new Event("scroll")); frame();
    expect(history.reduce((n, { element }) => n + vi.mocked(element.getBoundingClientRect).mock.calls.length, 0)).toBe(0);
    vi.mocked(history[0].element.getBoundingClientRect).mockReturnValue(box(100) as DOMRect);
    notify([{ target: history[0].element, isIntersecting: true }]); frame(); expect(history[0].change).toHaveBeenCalledExactlyOnceWith(true);
    vi.mocked(current.element.getBoundingClientRect).mockReturnValue(box(2000) as DOMRect);
    notify([{ target: current.element, isIntersecting: false }]); frame(); expect(current.change).toHaveBeenLastCalledWith(false);
  });
  test("卸载待测量的最后一项不会留下回调", () => {
    const controller = new CoverPlaybackController(); const { change } = register(controller, 450); disposers.pop()?.(); frame(); expect(change).not.toHaveBeenCalled();
  });
});
describe("全局暂停边界", () => {
  test("隐藏Tab立即停止全部，恢复后下一帧重新按可见性进入", () => {
    const controller = new CoverPlaybackController(); const a = register(controller, 100), b = register(controller, 450); frame();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden"); document.dispatchEvent(new Event("visibilitychange"));
    expect(a.change).toHaveBeenLastCalledWith(false); expect(b.change).toHaveBeenLastCalledWith(false); frame();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible"); document.dispatchEvent(new Event("visibilitychange")); frame();
    expect(a.change).toHaveBeenLastCalledWith(true); expect(b.change).toHaveBeenLastCalledWith(true);
  });
  test("初始省流量/reduced motion不闪播，实时与跨标签切换停止全部", () => {
    localStorage.setItem(COVER_DATA_SAVER_KEY, "true"); const controller = new CoverPlaybackController(); const { change } = register(controller, 450); frame(); expect(change).not.toHaveBeenCalled();
    setCoverDataSaver(false); frame(); expect(change).toHaveBeenLastCalledWith(true);
    Object.assign(reduced, { matches: true }); reducedChange?.(); expect(change).toHaveBeenLastCalledWith(false);
    Object.assign(reduced, { matches: false }); reducedChange?.(); frame(); expect(change).toHaveBeenLastCalledWith(true);
    localStorage.setItem(COVER_DATA_SAVER_KEY, "true"); window.dispatchEvent(new StorageEvent("storage")); expect(change).toHaveBeenLastCalledWith(false);
  });
  test("首读存储失败保守静态，写失败仍支持当前会话关闭", async () => {
    vi.resetModules(); const fresh = await import("../cover-playback");
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    expect(fresh.readCoverDataSaver()).toBe(true); fresh.setCoverDataSaver(false); expect(fresh.readCoverDataSaver()).toBe(false);
  });
  test("存储不可写时本会话省流量仍立即生效", () => {
    const controller = new CoverPlaybackController(); const { change } = register(controller, 450); frame();
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    setCoverDataSaver(true); expect(readCoverDataSaver()).toBe(true); expect(change).toHaveBeenLastCalledWith(false);
    setCoverDataSaver(false); frame(); expect(change).toHaveBeenLastCalledWith(true);
  });
  test("路由提交前即使scroll也不能恢复，提交后下一帧激活", () => {
    const controller = new CoverPlaybackController(); const { change } = register(controller, 450); frame(); controller.suspendRoute(); expect(change).toHaveBeenLastCalledWith(false);
    window.dispatchEvent(new Event("scroll")); frame(); expect(change).toHaveBeenCalledTimes(2); controller.resumeRoute(); frame(); expect(change).toHaveBeenLastCalledWith(true);
  });
  test("hash历史变化保留持续播放，真正路径变化暂停到提交", () => {
    const controller = new CoverPlaybackController(); const { change } = register(controller, 450); frame(); history.pushState(null, "", "#cover"); window.dispatchEvent(new PopStateEvent("popstate")); frame();
    expect(change).toHaveBeenCalledExactlyOnceWith(true); history.pushState(null, "", "/other"); window.dispatchEvent(new PopStateEvent("popstate")); expect(change).toHaveBeenLastCalledWith(false);
    frame(); expect(change).toHaveBeenCalledTimes(2); controller.resumeRoute(); frame(); expect(change).toHaveBeenLastCalledWith(true);
  });
  test("遮罩打开立即停止全部，关闭观察器回调后下一帧重新进入", () => {
    let mutated = () => {};
    vi.stubGlobal("MutationObserver", class { constructor(callback: () => void) { mutated = callback; } observe() {} disconnect() {} });
    const controller = new CoverPlaybackController(); const { change } = register(controller, 450); frame();
    const modal = document.createElement("div"); modal.setAttribute("role", "dialog"); document.body.append(modal); mutated();
    expect(change).toHaveBeenLastCalledWith(false); modal.remove(); mutated(); frame(); expect(change).toHaveBeenLastCalledWith(true);
  });
});
