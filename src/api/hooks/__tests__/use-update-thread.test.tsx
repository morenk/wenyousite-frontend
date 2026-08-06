/** useUpdateThread hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUpdateThread } from "@/api/hooks/use-update-thread";

const { mockPATCH } = vi.hoisted(() => ({
  mockPATCH: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { PATCH: mockPATCH },
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

const mockRawThread = {
  id: "t1",
  title: "更新后标题",
  ownerId: "u1",
  category: "RPG",
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: true,
  publishedAt: "2026-01-01T00:00:00Z",
  pinned: false,
  pinnedAt: null,
  viewCount: 0,
  version: 2,
  likeCount: 0,
  defaultSubthreadId: "s1",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  owner: { id: "u1", username: "test", avatar: null },
  subthreads: [
    {
      id: "s1",
      threadId: "t1",
      title: "主帖",
      sortOrder: 0,
      postingPolicy: "PARTICIPANTS" as const,
      version: 1,
      lastPostAt: null,
      deletedAt: null,
      createdAt: "2026-01-01T00:00:00Z",
      bodyPost: null,
      _count: { posts: 0 },
    },
  ],
  topicTags: [],
  _count: { members: 1, posts: 1 },
};

describe("useUpdateThread", () => {
  test("更新草稿成功", async () => {
    mockPATCH.mockResolvedValueOnce({
      data: { code: 0, message: "ok", data: mockRawThread },
      error: undefined,
    });

    const { result } = renderHook(() => useUpdateThread(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      threadId: "t1",
      body: {
        title: "更新后标题",
        category: "RPG",
        visibility: "PUBLIC",
        version: 1,
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.title).toBe("更新后标题");
  });

  test("发布主题帖成功（publish 标记变更）", async () => {
    mockPATCH.mockResolvedValueOnce({
      data: {
        code: 0,
        message: "ok",
        data: { ...mockRawThread, published: true },
      },
      error: undefined,
    });

    const { result } = renderHook(() => useUpdateThread(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      threadId: "t1",
      body: {
        title: "发布帖",
        category: "RPG",
        visibility: "PUBLIC",
        published: true,
        version: 1,
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.published).toBe(true);
  });

  test("版本冲突 409 时进入 error", async () => {
    mockPATCH.mockRejectedValueOnce({ code: 40900, message: "版本冲突" });

    const { result } = renderHook(() => useUpdateThread(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      threadId: "t1",
      body: { category: "RPG", visibility: "PUBLIC", version: 1 },
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  test("网络错误时进入 error", async () => {
    mockPATCH.mockRejectedValueOnce(new Error("网络连接失败"));

    const { result } = renderHook(() => useUpdateThread(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      threadId: "t1",
      body: { category: "RPG", visibility: "PUBLIC", version: 1 },
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/网络连接失败/);
  });
});
