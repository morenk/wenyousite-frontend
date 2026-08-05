/** useSearch hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSearch } from "@/api/hooks/use-search";
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

const sampleResult = {
  users: [
    {
      id: "u1",
      username: "测试用户",
      avatar: null,
      bio: "一起写故事",
    },
  ],
  threads: [
    {
      id: "t1",
      title: "测试帖子",
      category: "RPG",
      createdAt: "2026-01-01T00:00:00Z",
      owner: { id: "u1", username: "morenk", avatar: null },
      _count: { members: 1, posts: 2 },
    },
  ],
  posts: [
    {
      id: "p1",
      floorNumber: 1,
      content: "测试内容",
      createdAt: "2026-01-01T00:00:00Z",
      author: { id: "u1", username: "morenk" },
      thread: { id: "t1", title: "测试帖子" },
      subthread: { id: "s1", title: "主讨论区" },
    },
  ],
};

describe("useSearch", () => {
  test("成功获取搜索结果", async () => {
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: sampleResult },
      error: undefined,
    });

    const { result } = renderHook(() => useSearch("测试"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/search", {
      params: { query: { q: "测试" } },
    });
    expect(result.current.data?.users[0].username).toBe("测试用户");
    expect(result.current.data?.threads[0].title).toBe("测试帖子");
    expect(result.current.data?.posts[0].content).toBe("测试内容");
  });

  test("空关键词不请求", () => {
    const { result } = renderHook(() => useSearch("  "), {
      wrapper: createWrapper(),
    });
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe("idle");
  });

  test("接口错误进入 error", async () => {
    mockGET.mockRejectedValue(new Error("网络错误"));
    const { result } = renderHook(() => useSearch("测试"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
