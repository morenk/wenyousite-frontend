/** useFollowActions hook 测试：关注/取消关注 + 失效用户缓存 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFollowActions } from "@/api/hooks/use-follow-actions";
import React from "react";

const { mockPOST, mockDELETE } = vi.hoisted(() => ({
  mockPOST: vi.fn(),
  mockDELETE: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { POST: mockPOST, DELETE: mockDELETE },
}));

function createWrapper(
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

describe("useFollowActions", () => {
  test("关注：POST 无 body 且成功", async () => {
    mockPOST.mockResolvedValue({
      data: { code: 0, message: "ok", data: { message: "已关注" } },
      error: undefined,
    });

    const { result } = renderHook(() => useFollowActions("u2"), {
      wrapper: createWrapper(),
    });

    result.current.follow.mutate();
    await waitFor(() => expect(result.current.follow.isSuccess).toBe(true));
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/users/follow/{id}", {
      params: { path: { id: "u2" } },
    });
  });

  test("取消关注：DELETE 无 body 且成功", async () => {
    mockDELETE.mockResolvedValue({
      data: { code: 0, message: "ok", data: { message: "已取消关注" } },
      error: undefined,
    });

    const { result } = renderHook(() => useFollowActions("u2"), {
      wrapper: createWrapper(),
    });

    result.current.unfollow.mutate();
    await waitFor(() => expect(result.current.unfollow.isSuccess).toBe(true));
    expect(mockDELETE).toHaveBeenCalledWith("/api/v1/users/follow/{id}", {
      params: { path: { id: "u2" } },
    });
  });

  test("关注变化同时失效目标粉丝和关注列表", async () => {
    mockPOST.mockResolvedValue({
      data: { code: 0, message: "ok", data: { message: "已关注" } },
      error: undefined,
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useFollowActions("u2"), {
      wrapper: createWrapper(queryClient),
    });

    result.current.follow.mutate();
    await waitFor(() => expect(result.current.follow.isSuccess).toBe(true));

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["user", "followers", "u2"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["user", "following"],
    });
  });
});
