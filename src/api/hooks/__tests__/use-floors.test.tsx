/** useFloors hook 测试 */

import { beforeEach, describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFloors } from "@/api/hooks/use-floors";
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

const sampleFloor = {
  id: "post-1",
  threadId: "t1",
  subthreadId: "s1",
  authorId: "u1",
  floorNumber: 1,
  parentPostId: null,
  replyToPostId: null,
  replyToPost: null,
  content: "第一楼正文",
  version: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  author: { id: "u1", username: "testuser", avatar: null },
  _count: { replies: 0 },
  replies: [],
};

const sampleResponse = {
  code: 0,
  message: "ok",
  data: [sampleFloor],
  meta: { cursor: "post-1", hasMore: false },
};

describe("useFloors", () => {
  beforeEach(() => mockGET.mockReset());

  test("success", async () => {
    mockGET.mockResolvedValue({ data: sampleResponse, error: undefined });

    const { result } = renderHook(() => useFloors("s1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const pages = result.current.data?.pages ?? [];
    expect(pages[0]?.data[0].floorNumber).toBe(1);
    expect(pages[0]?.data[0].content).toBe("第一楼正文");
    expect(mockGET).toHaveBeenCalledWith(
      "/api/v1/subthreads/{subthreadId}/posts",
      {
        params: {
          path: { subthreadId: "s1" },
          query: { limit: 20, order: "OLDEST" },
        },
      },
    );
  });

  test("倒序与游标进入每页请求", async () => {
    mockGET
      .mockResolvedValueOnce({
        data: { ...sampleResponse, meta: { cursor: "post-1", hasMore: true } },
        error: undefined,
      })
      .mockResolvedValueOnce({
        data: { ...sampleResponse, data: [], meta: { cursor: null, hasMore: false } },
        error: undefined,
      });

    const { result } = renderHook(() => useFloors("s1", "NEWEST"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await result.current.fetchNextPage();

    expect(mockGET).toHaveBeenLastCalledWith(
      "/api/v1/subthreads/{subthreadId}/posts",
      {
        params: {
          path: { subthreadId: "s1" },
          query: { limit: 20, order: "NEWEST", cursor: "post-1" },
        },
      },
    );
  });

  test("subthreadId 为 undefined 时不请求", () => {
    const { result } = renderHook(() => useFloors(undefined), {
      wrapper: createWrapper(),
    });
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe("idle");
  });

  test("空列表", async () => {
    mockGET.mockResolvedValue({
      data: { ...sampleResponse, data: [], meta: { cursor: null, hasMore: false } },
      error: undefined,
    });

    const { result } = renderHook(() => useFloors("s1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const pages = result.current.data?.pages ?? [];
    expect(pages[0]?.data).toHaveLength(0);
  });

  test("hasMore 为 true 时 getNextPageParam 返回 cursor", async () => {
    mockGET.mockResolvedValue({
      data: {
        ...sampleResponse,
        meta: { cursor: "next-cursor", hasMore: true },
      },
      error: undefined,
    });

    const { result } = renderHook(() => useFloors("s1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
  });

  test("网络错误", async () => {
    mockGET.mockResolvedValue({ data: undefined, error: new Error("网络错误") });

    const { result } = renderHook(() => useFloors("s1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
