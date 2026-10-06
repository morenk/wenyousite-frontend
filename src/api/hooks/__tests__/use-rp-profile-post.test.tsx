import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useRpProfilePost, useResolveRpProfilePostLink } from "../use-rp-profile-post";
const mocks = vi.hoisted(() => ({ GET: vi.fn(), viewer: "u1" }));
vi.mock("@/api/client", () => ({ apiClient: mocks }));
vi.mock("@/api/use-viewer-scope", () => ({ useViewerScope: () => mocks.viewer }));
const thread = "c00000000000000000000000t", post = "c00000000000000000000000p", parent = "c00000000000000000000000a";
const value = { id: post, threadId: thread, content: "授权原文", deletedAt: null, parentPostId: parent };
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}
beforeEach(() => { vi.clearAllMocks(); mocks.viewer = "u1"; mocks.GET.mockResolvedValue({ data: { data: value } }); });
afterEach(cleanup);
test("每次启用重新读取；刷新与换查看者立即隐藏旧正文，不从缓存回退", async () => {
  const { wrapper } = setup();
  const view = renderHook(({ id }) => useRpProfilePost(thread, "role1", id, true), { wrapper, initialProps: { id: post as string | undefined } });
  await waitFor(() => expect(view.result.current.data?.content).toBe("授权原文"));
  let resolve!: (value: unknown) => void;
  mocks.GET.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  act(() => { void view.result.current.refetch(); });
  await waitFor(() => expect(view.result.current.data).toBeUndefined());
  await act(async () => { resolve({ data: { data: { ...value, content: "更新原文" } } }); });
  await waitFor(() => expect(view.result.current.data?.content).toBe("更新原文"));
  view.rerender({ id: undefined });
  expect(view.result.current.data).toBeUndefined();
  mocks.GET.mockResolvedValueOnce({ error: { status: 404, code: 40403 } });
  mocks.viewer = "u2"; view.rerender({ id: post });
  expect(view.result.current.data).toBeUndefined();
  await waitFor(() => expect(view.result.current.isError).toBe(true));
  expect(view.result.current.data).toBeUndefined();
  expect(mocks.GET).toHaveBeenCalledWith("/api/v1/posts/{id}", { params: { path: { id: post } }, signal: expect.any(AbortSignal), cache: "no-store" });
});
test("不支持、未绑定时不读正文；角色/主题坐标不允许串用返回值", async () => {
  const { wrapper } = setup();
  const first = renderHook(() => useRpProfilePost(thread, "role1", post, false), { wrapper });
  expect(first.result.current.data).toBeUndefined(); expect(mocks.GET).not.toHaveBeenCalled();
  mocks.GET.mockResolvedValueOnce({ data: { data: { ...value, threadId: parent } } });
  const second = renderHook(() => useRpProfilePost(thread, "role2", post, true), { wrapper });
  await waitFor(() => expect(second.result.current.isError).toBe(true));
  expect(second.result.current.data).toBeUndefined();
});
test("链接仅提取稳定 ID，先核对授权主题和楼中楼父坐标", async () => {
  const { wrapper } = setup(); const { result } = renderHook(() => useResolveRpProfilePostLink(thread), { wrapper });
  await act(async () => {
    await expect(result.current.mutateAsync("https://evil.example/threads/" + thread + "?post=" + post)).rejects.toThrow("有效楼层链接");
  });
  expect(mocks.GET).not.toHaveBeenCalled();
  await act(async () => {
    await expect(result.current.mutateAsync("/threads/" + thread + "/posts/" + parent + "/replies?post=" + post)).resolves.toBe(post);
  });
  expect(mocks.GET).toHaveBeenCalledWith("/api/v1/posts/{id}", expect.objectContaining({ params: { path: { id: post } }, cache: "no-store" }));
  mocks.GET.mockResolvedValueOnce({ error: { status: 403 } });
  await act(async () => { await expect(result.current.mutateAsync("/threads/" + thread + "?post=" + post)).rejects.toThrow("资料暂不可用"); });
});
