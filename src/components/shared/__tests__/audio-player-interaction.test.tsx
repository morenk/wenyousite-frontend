import { StrictMode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AudioPlayer } from "../audio-player";
vi.mock("next/navigation", () => ({ usePathname: () => "/threads/audio" }));
const media = { sourceUrl: "https://bucket.example/audio.mp3", mediaId: "audio", contentType: "audio/mpeg" as const, size: 1024, durationMs: 30000 };
beforeEach(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function () { this.dispatchEvent(new Event("pause")); });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function () { this.dispatchEvent(new Event("playing")); return Promise.resolve(); });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function ready() {
  const view = render(<AudioPlayer media={media}>很长的音频标签</AudioPlayer>);
  const audio = view.container.querySelector("audio")!;
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "播放" })); });
  Object.defineProperty(audio, "readyState", { configurable: true, value: 1 }); fireEvent.loadedMetadata(audio);
  audio.currentTime = 3; fireEvent.timeUpdate(audio);
  return { audio, slider: screen.getByRole("slider"), frame: view.container.firstElementChild! };
}
test("聚焦进度不加载音源，初始仍禁用 seek", () => {
  const view = render(<AudioPlayer media={media}>音频</AudioPlayer>);
  fireEvent.focus(screen.getByRole("slider"));
  expect(screen.getByRole("slider")).toBeDisabled(); expect(view.container.querySelector("audio")).not.toHaveAttribute("src");
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
});
test("拖动即时显示目标，松手后的旧事件也不能回弹", async () => {
  const { audio, slider, frame } = await ready();
  fireEvent.pointerDown(slider, { button: 0, pointerId: 1 }); fireEvent.change(slider, { target: { value: "20" } });
  expect(frame).toHaveAttribute("data-dragging", "true"); expect(audio.currentTime).toBe(3);
  audio.currentTime = 4; fireEvent.timeUpdate(audio); expect(slider).toHaveValue("20"); expect(slider).toHaveAttribute("aria-valuetext", "0:20 / 0:30");
  fireEvent.pointerUp(slider, { pointerId: 1 }); expect(audio.currentTime).toBe(20); expect(frame).toHaveAttribute("data-dragging", "false");
  audio.currentTime = 4; fireEvent.timeUpdate(audio); fireEvent.seeked(audio); expect(slider).toHaveValue("20");
  audio.currentTime = 20; fireEvent.seeked(audio); audio.currentTime = 21; fireEvent.timeUpdate(audio); expect(slider).toHaveValue("21");
});
for (const cancel of ["pointerCancel", "lostPointerCapture", "blur"] as const) test(`${cancel} 取消拖动并恢复实际进度`, async () => {
  const { audio, slider, frame } = await ready();
  fireEvent.pointerDown(slider, { button: 0, pointerId: 1 }); fireEvent.change(slider, { target: { value: "20" } });
  audio.currentTime = 5; fireEvent.timeUpdate(audio); fireEvent[cancel](slider);
  expect(slider).toHaveValue("5"); expect(audio.currentTime).toBe(5); expect(frame).toHaveAttribute("data-dragging", "false");
});
test("键盘跳转等待当前 seek，暂停和结束取真实位置", async () => {
  const { audio, slider, frame } = await ready();
  fireEvent.focus(slider); fireEvent.change(slider, { target: { value: "15" } }); expect(audio.currentTime).toBe(15);
  audio.currentTime = 3; fireEvent.timeUpdate(audio); expect(slider).toHaveValue("15");
  audio.currentTime = 15; fireEvent.seeked(audio); audio.currentTime = 16; fireEvent.pause(audio);
  expect(slider).toHaveValue("16"); expect(frame).toHaveAttribute("data-playing", "false");
  audio.currentTime = 30; fireEvent.ended(audio); expect(slider).toHaveValue("30");
});
test("离屏只关闭视觉过渡，后台仍解除音源且不自动恢复", async () => {
  let observe: IntersectionObserverCallback = () => {};
  vi.stubGlobal("IntersectionObserver", class { constructor(callback: IntersectionObserverCallback) { observe = callback; } observe() {} disconnect() {} });
  const { audio, frame } = await ready(); const pauseCalls = vi.mocked(HTMLMediaElement.prototype.pause).mock.calls.length;
  act(() => observe([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
  expect(frame).toHaveAttribute("data-visual-motion", "off"); expect(audio).toHaveAttribute("src"); expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(pauseCalls);
  act(() => observe([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)); expect(frame).toHaveAttribute("data-visual-motion", "on");
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); fireEvent(document, new Event("visibilitychange"));
  expect(frame).toHaveAttribute("data-visual-motion", "off"); expect(audio).not.toHaveAttribute("src");
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); fireEvent(document, new Event("visibilitychange"));
  expect(audio).not.toHaveAttribute("src"); expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
});

test("偏移 seeked 有界后恢复原生位置，不永久停在目标", async () => {
  const { audio, slider } = await ready(); vi.useFakeTimers();
  fireEvent.change(slider, { target: { value: "15" } });
  audio.currentTime = 15.7; fireEvent.seeked(audio); expect(slider).toHaveValue("15");
  act(() => vi.advanceTimersByTime(750)); expect(slider).toHaveValue("15.7");
  audio.currentTime = 16; fireEvent.timeUpdate(audio); expect(slider).toHaveValue("16");
});
test("切换到另一个播放器时清理拖动目标", async () => {
  const { audio, slider, frame } = await ready();
  fireEvent.pointerDown(slider, { button: 0, pointerId: 1 }); fireEvent.change(slider, { target: { value: "20" } });
  render(<AudioPlayer media={{ ...media, sourceUrl: "https://bucket.example/second.mp3", mediaId: "second" }}>第二段</AudioPlayer>);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "播放" })); });
  expect(frame).toHaveAttribute("data-dragging", "false"); expect(slider).toHaveValue("3");
  fireEvent.pointerUp(slider); expect(audio.currentTime).toBe(3);
});

test("严格模式重复挂载不会把可见播放器留在后台视觉状态", () => {
  const view = render(<StrictMode><AudioPlayer media={media}>音频</AudioPlayer></StrictMode>);
  expect(view.container.firstElementChild).toHaveAttribute("data-visual-motion", "on");
  expect(view.container.querySelector("audio")).not.toHaveAttribute("src");
});
