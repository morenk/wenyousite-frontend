/** useUpdatePost hook 测试 */

import { beforeEach, afterEach, describe, test, expect, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUpdatePost } from "@/api/hooks/use-update-post";
import { useFloors } from "@/api/hooks/use-floors";
import { useReplies } from "@/api/hooks/use-replies";
import { usePost } from "@/api/hooks/use-post";
import { clearAuthSession, setAuthSession } from "@/lib/auth-store";
import { queryKeys } from "@/api/query-keys";

const { mockPATCH, mockGET } = vi.hoisted(() => ({
  mockPATCH: vi.fn(),
  mockGET: vi.fn(),
}));

// 本文件验证恢复完成后的查询；真实恢复等待另由 detail-auth-initialization 覆盖。
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ isInitialized: true }) }));

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
    let post = { id: "post-1", subthreadId: "s1", parentPostId: "root-1", content: "旧正文", version: 1, editedAt: null as string | null };
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
    expect(mockGET.mock.calls.filter(([path]) => path === "/api/v1/posts/{id}")).toHaveLength(1);
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

test("保存回填筛选窗口、置顶与内嵌回复，旧读取迟到不覆盖，不重取无关讨论", async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const saved = { id: "p1", subthreadId: "s1", parentPostId: "root", content: "服务端规范正文", version: 2, editedAt: "2026-10-31T00:00:00Z" };
  const old = { ...saved, content: "旧正文", version: 1, mediaDisplays: ["旧映射"] };
  const key = queryKeys.floors.window("s1", { authorId: "u1", order: "NEWEST" }, "anonymous");
  const nested = { id: "root", content: "根楼", version: 1, _count: { replies: 6 }, replies: [old] };
  const page = { data: [nested], window: { total: 20, beforeCursor: "before", afterCursor: "after", pinnedItems: [nested] } };
  qc.setQueryData(key, { pages: [page], pageParams: [{ postId: "root" }] });
  const otherKey = queryKeys.floors.window("s2", {}, "anonymous");
  qc.setQueryData(otherKey, { pages: [{ data: [{ ...old, id: "other" }] }] });
  const other = qc.getQueryData(otherKey);
  const otherViewer = queryKeys.floors.window("s1", {}, "other-viewer");
  qc.setQueryData(otherViewer, { pages: [{ data: [old] }] });
  const foreign = qc.getQueryData(otherViewer);
  let finish!: (value: unknown) => void;
  const pendingRead = qc.fetchQuery({ queryKey: key, queryFn: () => new Promise((resolve) => { finish = resolve; }) }).catch(() => undefined);
  mockPATCH.mockResolvedValue({ data: { data: saved } });
  const { result } = renderHook(() => useUpdatePost(), { wrapper: createWrapper(qc) });
  await act(async () => { await result.current.mutateAsync({ postId: "p1", content: "草稿", version: 1 }); });
  finish({ pages: [page] });
  await pendingRead;
  expect(qc.getQueryData(key)).toMatchObject({ pages: [{ data: [{ _count: { replies: 6 }, replies: [saved] }], window: { total: 20, beforeCursor: "before", afterCursor: "after", pinnedItems: [{ replies: [saved] }] } }], pageParams: [{ postId: "root" }] });
  expect(qc.getQueryData(otherKey)).toBe(other);
  expect(qc.getQueryData(otherViewer)).toBe(foreign);
  expect(mockGET).not.toHaveBeenCalled();
});

test("保存期间退出再登录同账号，晚到响应不回填；同账号刷新 token 不误取消", async () => {
  const user = { id: "u1", email: "test@example.test", username: "test", avatar: null, role: "USER" };
  for (const switchSession of [true, false]) {
    setAuthSession(user, "test-token");
    const qc = new QueryClient();
    const key = queryKeys.posts.detailForViewer("p1", "u1");
    const old = { id: "p1", content: "旧正文", version: 1 };
    qc.setQueryData(key, old);
    let finish!: (value: unknown) => void;
    mockPATCH.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const mounted = renderHook(() => useUpdatePost(), { wrapper: createWrapper(qc) });
    let pending!: Promise<unknown>;
    act(() => { pending = mounted.result.current.mutateAsync({ postId: "p1", content: "新正文", version: 1 }); });
    await waitFor(() => expect(finish).toBeDefined());
    if (switchSession) clearAuthSession();
    setAuthSession(user, "refreshed-test-token");
    await act(async () => { finish({ data: { data: { ...old, content: "新正文", version: 2 } } }); await pending; });
    expect(qc.getQueryData(key)).toMatchObject({ content: switchSession ? "旧正文" : "新正文" });
    mounted.unmount();
  }
  clearAuthSession();
});

test("晚到较低保存版本不覆盖已经读到的更高版本", async () => {
  const qc = new QueryClient();
  const key = queryKeys.posts.detailForViewer("p1", "anonymous");
  qc.setQueryData(key, { id: "p1", content: "更高版本", version: 4, _count: { replies: 9 } });
  mockPATCH.mockResolvedValue({ data: { data: { id: "p1", content: "较早保存", version: 3 } } });
  const { result } = renderHook(() => useUpdatePost(), { wrapper: createWrapper(qc) });
  await act(async () => { await result.current.mutateAsync({ postId: "p1", content: "较早保存", version: 2 }); });
  expect(qc.getQueryData(key)).toMatchObject({ content: "更高版本", version: 4, _count: { replies: 9 } });
});
