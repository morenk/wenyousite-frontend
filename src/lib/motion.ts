import foundation from "@wenyousite/foundation/contract";

/** JS 动效与 CSS Token 共用已发布 Foundation；秒值仅用于 Framer Motion。 */
export const motionTokens = foundation.motion;
export const standardTransition = {
  duration: motionTokens.standardMs / 1000,
  ease: motionTokens.standardEase.slice("cubic-bezier(".length, -1).split(",").map(Number) as [number, number, number, number],
};

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function readingScrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "instant" : "smooth";
}

/** 后台不消耗持续状态动画；恢复时仍显示当前真实任务状态。 */
export function observeMotionVisibility() {
  const update = () => { document.documentElement.toggleAttribute("data-motion-paused", document.visibilityState === "hidden"); };
  update();
  document.addEventListener("visibilitychange", update);
  return () => {
    document.removeEventListener("visibilitychange", update);
    document.documentElement.removeAttribute("data-motion-paused");
  };
}
