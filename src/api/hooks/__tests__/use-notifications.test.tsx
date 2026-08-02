/** useNotifications hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useNotifications } from "@/api/hooks/use-notifications";
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

const sampleNotification = {
  id: "n1",
  type: "reply",
  content: "morenk 回复了：内容",
  payload: null,
  postId: "p1",
  threadId: "t1",
  fromUserId: "u2",
  isRead: false,
  createdAt: "2026-01-01T00:00:00Z",
  post: { id: "p1", floorNumber: 1, parentPostId: null },
  thread: { id: "t1", title: "测试帖" },
  fromUser: { id: "u2", username: "morenk", avatar: null },
};

describe("useNotifications", () => {
  test("成功获取通知列表", async () => {
    mockGET.mockResolvedValue({
      data: {
        code: 0,
        message: "ok",
        data: [sampleNotification],
        meta: { cursor: "n1", hasMore: false },
      },
      error: undefined,
    });

    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/notifications", {
      params: { query: { limit: "20" } },
    });
    const pages = result.current.data?.pages ?? [];
    expect(pages[0]?.data[0].content).toContain("morenk 回复了");
    expect(pages[0]?.data[0].isRead).toBe(false);
  });

  test("带 type 过滤时传入 type 参数", async () => {
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: [], meta: { cursor: null, hasMore: false } },
      error: undefined,
    });

    renderHook(() => useNotifications({ type: "mention" }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockGET).toHaveBeenCalled());
    expect(mockGET).toHaveBeenCalledWith("/api/v1/notifications", {
      params: { query: { limit: "20", type: "mention" } },
    });
  });

  test("hasMore 为 true 时 getNextPageParam 返回 cursor", async () => {
    mockGET.mockResolvedValue({
      data: {
        code: 0,
        message: "ok",
        data: [sampleNotification],
        meta: { cursor: "next", hasMore: true },
      },
      error: undefined,
    });

    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
  });
});
