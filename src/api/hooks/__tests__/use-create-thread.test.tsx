/** useCreateThread hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCreateThread } from "@/api/hooks/use-create-thread";
import type { ThreadCreateFormData } from "@/lib/validations/thread-create";

const { mockPOST } = vi.hoisted(() => ({
  mockPOST: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { POST: mockPOST },
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

const validBody: ThreadCreateFormData = {
  title: "测试帖",
  category: "RPG",
  visibility: "PUBLIC",
  subthreadTitle: "主帖",
  content: "正文",
  tagNames: ["tag1"],
};

const mockRawThread = {
  id: "t-new-1",
  title: "测试帖",
  ownerId: "u1",
  category: "RPG",
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: false,
  publishedAt: null,
  pinned: false,
  pinnedAt: null,
  viewCount: 0,
  version: 1,
  likeCount: 0,
  defaultSubthreadId: "s1",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  owner: { id: "u1", username: "test", avatar: null },
  subthreads: [
    {
      id: "s1",
      threadId: "t-new-1",
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
  _count: { members: 1, posts: 0 },
};

describe("useCreateThread", () => {
  test("成功创建草稿并返回归一化后的 Thread", async () => {
    mockPOST.mockResolvedValueOnce({
      data: { code: 0, message: "ok", data: mockRawThread },
      error: undefined,
    });

    const { result } = renderHook(() => useCreateThread(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(validBody);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.id).toBe("t-new-1");
    expect(result.current.data?.defaultSubthread.id).toBe("s1");
    expect(result.current.data?.title).toBe("测试帖");
  });

  test("创建草稿时传空 title 也成功", async () => {
    mockPOST.mockResolvedValueOnce({
      data: { code: 0, message: "ok", data: { ...mockRawThread, title: "未命名草稿" } },
      error: undefined,
    });

    const { result } = renderHook(() => useCreateThread(), {
      wrapper: createWrapper(),
    });

    const bodyNoTitle: ThreadCreateFormData = {
      ...validBody,
      title: undefined,
    };
    result.current.mutate(bodyNoTitle);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.title).toBe("未命名草稿");
  });

  test("API 错误时 mutation 进入 error 状态", async () => {
    mockPOST.mockRejectedValueOnce(new Error("网络错误"));

    const { result } = renderHook(() => useCreateThread(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(validBody);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/网络错误/);
  });

  test("API 返回业务错误时 mutation 进入 error 状态", async () => {
    mockPOST.mockResolvedValueOnce({
      data: { code: 40001, message: "发布校验失败" },
      error: { code: 40001, message: "发布校验失败" },
    });

    const { result } = renderHook(() => useCreateThread(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(validBody);

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
