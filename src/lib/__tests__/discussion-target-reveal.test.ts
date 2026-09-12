import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { startDiscussionTargetReveal } from "../discussion-target-reveal";

let resize: () => void;
let mutate: () => void;
let absoluteTop: number;
let y: number;
const unobserve = vi.fn();
const disconnect = vi.fn();
const sessions: ReturnType<typeof startDiscussionTargetReveal>[] = [];
const tick = () => vi.advanceTimersByTime(20);
const start = () => {
  const session = startDiscussionTargetReveal("target");
  sessions.push(session);
  tick();
  return session;
};
function target(height = 1800) {
  const element = document.createElement("section");
  element.id = "target";
  element.style.scrollMarginTop = "24px";
  element.getBoundingClientRect = () => new DOMRect(0, absoluteTop - y, 600, height);
  document.body.append(element);
  return element;
}

beforeEach(() => {
  vi.useFakeTimers();
  absoluteTop = 1200;
  y = 0;
  vi.spyOn(window, "scrollY", "get").mockImplementation(() => y);
  vi.spyOn(window, "innerHeight", "get").mockReturnValue(600);
  vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(12000);
  vi.spyOn(window, "scrollTo").mockImplementation((options: ScrollToOptions | number) => {
    if (typeof options === "object") y = options.top ?? y;
  });
  vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { resize = callback; }
    observe = vi.fn(); unobserve = unobserve; disconnect = disconnect;
  });
  vi.stubGlobal("MutationObserver", class {
    constructor(callback: () => void) { mutate = callback; }
    observe = vi.fn(); disconnect = disconnect;
  });
});
afterEach(() => {
  sessions.splice(0).forEach((session) => session.dispose());
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("讨论目标几何", () => {
  test.each([80, 600, 1800])("高度 %i 均从作者开头展示", (height) => {
    const element = target(height);
    start();
    expect(element.getBoundingClientRect().top).toBe(24);
    expect(element.scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
  });
  test("末尾短目标受自然底部限制，整页很短时不滚动", () => {
    absoluteTop = 11700;
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(11800);
    const element = target(80);
    start();
    expect(y).toBe(11200);
    expect(element.getBoundingClientRect().bottom).toBeLessThanOrEqual(600);
    absoluteTop = 100;
    y = 0;
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(300);
    resize(); tick();
    expect(y).toBe(0);
  });
  test("阅读栏延迟出现和高度改变时避让最终高度", () => {
    const element = target(); start();
    const anchor = document.createElement("div");
    anchor.dataset.slot = "thread-reading-bar-anchor"; anchor.style.top = "8px";
    const bar = document.createElement("nav"); bar.dataset.slot = "thread-reading-bar";
    const height = vi.spyOn(bar, "offsetHeight", "get").mockReturnValue(56);
    anchor.append(bar); document.body.prepend(anchor);
    mutate(); tick();
    expect(element.getBoundingClientRect().top).toBe(88);
    height.mockReturnValue(80); resize(); tick();
    expect(element.getBoundingClientRect().top).toBe(112);
    anchor.remove(); mutate(); tick();
    expect(element.getBoundingClientRect().top).toBe(24);
    expect(unobserve).toHaveBeenCalledWith(bar);
  });
  test("长楼中楼的收起悬浮入口不遮挡目标作者", () => {
    const element = target();
    const dock = document.createElement("div"); dock.dataset.slot = "moment-replies-collapse-dock";
    dock.style.top = "16px"; vi.spyOn(dock, "offsetHeight", "get").mockReturnValue(32);
    document.body.prepend(dock); start();
    expect(element.getBoundingClientRect().top).toBe(72);
    const unrelated = document.createElement("section");
    document.body.append(unrelated); unrelated.append(dock); mutate(); tick();
    expect(element.getBoundingClientRect().top).toBe(24);
  });
  test("前方图片撑高、分页插入和窗口变化后保持开头", () => {
    const element = target(); start();
    for (const notify of [resize, mutate, () => window.dispatchEvent(new Event("resize"))]) {
      absoluteTop += 400; notify(); tick();
      expect(element.getBoundingClientRect().top).toBe(24);
    }
    const calls = vi.mocked(window.scrollTo).mock.calls.length;
    resize(); mutate(); tick();
    expect(window.scrollTo).toHaveBeenCalledTimes(calls);
  });
  test.each(["wheel", "pointerdown", "touchstart", "keydown"])("%s 后不再自动拉回", (type) => {
    target(); const session = start(); const initial = y;
    window.dispatchEvent(new Event(type));
    absoluteTop += 500; resize(); mutate(); session.schedule(); tick();
    expect(y).toBe(initial);
    expect(disconnect).toHaveBeenCalled();
  });
  test("首次排队前用户接管、卸载和重新激活", () => {
    target(); const session = startDiscussionTargetReveal("target"); sessions.push(session);
    session.schedule(); window.dispatchEvent(new Event("wheel")); tick();
    expect(window.scrollTo).not.toHaveBeenCalled();
    session.dispose(); start(); expect(y).toBe(1176);
  });
  test("目标晚到时等待 DOM，目标移除后安全结束", () => {
    start(); expect(window.scrollTo).not.toHaveBeenCalled();
    const element = target(); mutate(); tick(); expect(y).toBe(1176);
    element.remove(); mutate(); tick(); expect(y).toBe(1176);
  });
  test("无观察器时仍能完成初始定位及窗口校准", () => {
    vi.stubGlobal("ResizeObserver", undefined); vi.stubGlobal("MutationObserver", undefined);
    const element = target(); element.style.scrollMarginTop = "auto"; start(); expect(y).toBe(1200);
    absoluteTop += 50; window.dispatchEvent(new Event("resize")); tick(); expect(y).toBe(1250);
  });
});
