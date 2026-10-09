import { afterEach, expect, test, vi } from "vitest";

import { createContentSecurityPolicy } from "../src/lib/security-headers";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

test("普通开发未配置后端时拒绝启动，避免静默连接真实数据", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("BACKEND_URL", "");
  vi.resetModules();
  await expect(import("../next.config")).rejects.toThrow("显式设置 BACKEND_URL");
});

test("普通开发只代理显式后端，保留媒体策略和 Fast Refresh 连接", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("BACKEND_URL", "http://127.0.0.1:34123");
  vi.resetModules();
  const { default: config } = await import("../next.config");
  expect(await config.rewrites?.()).toEqual([
    { source: "/api/v1/:path*", destination: "http://127.0.0.1:34123/api/v1/:path*" },
  ]);
  const csp = createContentSecurityPolicy({ nonce: "development-test", isDevelopment: true });
  expect(csp).toContain("connect-src 'self' https://cn-nb1.rains3.com ws: wss:");
  expect(csp).toContain("script-src 'self' 'nonce-development-test' 'unsafe-eval'");
});

test.each([
  "WENYOU_PREVIEW_RUN",
  "WENYOU_PREVIEW_SESSION",
  "WENYOU_PREVIEW_SNAPSHOT",
  "WENYOU_PREVIEW_MEDIA_ORIGIN",
  "WENYOU_PREVIEW_SAMPLE",
  "WENYOU_PREVIEW_SOURCE_KIND",
  "NEXT_PUBLIC_WENYOU_PREVIEW_RUN",
  "NEXT_PUBLIC_WENYOU_PREVIEW_MEDIA_ORIGIN",
].flatMap((key) => ["", "legacy-session"].map((value) => ({ key, value }))))(
  "旧配置 $key=$value 明确拒绝启动，不回退普通模式",
  async ({ key, value }) => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BACKEND_URL", "http://127.0.0.1:34123");
    vi.stubEnv(key, value);
    vi.resetModules();
    await expect(import("../next.config")).rejects.toThrow("隔离开发预览已退役");
  },
);
