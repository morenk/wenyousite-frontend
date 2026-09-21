import { describe, expect, test } from "vitest";
import { anonymousHeaders, isReadonlySmokeRequest, smokeOrigin } from "./readonly-smoke-policy.mjs";

const origin = "https://wenyou.site";
const id = "c123456789012345678901234";
describe("线上匿名只读烟雾请求边界", () => {
  test.each(["/", "/login", "/api/v1/health", "/api/v1/threads?limit=20", `/threads/${id}`, `/api/v1/threads/${id}`, `/api/v1/subthreads/${id}/posts/authors`])("允许普通阅读 %s", (path) => {
    expect(isReadonlySmokeRequest(origin + path, "GET", origin)).toBe(true);
    expect(isReadonlySmokeRequest(origin + path, "HEAD", origin)).toBe(true);
  });
  test.each(["POST", "PATCH", "PUT", "DELETE", "OPTIONS"])("阻断任何 %s", (method) => {
    expect(isReadonlySmokeRequest(origin + "/api/v1/threads", method, origin)).toBe(false);
  });
  test.each(["/api/v1/auth/refresh", "/api/v1/auth/logout", "/api/v1/check-in", "/api/v1/uploads",
    "/api/v1/threads/join-by-link/token", `/api/v1/threads/${id}/export`, "/api/v1/users/me",
    "/api/v1/threads?delete=true", "/api/v1/%74hreads", "/api/v1/threads/create", "/threads/create"])("拒绝 GET 写入及未知入口 %s", (path) => {
    expect(isReadonlySmokeRequest(origin + path, "GET", origin)).toBe(false);
  });
  test("拒绝跨站、带凭据 URL，并清除请求凭据", () => {
    expect(isReadonlySmokeRequest("http://127.0.0.1:3000/api/v1/threads", "GET", origin)).toBe(false);
    expect(isReadonlySmokeRequest("https://user:password@wenyou.site/", "GET", origin)).toBe(false);
    expect(anonymousHeaders({ Authorization: "secret", Cookie: "session", "X-Api-Key": "secret", accept: "text/html" }))
      .toEqual({ accept: "text/html", cookie: "", authorization: "" });
    expect(() => smokeOrigin("https://user:password@wenyou.site")).toThrow();
    expect(() => smokeOrigin("http://secret-user:secret-password@")).toThrow("只读烟雾目标 URL 无效");
    expect(smokeOrigin("http://127.0.0.1:3001")).toBe("http://127.0.0.1:3001");
  });
});
