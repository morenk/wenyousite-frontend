import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  useSearchPosts,
  useSearchThreads,
  useSearchUsers,
  useThreadSearchPosts,
} from "@/api/hooks/use-search";

const { mockGET } = vi.hoisted(() => ({
  mockGET: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { GET: mockGET },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

const thread = {
  id: "t1",
  title: "测试帖子",
  category: "RPG" as const,
  createdAt: "2026-01-01T00:00:00Z",
  owner: { id: "u1", username: "morenk", avatar: null },
  _count: { members: 1, posts: 2, players: 1 },
};

const user = {
  id: "u1",
  username: "测试用户",
  avatar: null,
  bio: "一起写故事",
};

const post = {
  id: "p1",
  floorNumber: 1,
  content: "测试内容",
  createdAt: "2026-01-01T00:00:00Z",
  author: { id: "u1", username: "morenk" },
  thread: { id: "t1", title: "测试帖子" },
  subthread: { id: "s1", title: "主讨论区" },
};

describe("分类搜索 hooks", () => {
  beforeEach(() => {
    mockGET.mockReset();
  });

  test("主题帖与用户使用独立端点且可由 Tab 控制启用", async () => {
    mockGET
      .mockResolvedValueOnce({ data: { code: 0, message: "ok", data: [thread] } })
      .mockResolvedValueOnce({ data: { code: 0, message: "ok", data: [user] } });

    const wrapper = createWrapper();
    const threads = renderHook(() => useSearchThreads("测试", true), { wrapper });
    const users = renderHook(() => useSearchUsers("测试", true), { wrapper });

    await waitFor(() => expect(threads.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(users.result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/search/threads", {
      params: { query: { q: "测试" } },
    });
    expect(mockGET).toHaveBeenCalledWith("/api/v1/search/users", {
      params: { query: { q: "测试" } },
    });
    expect(threads.result.current.data?.[0].title).toBe("测试帖子");
    expect(users.result.current.data?.[0].username).toBe("测试用户");
  });

  test("未激活分类不请求", () => {
    const { result } = renderHook(() => useSearchUsers("测试", false), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGET).not.toHaveBeenCalled();
  });

  test("楼层短词不请求", () => {
    const { result } = renderHook(() => useSearchPosts("字", true), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGET).not.toHaveBeenCalled();
  });

  test("楼层搜索按 meta.cursor 加载下一页", async () => {
    mockGET
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: [post],
          meta: { cursor: "next-cursor", hasMore: true },
        },
      })
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: [{ ...post, id: "p2" }],
          meta: { cursor: null, hasMore: false },
        },
      });

    const { result } = renderHook(() => useSearchPosts("测试", true), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenNthCalledWith(1, "/api/v1/search/posts", {
      params: { query: { q: "测试", limit: 20 } },
    });

    let nextPageResult: Awaited<ReturnType<typeof result.current.fetchNextPage>> | undefined;
    await act(async () => {
      nextPageResult = await result.current.fetchNextPage();
    });
    expect(mockGET).toHaveBeenNthCalledWith(2, "/api/v1/search/posts", {
      params: {
        query: { q: "测试", limit: 20, cursor: "next-cursor" },
      },
    });
    expect(nextPageResult?.data?.pages).toHaveLength(2);
    expect(nextPageResult?.hasNextPage).toBe(false);
  });

  test("帖内楼层搜索复用游标协议并携带主题帖路径参数", async () => {
    mockGET
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: [post],
          meta: { cursor: "thread-next", hasMore: true },
        },
      })
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: "ok",
          data: [{ ...post, id: "p2" }],
          meta: { cursor: null, hasMore: false },
        },
      });

    const { result } = renderHook(
      () => useThreadSearchPosts("t1", " 测试 ", true),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenNthCalledWith(
      1,
      "/api/v1/threads/{threadId}/search/posts",
      {
        params: {
          path: { threadId: "t1" },
          query: { q: "测试", limit: 20 },
        },
      },
    );

    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(mockGET).toHaveBeenNthCalledWith(
      2,
      "/api/v1/threads/{threadId}/search/posts",
      {
        params: {
          path: { threadId: "t1" },
          query: { q: "测试", limit: 20, cursor: "thread-next" },
        },
      },
    );
  });
});
