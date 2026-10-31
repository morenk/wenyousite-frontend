import { expect, test } from "vitest";
import { motionViolations } from "./motion-policy.mjs";

test.each([
  "transition-all", "transition-[width]", "duration-300", "duration-[150ms]",
  'transition={{ duration: 0.16, ease: [0, 0, 1, 1] }}',
  'element.animate?.([{ transform: "none" }], { duration: 140 })',
  'scrollIntoView({ behavior: "smooth" })',
])("拒绝局部动效绕过规范：%s", (source) => {
  expect(motionViolations(source, "component.tsx")).not.toEqual([]);
});
test("识别 CSS 硬编码而不误报真实等待、toast 与 Token", () => {
  expect(motionViolations("transition: opacity 180ms ease-out;", "audio.css")).not.toEqual([]);
  expect(motionViolations('duration-[var(--motion-fast)] transition={standardTransition}; toast({ duration: 10000 }); setTimeout(fn, 5000)', "component.tsx")).toEqual([]);
});
