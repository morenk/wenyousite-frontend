import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";

import { middleware } from "../middleware";

describe("Next middleware CSP nonce", () => {
  test("为每个页面请求生成不同 nonce 并写入 CSP", () => {
    const first = middleware(new NextRequest("https://wenyou.site/login"));
    const second = middleware(new NextRequest("https://wenyou.site/login"));
    const firstCsp = first.headers.get("Content-Security-Policy");
    const secondCsp = second.headers.get("Content-Security-Policy");

    expect(firstCsp).toMatch(/script-src 'self' 'nonce-[^']+'/);
    expect(secondCsp).toMatch(/script-src 'self' 'nonce-[^']+'/);
    expect(firstCsp).not.toBe(secondCsp);
    expect(firstCsp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });
});
