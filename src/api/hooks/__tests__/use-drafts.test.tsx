/** useDrafts hook 测试：草稿列表 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDrafts } from "@/api/hooks/use-drafts";
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

const sampleDraft = {
  id: "d1",
  title: "未命名草稿",
  category: "RPG",
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  defaultSubthreadId: "s1",
  defaultSubthread: { id: "s1", title: "未命名草稿" },
  topicTags: [],
  _count: { subthreads: 1, posts: 0 },
};

describe("useDrafts", () => {
  test("成功获取草稿列表", async () => {
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: [sampleDraft] },
      error: undefined,
    });

    const { result } = renderHook(() => useDrafts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/threads/draft");
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].title).toBe("未命名草稿");
  });

  test("空列表返回空数组", async () => {
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: [] },
      error: undefined,
    });

    const { result } = renderHook(() => useDrafts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
