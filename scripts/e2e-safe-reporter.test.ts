import { expect, test } from "vitest";
import { sanitize } from "./e2e-safe-reporter";

test("浏览器诊断移除填写参数、令牌与会话头，保留非敏感失败位置", () => {
  const text = sanitize('fill("test-secret")\nmember@e2e.invalid member-name\nAuthorization: Bearer opaque\nSet-Cookie: session=opaque\neyJhbGciOi.xxxxxx.signature\nexpect button visible', {
    NODE_ENV: "test", E2E_PASSWORD: "test-secret", E2E_EMAIL: "member@e2e.invalid", E2E_USERNAME: "member-name",
  });
  expect(text).not.toMatch(/test-secret|member|opaque|eyJhbGciOi/);
  expect(text).toContain("expect button visible");
});
