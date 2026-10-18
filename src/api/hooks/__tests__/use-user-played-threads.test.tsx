/** useUserPlayedThreads hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUserPlayedThreads } from "@/api/hooks/use-user-played-threads";
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

const sampleThread = {
  id: "t1",
  title: "测试帖",
  ownerId: "u1",
  category: "RPG",
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: true,
  pinned: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  owner: { id: "u1", username: "testuser", avatar: null },
  defaultSubthread: { id: "s1", title: "测试帖" },
  topicTags: [],
  _count: { members: 1, players: 1, posts: 2 },
  preview: "预览",
};

describe("useUserPlayedThreads", () => {
  test("成功获取参与帖子并分页", async () => {
    mockGET.mockResolvedValue({
      data: {
        code: 0,
        message: "ok",
        data: [sampleThread],
        meta: { cursor: "t1", hasMore: false },
      },
      error: undefined,
    });

    const { result } = renderHook(() => useUserPlayedThreads("u1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/users/{id}/played-threads", {
      params: { path: { id: "u1" }, query: { limit: 10 } },
    });
    const pages = result.current.data?.pages ?? [];
    expect(pages[0]?.data[0].title).toBe("测试帖");
  });

  test("hasMore 为 true 时 getNextPageParam 返回 cursor", async () => {
    mockGET.mockResolvedValue({
      data: {
        code: 0,
        message: "ok",
        data: [sampleThread],
        meta: { cursor: "next-cursor", hasMore: true },
      },
      error: undefined,
    });

    const { result } = renderHook(() => useUserPlayedThreads("u1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
  });

  test("私密分类作为服务端分页参数并隔离缓存", async () => {
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: [], meta: { cursor: null, hasMore: false } },
      error: undefined,
    });

    const { result } = renderHook(() => useUserPlayedThreads("u1", "PRIVATE"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/users/{id}/played-threads", {
      params: { path: { id: "u1" }, query: { limit: 10, visibility: "PRIVATE" } },
    });
  });
});

test("useUserPlayedThreads 原样续接游标，缺少数据安全结束且接口错误不变为空页", async () => {
  mockGET.mockReset().mockResolvedValueOnce({
    data: { code: 0, message: "ok", data: [], meta: { cursor: "opaque+/=cursor", hasMore: true } },
  }).mockResolvedValueOnce({});
  const { result, unmount } = renderHook(() => useUserPlayedThreads("u1", "PRIVATE"), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.hasNextPage).toBe(true));
  await result.current.fetchNextPage();
  await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
  expect(mockGET).toHaveBeenLastCalledWith("/api/v1/users/{id}/played-threads", {
    params: { path: { id: "u1" }, query: { limit: 10, cursor: "opaque+/=cursor", visibility: "PRIVATE" } },
  });
  expect(result.current.data?.pages[1]).toEqual({ code: 0, message: "ok", data: [], meta: { cursor: null, hasMore: false } });
  expect(result.current.hasNextPage).toBe(false);
  unmount();
  const error = { code: 403, message: "无权读取" };
  mockGET.mockResolvedValue({ error });
  const denied = renderHook(() => useUserPlayedThreads("u1", "PRIVATE"), { wrapper: createWrapper() });
  await waitFor(() => expect(denied.result.current.isError).toBe(true));
  expect(denied.result.current.error).toBe(error);
  expect(denied.result.current.data).toBeUndefined();
});
