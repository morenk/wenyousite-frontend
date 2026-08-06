/** 阅读进度 hooks 测试 */

import { beforeEach, describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useUpdateReadingProgress,
  useNewReplies,
  useRecordLoadedReadingProgress,
  useThreadNewReplies,
} from "@/api/hooks/use-reading-progress";
import React from "react";

const { mockPOST, mockGET } = vi.hoisted(() => ({
  mockPOST: vi.fn(),
  mockGET: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { POST: mockPOST, GET: mockGET },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

describe("useUpdateReadingProgress", () => {
  test("记录进度：传 subthreadId 与 postId", async () => {
    mockPOST.mockResolvedValueOnce({ data: { code: 0 }, error: undefined });

    const { result } = renderHook(() => useUpdateReadingProgress(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ threadId: "t1", subthreadId: "s1", postId: "p1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/reading-progress", {
      body: { subthreadId: "s1", postId: "p1" },
    });
  });

  test("楼层加载完成后才记录最后渲染位置", async () => {
    mockPOST.mockResolvedValue({ data: { code: 0 }, error: undefined });
    const { rerender } = renderHook(
      ({ ready, postId }) =>
        useRecordLoadedReadingProgress({
          threadId: "t1",
          subthreadId: "s1",
          postId,
          ready,
        }),
      {
        wrapper: createWrapper(),
        initialProps: { ready: false, postId: undefined as string | undefined },
      },
    );

    expect(mockPOST).not.toHaveBeenCalled();
    rerender({ ready: true, postId: "p20" });

    await waitFor(() => expect(mockPOST).toHaveBeenCalledTimes(1));
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/reading-progress", {
      body: { subthreadId: "s1", postId: "p20" },
    });
  });
});

describe("useNewReplies", () => {
  const sample = {
    subthreadId: "s1",
    newReplies: 3,
    totalPosts: 10,
    lastReadPostId: "p1",
    lastReadTime: "2026-01-01T00:00:00Z",
    continueFrom: { id: "p1", floorNumber: 3, parentPostId: null },
  };

  test("success：返回新增回复数", async () => {
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: sample },
      error: undefined,
    });

    const { result } = renderHook(() => useNewReplies("s1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.newReplies).toBe(3);
  });

  test("subthreadId 为 undefined 时不请求", () => {
    const { result } = renderHook(() => useNewReplies(undefined), {
      wrapper: createWrapper(),
    });
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useThreadNewReplies", () => {
  test("一次返回全部子贴的新回复摘要", async () => {
    mockGET.mockResolvedValueOnce({
      data: {
        code: 0,
        message: "ok",
        data: {
          items: [
            { subthreadId: "s1", newReplies: 2 },
            { subthreadId: "s2", newReplies: 5 },
          ],
        },
      },
      error: undefined,
    });

    const { result } = renderHook(() => useThreadNewReplies("t1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toEqual([
      expect.objectContaining({ subthreadId: "s1", newReplies: 2 }),
      expect.objectContaining({ subthreadId: "s2", newReplies: 5 }),
    ]);
    expect(mockGET).toHaveBeenCalledWith(
      "/api/v1/reading-progress/threads/{threadId}/new-replies",
      { params: { path: { threadId: "t1" } } },
    );
  });
});
