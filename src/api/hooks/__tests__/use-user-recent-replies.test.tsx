/** useUserRecentReplies hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUserRecentReplies } from "@/api/hooks/use-user-recent-replies";
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
  id: "r1",
  createdAt: "2026-01-01T00:00:00Z",
  floorNumber: 1,
  parentPostId: null,
  content: "回复内容",
  threadId: "t1",
  thread: { title: "测试帖" },
  subthreadId: "s1",
  subthread: { title: "测试帖" },
  preview: "回复内容",
};

describe("useUserRecentReplies", () => {
  test("成功获取最近动态", async () => {
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: [sampleReply] },
      error: undefined,
    });

    const { result } = renderHook(() => useUserRecentReplies("u1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/users/{id}/recent-replies", {
      params: { path: { id: "u1" } },
    });
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].thread.title).toBe("测试帖");
  });

  test("空列表返回空数组", async () => {
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: [] },
      error: undefined,
    });

    const { result } = renderHook(() => useUserRecentReplies("u1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
