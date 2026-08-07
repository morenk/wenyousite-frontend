import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import { useMe } from "@/api/hooks/use-me";
import { createQueryWrapper } from "@/test/query-client";
import { server } from "@/test/msw/server";

const currentUser = {
  id: "u-network",
  email: "network@example.com",
  username: "网络边界用户",
  avatar: null,
  bio: null,
  role: "USER" as const,
  showRecentReplies: true,
  showPlayerBadges: true,
  showBookmarks: true,
  emailVerified: true,
  deletedAt: null,
  createdAt: "2026-08-07T10:00:00.000Z",
  updatedAt: "2026-08-07T10:00:00.000Z",
  _count: { following: 2, followers: 3 },
};

describe("useMe 网络边界", () => {
  test("经真实 apiClient 发送平台头并解析 OpenAPI 响应", async () => {
    let platformHeader: string | null = null;
    server.use(
      http.get("*/api/v1/users/me", ({ request }) => {
        platformHeader = request.headers.get("X-Client-Platform");
        return HttpResponse.json({ code: 0, message: "ok", data: currentUser });
      }),
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMe(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(platformHeader).toBe("web");
    expect(result.current.data).toEqual(currentUser);
  });

  test("非成功响应经 apiClient 进入查询错误态", async () => {
    server.use(
      http.get("*/api/v1/users/me", () =>
        HttpResponse.json(
          { code: 40301, message: "无权访问", data: null },
          { status: 403 },
        )),
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMe(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(expect.objectContaining({ message: "无权访问" }));
  });
});
