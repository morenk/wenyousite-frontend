/** useUserProfile hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUserProfile } from "@/api/hooks/use-user-profile";
import React from "react";

const { mockGET } = vi.hoisted(() => ({
  mockGET: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { GET: mockGET },
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

const sampleUser = {
  id: "u1",
  username: "testuser",
  avatar: null,
  profileCover: null,
  bio: null,
  role: "USER",
  level: 1,
  receivedTipTotal: "0",
  receivedTipCount: 0,
  showRecentReplies: true,
  showPlayerBadges: true,
  showBookmarks: true,
  accountStatus: "ACTIVE",
  createdAt: "2026-01-01T00:00:00Z",
  _count: { following: 0, followers: 1 },
  isFollowing: false,
  isFollowedBy: false,
  isBlocked: false,
  isBlockedBy: false,
};

describe("useUserProfile", () => {
  test("成功获取用户资料", async () => {
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: sampleUser },
      error: undefined,
    });

    const { result } = renderHook(() => useUserProfile("u1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/users/{id}", {
      params: { path: { id: "u1" } },
    });
    expect(result.current.data?.username).toBe("testuser");
    expect(result.current.data?.isDeactivated).toBe(false);
    if (!result.current.data || result.current.data.isDeactivated) {
      throw new Error("应返回有效用户资料");
    }
    expect(result.current.data._count.followers).toBe(1);
  });

  test("userId 为 undefined 时不请求", () => {
    const { result } = renderHook(() => useUserProfile(undefined), {
      wrapper: createWrapper(),
    });
    expect(result.current.isPending).toBe(true);
  });

  test("接口错误进入 error", async () => {
    mockGET.mockRejectedValue({ code: 404, message: "用户不存在" });
    const { result } = renderHook(() => useUserProfile("x"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
