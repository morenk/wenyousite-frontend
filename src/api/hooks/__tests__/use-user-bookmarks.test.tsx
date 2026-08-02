/** useUserBookmarks hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUserBookmarks } from "@/api/hooks/use-user-bookmarks";
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

const sample = {
  id: "t1",
  title: "他人收藏帖",
  category: "RPG",
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: true,
  pinned: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  owner: { id: "u1", username: "morenk", avatar: null },
  _count: { members: 1, posts: 2 },
};

describe("useUserBookmarks", () => {
  test("成功获取指定用户的收藏列表", async () => {
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: [sample], meta: { cursor: "t1", hasMore: false } },
      error: undefined,
    });

    const { result } = renderHook(() => useUserBookmarks("u1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/users/{id}/bookmarks", {
      params: { path: { id: "u1" }, query: { limit: "10" } },
    });
    const pages = result.current.data?.pages ?? [];
    expect(pages[0]?.data[0].title).toBe("他人收藏帖");
  });

  test("未公开收藏（404）进入 error", async () => {
    mockGET.mockResolvedValue({
      data: undefined,
      error: { code: 404, message: "该用户未公开收藏" },
    });

    const { result } = renderHook(() => useUserBookmarks("u1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
