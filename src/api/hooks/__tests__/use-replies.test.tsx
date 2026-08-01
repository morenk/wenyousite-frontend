/** useReplies hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useReplies } from "@/api/hooks/use-replies";
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

const sampleReply = {
  id: "reply-1",
  threadId: "t1",
  subthreadId: "s1",
  authorId: "u2",
  floorNumber: null,
  parentPostId: "post-1",
  replyToPostId: null,
  replyToPost: null,
  content: "楼中楼回复内容",
  version: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  author: { id: "u2", username: "replier", avatar: null },
  _count: { replies: 0 },
  replies: [],
};

const sampleResponse = {
  code: 0,
  message: "ok",
  data: [sampleReply],
  meta: { cursor: "reply-1", hasMore: false },
};

describe("useReplies", () => {
  test("success：返回楼中楼回复列表", async () => {
    mockGET.mockResolvedValue({ data: sampleResponse, error: undefined });

    const { result } = renderHook(() => useReplies("post-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const pages = result.current.data?.pages ?? [];
    expect(pages[0]?.data[0].content).toBe("楼中楼回复内容");
    expect(pages[0]?.data[0].parentPostId).toBe("post-1");
  });

  test("postId 为 undefined 时不请求", () => {
    const { result } = renderHook(() => useReplies(undefined), {
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

    const { result } = renderHook(() => useReplies("post-1"), {
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

    const { result } = renderHook(() => useReplies("post-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
  });
});
