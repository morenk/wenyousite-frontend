import { describe, expect, test } from "vitest";
import nextConfig from "../next.config";

describe("Next.js 安全响应头", () => {
  test("所有页面启用 CSP、反嗅探、反嵌入和权限限制", async () => {
    const entries = await nextConfig.headers?.();
    const headers = new Map(entries?.[0]?.headers.map(({ key, value }) => [key, value]));

    expect(entries?.[0]?.source).toBe("/(.*)");
    expect(headers.get("Content-Security-Policy")).toContain("object-src 'none'");
    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("Content-Security-Policy")).toMatch(/script-src 'self' 'sha256-[^']+'/);
    expect(headers.get("Content-Security-Policy")).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(headers.get("Content-Security-Policy")).toContain(
      "img-src 'self' data: blob: https://cn-nb1.rains3.com",
    );
    expect(headers.get("Content-Security-Policy")).toContain(
      "connect-src 'self' https://cn-nb1.rains3.com",
    );
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
  });
});
