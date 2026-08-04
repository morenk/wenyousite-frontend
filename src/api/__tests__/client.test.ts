/** api client 401 会话过期判定测试 */

import { beforeEach, describe, test, expect, vi } from "vitest";
import {
  createAuthenticatedFetch,
  isSessionExpired401,
} from "@/api/client";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("isSessionExpired401", () => {
  test("业务 401（登录密码错误）即使无 token 也不按会话过期处理", () => {
    expect(isSessionExpired401(401, "/api/v1/auth/login", null)).toBe(false);
  });

  test("业务 401（注册/重置/验证码错误）不按会话过期处理", () => {
    expect(
      isSessionExpired401(401, "/api/v1/auth/register/verify-and-complete", null),
    ).toBe(false);
    expect(isSessionExpired401(401, "/api/v1/auth/reset-password", null)).toBe(false);
    expect(isSessionExpired401(401, "/api/v1/auth/verify-email", "Bearer x")).toBe(false);
  });

  test("业务 401（改密/换邮箱）即使携带 token 也不按会话过期处理", () => {
    expect(isSessionExpired401(401, "/api/v1/auth/change-password", "Bearer x")).toBe(false);
    expect(
      isSessionExpired401(401, "/api/v1/auth/change-email/request-code", "Bearer x"),
    ).toBe(false);
    expect(isSessionExpired401(401, "/api/v1/auth/change-email/verify", "Bearer x")).toBe(false);
  });

  test("携带 token 的普通接口 401 判定为会话过期", () => {
    expect(isSessionExpired401(401, "/api/v1/threads/1", "Bearer x")).toBe(true);
    expect(isSessionExpired401(401, "/api/v1/notifications", "Bearer x")).toBe(true);
  });

  test("未携带 token 的普通接口 401 不判定为会话过期", () => {
    expect(isSessionExpired401(401, "/api/v1/threads/1", null)).toBe(false);
  });

  test("非 401 状态码永不判定为会话过期", () => {
    expect(isSessionExpired401(403, "/api/v1/threads/1", "Bearer x")).toBe(false);
    expect(isSessionExpired401(404, "/api/v1/threads/1", "Bearer x")).toBe(false);
    expect(isSessionExpired401(200, "/api/v1/threads/1", "Bearer x")).toBe(false);
  });
});

describe("createAuthenticatedFetch", () => {
  test("普通接口 401 时刷新 token 并重放原请求", async () => {
    localStorage.setItem("accessToken", "old-token");
    localStorage.setItem("user", JSON.stringify({ id: "u1", username: "旧用户" }));
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 40100 }), { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            message: "ok",
            data: {
              accessToken: "new-token",
              user: { id: "u1", username: "新用户" },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0 }), { status: 200 }));

    const authenticatedFetch = createAuthenticatedFetch(fetchImpl);
    const response = await authenticatedFetch(
      new Request("https://wenyou.site/api/v1/notifications", {
        headers: { Authorization: "Bearer old-token" },
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(new Request(fetchImpl.mock.calls[1][0]).url).toBe(
      "https://wenyou.site/api/v1/auth/refresh",
    );
    const retriedRequest = new Request(fetchImpl.mock.calls[2][0]);
    expect(retriedRequest.headers.get("Authorization")).toBe("Bearer new-token");
    expect(localStorage.getItem("accessToken")).toBe("new-token");
    expect(JSON.parse(localStorage.getItem("user") ?? "{}").username).toBe("新用户");
  });

  test("并发 401 共享一次 refresh 请求", async () => {
    localStorage.setItem("accessToken", "old-token");
    let refreshCalls = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const request = new Request(input);
      if (request.url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        await Promise.resolve();
        return new Response(
          JSON.stringify({
            code: 0,
            data: { accessToken: "new-token", user: { id: "u1" } },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (request.headers.get("Authorization") === "Bearer old-token") {
        return new Response(null, { status: 401 });
      }
      return new Response(null, { status: 200 });
    });

    const authenticatedFetch = createAuthenticatedFetch(fetchImpl);
    const createRequest = (path: string) =>
      new Request(`https://wenyou.site${path}`, {
        headers: { Authorization: "Bearer old-token" },
      });
    const responses = await Promise.all([
      authenticatedFetch(createRequest("/api/v1/notifications")),
      authenticatedFetch(createRequest("/api/v1/bookmarks")),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(refreshCalls).toBe(1);
  });
});
