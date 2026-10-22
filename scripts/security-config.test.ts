import { afterEach, describe, expect, test, vi } from "vitest";

import { NextRequest } from "next/server";

import nextConfig from "../next.config";
import { createContentSecurityPolicy } from "../src/lib/security-headers";

describe("Next.js 安全响应头", () => {
  test("所有页面启用 CSP、反嗅探、反嵌入和权限限制", async () => {
    const entries = await nextConfig.headers?.();
    const headers = new Map(entries?.[0]?.headers.map(({ key, value }) => [key, value]));

    expect(entries?.[0]?.source).toBe("/(.*)");
    expect(headers.get("Content-Security-Policy")).toBeUndefined();
    const csp = createContentSecurityPolicy({ nonce: "unit-test-nonce", isDevelopment: false });
    expect(csp).toContain("script-src 'self' 'nonce-unit-test-nonce'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain(
      "img-src 'self' data: blob: https://cn-nb1.rains3.com",
    );
    expect(csp).toContain(
      "connect-src 'self' https://cn-nb1.rains3.com",
    );
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
  });
});

describe("音频 CSP", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  test.each([false, true])("开发模式 %s 仅许可固定媒体源", (isDevelopment) => {
    const csp = createContentSecurityPolicy({ nonce: "audio-test", isDevelopment });
    expect(csp.split("; ").find((directive) => directive.startsWith("media-src ")))
      .toBe("media-src 'self' blob: https://cn-nb1.rains3.com");
  });

  test.each(["production", "development"])("%s 页面响应和 SSR 请求使用相同音频 CSP", async (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    vi.resetModules();
    const { middleware } = await import("../middleware");
    const response = middleware(new NextRequest("https://wenyou.site/threads/test"));
    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toContain("media-src 'self' blob: https://cn-nb1.rains3.com");
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
  });
});

test("字体资源仅放行自有 HTTPS 连接，直接 URL 字体仍受原 font-src 约束", () => {
  const csp = createContentSecurityPolicy({ nonce: "font-test", isDevelopment: false });
  expect(csp.split("; ").find(value => value.startsWith("connect-src "))).toBe("connect-src 'self' https://cn-nb1.rains3.com https://wenyou.site https://*.wenyou.site");
  expect(csp.split("; ").find(value => value.startsWith("font-src "))).toBe("font-src 'self' data:");
});
