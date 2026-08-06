/** api client 401 会话过期判定测试 */

import { afterEach, beforeEach, describe, test, expect, vi } from "vitest";
import {
  bootstrapAuthSession,
  createAuthenticatedFetch,
  isSessionExpired401,
} from "@/api/client";
import {
  clearAuthSession,
  getAuthAccessToken,
  getAuthSnapshot,
  setAuthSession,
  type AuthUser,
} from "@/lib/auth-store";

const user = (id: string, username = id): AuthUser => ({
  id,
  email: `${id}@example.com`,
  username,
  avatar: null,
  role: "USER",
  emailVerified: true,
});

beforeEach(() => {
  localStorage.clear();
  clearAuthSession({ announce: false });
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
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
  test("页面启动通过 refresh cookie 恢复内存会话且不持久化 access token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          data: { accessToken: "boot-token", user: user("u1") },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchImpl);

    await bootstrapAuthSession();

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/auth/refresh"),
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(getAuthAccessToken()).toBe("boot-token");
    expect(getAuthSnapshot().user?.id).toBe("u1");
    expect(localStorage.getItem("accessToken")).toBeNull();
  });

  test("普通接口 401 时刷新 token 并重放原请求", async () => {
    setAuthSession(user("u1", "旧用户"), "old-token");
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
              user: user("u1", "新用户"),
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
    expect(getAuthAccessToken()).toBe("new-token");
    expect(getAuthSnapshot().user?.username).toBe("新用户");
    expect(localStorage.getItem("accessToken")).toBeNull();
  });

  test("并发 401 共享一次 refresh 请求", async () => {
    setAuthSession(user("u1"), "old-token");
    let refreshCalls = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const request = new Request(input);
      if (request.url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        await Promise.resolve();
        return new Response(
          JSON.stringify({
            code: 0,
            data: { accessToken: "new-token", user: user("u1") },
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

  test("其他标签页已完成刷新时复用新 access token，不重复轮转 refresh token", async () => {
    setAuthSession(user("u1"), "old-token");
    let refreshCalls = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const request = new Request(input);
      if (request.url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return new Response(null, { status: 500 });
      }
      return new Response(null, {
        status: request.headers.get("Authorization") === "Bearer old-token" ? 401 : 200,
      });
    });
    vi.stubGlobal("navigator", {
      locks: {
        request: async (_name: string, callback: () => Promise<unknown>) => {
          setAuthSession(user("u1"), "token-from-other-tab", { announce: false });
          return callback();
        },
      },
    });

    const authenticatedFetch = createAuthenticatedFetch(fetchImpl);
    const response = await authenticatedFetch(
      new Request("https://wenyou.site/api/v1/notifications", {
        headers: { Authorization: "Bearer old-token" },
      }),
    );

    expect(response.status).toBe(200);
    expect(refreshCalls).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(new Request(fetchImpl.mock.calls[1][0]).headers.get("Authorization"))
      .toBe("Bearer token-from-other-tab");
  });

  test("等待跨标签页刷新期间切换账号时不重放旧请求或清除新账号", async () => {
    setAuthSession(user("u1"), "old-token");
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 401 }));
    vi.stubGlobal("navigator", {
      locks: {
        request: async (_name: string, callback: () => Promise<unknown>) => {
          setAuthSession(user("u2"), "token-u2");
          return callback();
        },
      },
    });

    const authenticatedFetch = createAuthenticatedFetch(fetchImpl);
    const response = await authenticatedFetch(
      new Request("https://wenyou.site/api/v1/notifications", {
        headers: { Authorization: "Bearer old-token" },
      }),
    );

    expect(response.status).toBe(401);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(getAuthAccessToken()).toBe("token-u2");
    expect(getAuthSnapshot().user?.id).toBe("u2");
  });
});
