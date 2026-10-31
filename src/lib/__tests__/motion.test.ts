import { afterEach, expect, test, vi } from "vitest";
import foundation from "@wenyousite/foundation/contract";
import { motionTokens, observeMotionVisibility, readingScrollBehavior, standardTransition } from "../motion";

afterEach(() => vi.restoreAllMocks());
test("JS 过渡直接消费锁定契约，滚动在减少动画时立即完成", () => {
  expect(motionTokens).toEqual(foundation.motion);
  expect(standardTransition.duration * 1000).toBe(foundation.motion.standardMs);
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
  expect(readingScrollBehavior()).toBe("instant");
  vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
  expect(readingScrollBehavior()).toBe("smooth");
});
test("后台暂停、恢复并释放监听", () => {
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  const dispose = observeMotionVisibility();
  expect(document.documentElement).toHaveAttribute("data-motion-paused");
  visibility.mockReturnValue("visible");
  document.dispatchEvent(new Event("visibilitychange"));
  expect(document.documentElement).not.toHaveAttribute("data-motion-paused");
  dispose();
  visibility.mockReturnValue("hidden");
  document.dispatchEvent(new Event("visibilitychange"));
  expect(document.documentElement).not.toHaveAttribute("data-motion-paused");
});
