import { describe, expect, test } from "vitest";
import { assertAudioMediaPolicy } from "./audio-csp-smoke.mjs";

const response = (csp?: string) => ({
  ok: () => true,
  headers: () => csp ? { "content-security-policy": csp } : {},
});
const allowed = "media-src 'self' blob: https://cn-nb1.rains3.com";
describe("只读烟雾检查实际页面音频许可", () => {
  test("接受固定媒体源", () => {
    expect(() => assertAudioMediaPolicy(response(allowed))).not.toThrow();
  });
  test.each([undefined, "default-src 'self'", "media-src 'self' blob:",
    "media-src 'self' blob: https:", allowed + " https://example.com",
    allowed + ", media-src 'self' blob:"])("拒绝缺失、收紧或过宽的策略 %s", (csp) => {
    expect(() => assertAudioMediaPolicy(response(csp))).toThrow();
  });
});
