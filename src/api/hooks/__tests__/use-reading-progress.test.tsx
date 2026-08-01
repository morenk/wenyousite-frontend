/** 阅读进度 hooks 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useUpdateReadingProgress,
  useNewReplies,
} from "@/api/hooks/use-reading-progress";
import React from "react";

const { mockPOST, mockGET } = vi.hoisted(() => ({
  mockPOST: vi.fn(),
  mockGET: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { POST: mockPOST, GET: mockGET },
}));

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

    result.current.mutate({ subthreadId: "s1", postId: "p1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/reading-progress", {
      body: { subthreadId: "s1", postId: "p1" },
    });
  });
});

describe("useNewReplies", () => {
  const sample = {
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
