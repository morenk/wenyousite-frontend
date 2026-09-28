/** useUpdatePost hook 测试 */

import { beforeEach, afterEach, describe, test, expect, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUpdatePost } from "@/api/hooks/use-update-post";
import { useFloors } from "@/api/hooks/use-floors";
import { useReplies } from "@/api/hooks/use-replies";
import { usePost } from "@/api/hooks/use-post";
import { queryKeys } from "@/api/query-keys";

const { mockPATCH, mockGET } = vi.hoisted(() => ({
  mockPATCH: vi.fn(),
  mockGET: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { PATCH: mockPATCH, GET: mockGET },
}));

function createWrapper(qc = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

beforeEach(() => { mockPATCH.mockReset(); mockGET.mockReset(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("useUpdatePost", () => {
  test("保存后刷新列表、内嵌回复、独立回复与详情的编辑时间，无改动保存和重进页面保留时间", async () => {
    const editedAt = "2026-09-29T10:00:00Z";
    let post = { id: "post-1", content: "旧正文", version: 1, editedAt: null as string | null };
    mockGET.mockImplementation(async (path: string) => ({
      data: { code: 0, message: "ok", data: path === "/api/v1/posts/{id}" ? post
        : path.endsWith("/replies") ? [post] : [{ ...post, replies: [post] }],
      meta: { cursor: null, hasMore: false } },
    }));
    mockPATCH.mockImplementation(async (_path: string, { body }: { body: { content: string } }) => {
      post = { ...post, version: post.version + 1, content: body.content,
        editedAt: post.content === body.content ? post.editedAt : editedAt };
      return { data: { code: 0, message: "ok", data: post } };
    });
    const wrapper = createWrapper();
    const useReader = () => ({
      floors: useFloors("s1"), replies: useReplies("root-1"),
      detail: usePost("post-1"), update: useUpdatePost(),
    });
    const mounted = renderHook(useReader, { wrapper });
    await waitFor(() => expect(mounted.result.current.detail.isSuccess).toBe(true));
    expect(mounted.result.current.detail.data?.editedAt).toBeNull();

    for (const version of [1, 2]) {
      await act(async () => {
        await mounted.result.current.update.mutateAsync({ postId: "post-1", content: "修改后的正文", version });
      });
      await waitFor(() => {
        expect(mounted.result.current.floors.data?.pages[0].data[0].editedAt).toBe(editedAt);
        expect(mounted.result.current.floors.data?.pages[0].data[0].replies[0].editedAt).toBe(editedAt);
        expect(mounted.result.current.replies.data?.pages[0].data[0].editedAt).toBe(editedAt);
        expect(mounted.result.current.detail.data?.editedAt).toBe(editedAt);
      });
    }
    expect(mockGET.mock.calls.filter(([path]) => path === "/api/v1/posts/{id}")).toHaveLength(3);
    mounted.unmount();
    const reopened = renderHook(useReader, { wrapper });
    await waitFor(() => expect(reopened.result.current.detail.isFetching).toBe(false));
    expect(reopened.result.current.detail.data?.editedAt).toBe(editedAt);
    expect(reopened.result.current.floors.data?.pages[0].data[0].editedAt).toBe(editedAt);
  });

  test("失败响应不刷新缓存或合成本地编辑时间", async () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const existing = { id: "post-1", editedAt: "2026-09-28T10:00:00Z" };
    const key = queryKeys.posts.detailForViewer("post-1", "anonymous");
    qc.setQueryData(key, existing);
    const invalidation = vi.spyOn(qc, "invalidateQueries");
    mockPATCH.mockResolvedValueOnce({ error: { code: 40900, message: "内容已被修改" } });
    const { result } = renderHook(() => useUpdatePost(), { wrapper: createWrapper(qc) });
    result.current.mutate({ postId: "post-1", content: "修改后的正文", version: 1 });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(qc.getQueryData(key)).toEqual(existing);
    expect(invalidation).not.toHaveBeenCalled();
  });
  test("编辑成功：以正确 path/body 调用 PATCH 并返回新正文", async () => {
    const updated: Record<string, unknown> = {
      id: "post-1",
      content: "编辑后的内容",
      version: 2,
    };
    mockPATCH.mockResolvedValueOnce({
      data: { code: 0, message: "ok", data: updated },
      error: undefined,
    });

    const { result } = renderHook(() => useUpdatePost(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ postId: "post-1", content: "编辑后的内容", version: 1 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPATCH).toHaveBeenCalledWith("/api/v1/posts/{id}", {
      params: { path: { id: "post-1" } },
      body: { content: "编辑后的内容", version: 1 },
    });
    expect(result.current.data).toEqual(updated);
  });

  test("乐观锁冲突（40900）进入 error", async () => {
    mockPATCH.mockRejectedValueOnce({ code: 40900, message: "内容已被修改" });

    const { result } = renderHook(() => useUpdatePost(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ postId: "post-1", content: "x", version: 1 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: 40900 });
  });

  test("无权编辑（40300）进入 error", async () => {
    mockPATCH.mockRejectedValueOnce({ code: 40300, message: "无权编辑" });

    const { result } = renderHook(() => useUpdatePost(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ postId: "post-1", content: "x", version: 1 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: 40300 });
  });
});
