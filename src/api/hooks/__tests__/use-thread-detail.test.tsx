/** useThreadDetail query hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useThreadDetail, normalizeThreadDetail } from "@/api/hooks/use-thread-detail";
import type { RawThreadDetail } from "@/api/hooks/use-thread-detail";
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

const rawThread: RawThreadDetail = {
  id: "thread-1",
  title: "测试帖",
  ownerId: "u1",
  category: "RPG",
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: true,
  publishedAt: "2026-01-01T00:00:00Z",
  pinned: false,
  pinnedAt: null,
  viewCount: 10,
  version: 1,
  likeCount: 5,
  defaultSubthreadId: "sub-1",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  owner: { id: "u1", username: "testuser", avatar: null },
  subthreads: [
    {
      id: "sub-1",
      threadId: "thread-1",
      title: "主帖",
      sortOrder: 0,
      postingPolicy: "PARTICIPANTS",
      version: 1,
      lastPostAt: null,
      deletedAt: null,
      createdAt: "2026-01-01T00:00:00Z",
      bodyPost: null,
      _count: { posts: 0 },
      tags: [],
    },
  ],
  topicTags: [],
  _count: { members: 1, posts: 0 },
};

const responseData = {
  code: 0,
  message: "ok",
  data: rawThread,
};

describe("useThreadDetail", () => {
  test("loading 状态", () => {
    mockGET.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useThreadDetail("thread-1"), {
      wrapper: createWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
  });

  test("成功加载并 normalize", async () => {
    mockGET.mockResolvedValue({ data: responseData, error: undefined });

    const { result } = renderHook(() => useThreadDetail("thread-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.title).toBe("测试帖");
    expect(result.current.data?.likeCount).toBe(5);
    expect(result.current.data?.defaultSubthread.id).toBe("sub-1");
  });

  test("threadId 为 undefined 时不发起请求", () => {
    const { result } = renderHook(() => useThreadDetail(undefined), {
      wrapper: createWrapper(),
    });
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe("idle");
  });

  test("API 404 错误", async () => {
    mockGET.mockRejectedValue({ statusCode: 404, message: "主题帖不存在" });

    const { result } = renderHook(() => useThreadDetail("bad-id"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  test("返回正确的 defaultSubthread 匹配", async () => {
    const multiSub = {
      ...rawThread,
      defaultSubthreadId: "sub-2",
      subthreads: [
        ...rawThread.subthreads,
        {
          id: "sub-2",
          threadId: "thread-1",
          title: "设定区",
          sortOrder: 1,
          postingPolicy: "PARTICIPANTS" as const,
          version: 1,
          lastPostAt: null,
          deletedAt: null,
          createdAt: "2026-01-01T00:00:00Z",
          bodyPost: null,
          _count: { posts: 0 },
          tags: [],
        },
      ],
    };
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: multiSub },
      error: undefined,
    });

    const { result } = renderHook(() => useThreadDetail("thread-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.defaultSubthread.title).toBe("设定区");
  });
});

describe("normalizeThreadDetail", () => {
  test("不带 subthreads", () => {
    const raw = { ...rawThread, subthreads: [], defaultSubthreadId: "any" };
    expect(() => normalizeThreadDetail(raw)).toThrow("未返回可用子贴");
  });

  test("defaultSubthreadId 为空时拒绝不完整响应", () => {
    const raw = {
      ...rawThread,
      defaultSubthreadId: "",
      subthreads: [
        { ...rawThread.subthreads[0], id: "first", title: "第一个" },
      ],
    };
    expect(() => normalizeThreadDetail(raw)).toThrow("缺少默认子贴");
  });
});
