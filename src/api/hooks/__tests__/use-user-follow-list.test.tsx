/** useUserFollowList hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUserFollowList } from "@/api/hooks/use-user-follow-list";
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

const baseRecord = {
  id: "f1",
  followerId: "u1",
  followingId: "u2",
  createdAt: "2026-01-01T00:00:00Z",
};

describe("useUserFollowList", () => {
  test("获取关注列表并归一化为用户数组", async () => {
    mockGET.mockResolvedValue({
      data: {
        code: 0,
        message: "ok",
        data: [
          { ...baseRecord, following: { id: "u2", username: "morenk", avatar: null } },
        ],
      },
      error: undefined,
    });

    const { result } = renderHook(() => useUserFollowList("u1", "following"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/users/{id}/following", {
      params: { path: { id: "u1" } },
    });
    expect(result.current.data).toEqual([
      { id: "u2", username: "morenk", avatar: null },
    ]);
  });

  test("获取粉丝列表使用 follower 字段", async () => {
    mockGET.mockResolvedValue({
      data: {
        code: 0,
        message: "ok",
        data: [
          { ...baseRecord, follower: { id: "u3", username: "粉丝A", avatar: null } },
        ],
      },
      error: undefined,
    });

    const { result } = renderHook(() => useUserFollowList("u1", "followers"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/users/{id}/followers", {
      params: { path: { id: "u1" } },
    });
    expect(result.current.data).toEqual([
      { id: "u3", username: "粉丝A", avatar: null },
    ]);
  });

  test("空列表返回空数组", async () => {
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: [] },
      error: undefined,
    });

    const { result } = renderHook(() => useUserFollowList("u1", "following"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  test("userId 为 undefined 时不请求", () => {
    const { result } = renderHook(() => useUserFollowList(undefined, "following"), {
      wrapper: createWrapper(),
    });
    expect(result.current.isPending).toBe(true);
  });
});
