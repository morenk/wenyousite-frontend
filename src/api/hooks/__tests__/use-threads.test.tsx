/** useThreads hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useThreads } from "@/api/hooks/use-threads";

const { mockGET } = vi.hoisted(() => ({
  mockGET: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { GET: mockGET },
}));

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

const sampleResponse = {
  code: 0,
  message: "ok",
  data: [
    {
      id: "t1",
      title: "测试帖",
      category: "RPG",
      status: "RECRUITING",
      visibility: "PUBLIC",
      published: true,
      pinned: false,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      deletedAt: null,
      owner: { id: "u1", username: "作者", avatar: null },
      defaultSubthread: { id: "s1", title: "主帖" },
      topicTags: [],
      _count: { members: 1, posts: 5 },
      preview: "预览...",
    },
  ],
  meta: { cursor: null, hasMore: false },
};

describe("useThreads", () => {
  test("loading 状态", () => {
    mockGET.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useThreads(), {
      wrapper: createWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
  });

  test("成功加载数据", async () => {
    mockGET.mockResolvedValue({
      data: sampleResponse,
      error: undefined,
    });

    const { result } = renderHook(() => useThreads(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const pages = result.current.data?.pages ?? [];
    expect(pages.length).toBeGreaterThan(0);
    expect(pages[0]?.data[0].title).toBe("测试帖");
  });

  test("空列表", async () => {
    mockGET.mockResolvedValue({
      data: { ...sampleResponse, data: [] },
      error: undefined,
    });

    const { result } = renderHook(() => useThreads(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const pages = result.current.data?.pages ?? [];
    expect(pages[0]?.data).toHaveLength(0);
  });

  test("API 错误", async () => {
    mockGET.mockRejectedValue(new Error("网络错误"));

    const { result } = renderHook(() => useThreads(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/网络错误/);
  });

  test("传递排序和状态筛选参数", async () => {
    mockGET.mockClear();
    mockGET.mockResolvedValue({ data: sampleResponse, error: undefined });

    const { result } = renderHook(
      () => useThreads({ sort: "active", status: "CLOSED" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/threads", {
      params: {
        query: {
          sort: "active",
          status: "CLOSED",
          limit: "20",
        },
      },
    });
  });
});
