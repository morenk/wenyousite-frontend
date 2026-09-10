import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { COVER_DATA_SAVER_KEY, CoverPlaybackController, measureCover, pickCover, readCoverDataSaver, setCoverDataSaver } from "../cover-playback";

const viewport = { left: 0, top: 0, right: 1000, bottom: 1000 };
const box = (top: number, bottom = top + 100) => ({ left: 400, right: 600, top, bottom });
let disposers: (() => void)[] = [];
let reduced: MediaQueryList;
let reducedChange: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear(); setCoverDataSaver(false);
  history.replaceState(null, "", "/");
  vi.stubGlobal("innerWidth", 1000); vi.stubGlobal("innerHeight", 1000);
  reduced = { matches: false, addEventListener: vi.fn((_event, listener) => { reducedChange = listener; }), removeEventListener: vi.fn() } as unknown as MediaQueryList;
  vi.stubGlobal("matchMedia", vi.fn(() => reduced));
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.spyOn(document, "elementFromPoint").mockImplementation(() => document.querySelector("article"));
});
afterEach(() => {
  disposers.forEach((dispose) => dispose()); disposers = [];
  document.body.innerHTML = ""; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

function node(top: number) {
  let article = document.querySelector("article");
  if (!article) { article = document.createElement("article"); document.body.append(article); }
  const element = document.createElement("div"); article.append(element);
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(box(top) as DOMRect);
  return element;
}
function register(controller: CoverPlaybackController, top: number) {
  const change = vi.fn();
  disposers.push(controller.register(node(top), change));
  return change;
}

describe("封面选中规则", () => {
  test("至少一半可见，中心最近；平距保留旧项，否则稳定顺序", () => {
    const a = Symbol(), b = Symbol(), c = Symbol();
    const candidate = (id: symbol, top: number, visible = box(top)) => ({ id, rect: box(top), visible, viewport });
    expect(pickCover([candidate(a, 400), candidate(b, 500)], null)).toBe(a);
    expect(pickCover([candidate(a, 400), candidate(b, 500)], b)).toBe(b);
    expect(pickCover([candidate(c, 450, box(501, 550)), candidate(a, 0)], null)).toBe(a);
    expect(pickCover([candidate(c, 450, box(500, 550))], null)).toBe(c);
    expect(pickCover([{ ...candidate(a, 400), rect: box(400, 400) }], null)).toBeNull();
  });
  test("有效视口裁切嵌套滚动容器并排除遮挡/隐藏/脱离节点", () => {
    const element = node(450);
    const parent = element.parentElement!;
    parent.style.overflowY = "auto";
    vi.spyOn(parent, "getBoundingClientRect").mockReturnValue({ ...viewport, top: 480, bottom: 900 } as DOMRect);
    expect(measureCover(element)?.visible.top).toBe(480);
    expect(measureCover(element)?.viewport.top).toBe(480);
    parent.style.visibility = "hidden";
    expect(measureCover(element)).toBeNull();
    parent.style.visibility = "visible";
    vi.mocked(document.elementFromPoint).mockReturnValue(document.body);
    expect(measureCover(element)).toBeNull();
    element.setAttribute("aria-hidden", "true");
    expect(measureCover(element)).toBeNull();
    element.remove();
    expect(measureCover(element)).toBeNull();
  });
});

test("独立overflow-hidden卡片的裁切区域不能替代屏幕中心", () => {
  const a = node(100), b = node(450);
  for (const element of [a, b]) {
    const crop = document.createElement("div");
    element.parentElement!.append(crop); crop.append(element);
    crop.style.overflowY = "hidden"; crop.style.overflowX = "hidden";
    vi.spyOn(crop, "getBoundingClientRect").mockReturnValue(element.getBoundingClientRect());
  }
  const idA = Symbol(), idB = Symbol();
  const ma = measureCover(a)!, mb = measureCover(b)!;
  expect(ma.viewport).toEqual(viewport);
  expect(mb.viewport).toEqual(viewport);
  expect(pickCover([{ id: idA, ...ma }, { id: idB, ...mb }], null)).toBe(idB);
});

test("离屏项先剔除，不读取无限列表所有祖先的样式", () => {
  const element = node(2000);
  const style = vi.spyOn(window, "getComputedStyle");
  expect(measureCover(element)).toBeNull();
  expect(style).not.toHaveBeenCalled();
});

describe("全局播放生命周期", () => {
  test("停稳120ms内无关候选持续注册不延后初次选择", () => {
    const controller = new CoverPlaybackController(); const current = register(controller, 450);
    for (let i = 0; i < 3; i++) { vi.advanceTimersByTime(30); register(controller, 2000 + i * 100); }
    vi.advanceTimersByTime(29); expect(current).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(current).toHaveBeenCalledExactlyOnceWith(true);
  });
  test("待播放期间无关ResizeObserver通知不能反复延后截止时间", () => {
    let resized = () => {};
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { resized = callback; }
      observe() {} unobserve() {} disconnect() {}
    });
    const controller = new CoverPlaybackController(); const current = register(controller, 450);
    for (let i = 0; i < 3; i++) { vi.advanceTimersByTime(30); resized(); }
    vi.advanceTimersByTime(30); expect(current).toHaveBeenCalledExactlyOnceWith(true);
  });
  test("真实滚动目标的scrollend短安静期后选择，其他容器及未滚动事件不能提前选择", () => {
    const controller = new CoverPlaybackController(); const current = register(controller, 450);
    window.dispatchEvent(new Event("scrollend"));
    expect(current).not.toHaveBeenCalled();
    const scroller = document.querySelector("article")!;
    scroller.dispatchEvent(new Event("scroll")); vi.advanceTimersByTime(40);
    window.dispatchEvent(new Event("scrollend")); expect(current).not.toHaveBeenCalled();
    scroller.dispatchEvent(new Event("scrollend")); vi.advanceTimersByTime(59); expect(current).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(current).toHaveBeenCalledExactlyOnceWith(true);
    vi.advanceTimersByTime(500); expect(current).toHaveBeenCalledExactlyOnceWith(true);
    scroller.dispatchEvent(new Event("scroll"));
    setCoverDataSaver(true); scroller.dispatchEvent(new Event("scrollend"));
    expect(current).toHaveBeenCalledTimes(2); expect(current).toHaveBeenLastCalledWith(false);
    disposers.pop()?.(); scroller.dispatchEvent(new Event("scrollend"));
    expect(current).toHaveBeenCalledTimes(2);
  });

  test("两个滚动容器必须各自结束；真实resize使旧scrollend失效", () => {
    const controller = new CoverPlaybackController(); const current = register(controller, 450);
    const a = document.querySelector("article")!, b = document.createElement("div"); document.body.append(b);
    a.dispatchEvent(new Event("scroll")); b.dispatchEvent(new Event("scroll"));
    a.dispatchEvent(new Event("scrollend")); expect(current).not.toHaveBeenCalled();
    b.dispatchEvent(new Event("scrollend")); vi.advanceTimersByTime(60); expect(current).toHaveBeenCalledExactlyOnceWith(true);
    a.dispatchEvent(new Event("scroll")); window.dispatchEvent(new Event("resize"));
    a.dispatchEvent(new Event("scrollend")); expect(current).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(120); expect(current).toHaveBeenLastCalledWith(true);
  });
  test("连续离散scrollend不能触发中途播放，晚到结束事件也不延后原截止时间", () => {
    const controller = new CoverPlaybackController(); const current = register(controller, 450);
    const scroller = document.querySelector("article")!;
    for (let i = 0; i < 20; i++) {
      scroller.dispatchEvent(new Event("scroll")); scroller.dispatchEvent(new Event("scrollend"));
      vi.advanceTimersByTime(40); expect(current).not.toHaveBeenCalled();
    }
    vi.advanceTimersByTime(20); expect(current).toHaveBeenCalledExactlyOnceWith(true);
    scroller.dispatchEvent(new Event("scroll")); vi.advanceTimersByTime(100);
    scroller.dispatchEvent(new Event("scrollend")); vi.advanceTimersByTime(20);
    expect(current).toHaveBeenCalledTimes(3); expect(current).toHaveBeenLastCalledWith(true);
  });
  test("wheel/touch与双容器scroll交织仍须有完整短安静期", () => {
    const controller = new CoverPlaybackController(); const current = register(controller, 450);
    const a = document.querySelector("article")!, b = document.createElement("div"); document.body.append(b);
    for (let i = 0; i < 12; i++) {
      a.dispatchEvent(new Event(i % 2 ? "touchmove" : "wheel"));
      a.dispatchEvent(new Event("scroll")); b.dispatchEvent(new Event("scroll"));
      a.dispatchEvent(new Event("scrollend")); vi.advanceTimersByTime(20);
      expect(current).not.toHaveBeenCalled();
      b.dispatchEvent(new Event("scrollend")); vi.advanceTimersByTime(20);
      expect(current).not.toHaveBeenCalled();
    }
    vi.advanceTimersByTime(79); expect(current).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(current).toHaveBeenCalledExactlyOnceWith(true);
  });
  test("80ms间隔离散wheel结束事件不能在连续输入中触发请求", () => {
    const controller = new CoverPlaybackController(); const current = register(controller, 450);
    const scroller = document.querySelector("article")!;
    for (let i = 0; i < 12; i++) {
      scroller.dispatchEvent(new Event("wheel")); scroller.dispatchEvent(new Event("scroll"));
      scroller.dispatchEvent(new Event("scrollend")); vi.advanceTimersByTime(80);
      expect(current).not.toHaveBeenCalled();
    }
    vi.advanceTimersByTime(39); expect(current).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(current).toHaveBeenCalledExactlyOnceWith(true);
  });
  test("分页追加或移除离屏卡片不重启仍合格的当前动画", () => {
    const controller = new CoverPlaybackController(); const current = register(controller, 450);
    vi.advanceTimersByTime(120); expect(current).toHaveBeenCalledExactlyOnceWith(true);
    const offscreen = register(controller, 2000);
    vi.advanceTimersByTime(120);
    expect(current).toHaveBeenCalledExactlyOnceWith(true);
    expect(offscreen).not.toHaveBeenCalled();
    disposers.pop()?.();
    vi.advanceTimersByTime(120); expect(current).toHaveBeenCalledExactlyOnceWith(true);
  });
  test("观察器无关布局不重启，选中封面实际尺寸变化立即停止并停稳重选", () => {
    let resized = () => {};
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { resized = callback; }
      observe() {} unobserve() {} disconnect() {}
    });
    const controller = new CoverPlaybackController();
    const element = node(450), change = vi.fn();
    disposers.push(controller.register(element, change));
    vi.advanceTimersByTime(120);
    resized(); vi.advanceTimersByTime(120);
    expect(change).toHaveBeenCalledExactlyOnceWith(true);
    vi.mocked(element.getBoundingClientRect).mockReturnValue({ ...box(450), right: 650 } as DOMRect);
    resized();
    expect(change).toHaveBeenLastCalledWith(false);
    vi.advanceTimersByTime(119); expect(change).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1); expect(change).toHaveBeenLastCalledWith(true);
  });
  test("初次读取存储失败保守静态，但用户仍可在当前会话关闭", async () => {
    vi.resetModules();
    const fresh = await import("../cover-playback");
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    expect(fresh.readCoverDataSaver()).toBe(true);
    fresh.setCoverDataSaver(false);
    expect(fresh.readCoverDataSaver()).toBe(false);
  });
  test("初始减少动态效果不会创建待播放任务，存储不可用仍支持当前页面省流量", () => {
    Object.assign(reduced, { matches: true });
    const controller = new CoverPlaybackController(); const change = register(controller, 450);
    vi.advanceTimersByTime(1000); expect(change).not.toHaveBeenCalled();
    Object.assign(reduced, { matches: false }); reducedChange?.();
    vi.advanceTimersByTime(120); expect(change).toHaveBeenLastCalledWith(true);
    vi.stubGlobal("localStorage", { setItem: () => { throw new Error("blocked"); }, getItem: () => { throw new Error("blocked"); } });
    setCoverDataSaver(true);
    expect(readCoverDataSaver()).toBe(true);
    expect(change).toHaveBeenLastCalledWith(false);
    setCoverDataSaver(false); vi.advanceTimersByTime(120);
    expect(change).toHaveBeenLastCalledWith(true);
  });
  test("移除当前项后重选；卸载等待中的最后一项不再回调", () => {
    const controller = new CoverPlaybackController();
    const a = register(controller, 100), b = register(controller, 450);
    vi.advanceTimersByTime(120); expect(b).toHaveBeenLastCalledWith(true);
    disposers.pop()?.(); expect(b).toHaveBeenLastCalledWith(false);
    vi.advanceTimersByTime(120); expect(a).toHaveBeenLastCalledWith(true);
    window.dispatchEvent(new Event("scroll"));
    disposers.pop()?.();
    vi.advanceTimersByTime(1000); expect(a).toHaveBeenCalledTimes(2);
  });
  test("首屏等待120ms，两个列表仍只选择一张；嵌套滚动立即停止并取消旧计时", () => {
    const controller = new CoverPlaybackController();
    const a = register(controller, 100), b = register(controller, 450);
    vi.advanceTimersByTime(119); expect(b).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(b).toHaveBeenLastCalledWith(true); expect(a).not.toHaveBeenCalled();
    document.querySelector("article")!.dispatchEvent(new Event("scroll"));
    expect(b).toHaveBeenLastCalledWith(false);
    vi.advanceTimersByTime(100);
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(119); expect(b).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1); expect(b).toHaveBeenLastCalledWith(true);
  });
  test("后台取消计时，回前台重新等待；reduced-motion变化立即停止", () => {
    const controller = new CoverPlaybackController(); const change = register(controller, 450);
    vi.advanceTimersByTime(100);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(1000); expect(change).not.toHaveBeenCalled();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(120); expect(change).toHaveBeenLastCalledWith(true);
    Object.assign(reduced, { matches: true }); reducedChange?.();
    expect(change).toHaveBeenLastCalledWith(false);
    vi.advanceTimersByTime(1000); expect(change).toHaveBeenCalledTimes(2);
  });
  test("初始省流量/reduced-motion不会闪播，偏好支持实时和跨标签同步", () => {
    localStorage.setItem(COVER_DATA_SAVER_KEY, "true");
    const controller = new CoverPlaybackController(); const change = register(controller, 450);
    vi.advanceTimersByTime(500); expect(change).not.toHaveBeenCalled();
    setCoverDataSaver(false); vi.advanceTimersByTime(120); expect(change).toHaveBeenLastCalledWith(true);
    localStorage.setItem(COVER_DATA_SAVER_KEY, "true"); window.dispatchEvent(new StorageEvent("storage"));
    expect(change).toHaveBeenLastCalledWith(false);
    expect(readCoverDataSaver()).toBe(true);
  });
  test("路由切换取消待播放；新页面提交前不因滚动恢复", () => {
    const controller = new CoverPlaybackController(); const change = register(controller, 450);
    vi.advanceTimersByTime(100); controller.suspendRoute();
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(1000); expect(change).not.toHaveBeenCalled();
    controller.resumeRoute(); vi.advanceTimersByTime(120); expect(change).toHaveBeenLastCalledWith(true);
    controller.suspendRoute(); expect(change).toHaveBeenLastCalledWith(false);
  });
  test("导航点击立即停止，当前URL及新标签点击不错误暂停", () => {
    const controller = new CoverPlaybackController(); const change = register(controller, 450);
    vi.advanceTimersByTime(120);
    const link = document.createElement("a"); document.body.append(link);
    link.addEventListener("click", (event) => event.preventDefault());
    link.href = window.location.href; link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(change).toHaveBeenCalledTimes(1);
    link.href = "/other"; link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true }));
    expect(change).toHaveBeenCalledTimes(1);
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(change).toHaveBeenLastCalledWith(false);
    vi.advanceTimersByTime(120);
    expect(change).toHaveBeenLastCalledWith(true);
  });
  test("hash或同URL历史变化不会永久暂停，真正路径变化等待提交", () => {
    const controller = new CoverPlaybackController(); const change = register(controller, 450);
    vi.advanceTimersByTime(120);
    history.pushState(null, "", "#cover"); window.dispatchEvent(new PopStateEvent("popstate"));
    expect(change).toHaveBeenLastCalledWith(false);
    vi.advanceTimersByTime(120); expect(change).toHaveBeenLastCalledWith(true);
    history.pushState({ foo: 1 }, "", "#cover"); window.dispatchEvent(new PopStateEvent("popstate"));
    vi.advanceTimersByTime(120); expect(change).toHaveBeenLastCalledWith(true);
    history.pushState(null, "", "/other"); window.dispatchEvent(new PopStateEvent("popstate"));
    vi.advanceTimersByTime(1000); expect(change).toHaveBeenLastCalledWith(false);
    controller.resumeRoute(); vi.advanceTimersByTime(120); expect(change).toHaveBeenLastCalledWith(true);
  });
  test("模态弹层打开时停止，关闭后重选；全部卸载不残留计时", async () => {
    const controller = new CoverPlaybackController(); const change = register(controller, 450);
    vi.advanceTimersByTime(120);
    const modal = document.createElement("div"); modal.setAttribute("role", "dialog"); document.body.append(modal);
    await vi.waitFor(() => expect(change).toHaveBeenLastCalledWith(false));
    vi.advanceTimersByTime(120); expect(change).toHaveBeenCalledTimes(2);
    modal.remove();
    await vi.waitFor(() => expect(vi.getTimerCount()).toBeGreaterThan(0));
    vi.advanceTimersByTime(120); expect(change).toHaveBeenLastCalledWith(true);
    disposers.pop()?.(); expect(change).toHaveBeenLastCalledWith(false);
    vi.advanceTimersByTime(1000); expect(change).toHaveBeenCalledTimes(4);
  });
});
