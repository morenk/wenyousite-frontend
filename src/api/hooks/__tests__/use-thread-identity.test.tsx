
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { queryKeys } from "@/api/query-keys";
import {
  readThreadIdentity, useThreadIdentity, useThreadUserIdentity, useUpdateThreadIdentity,
  useSetThreadIdentityEnabled, useRefreshThreadIdentityProjection,
} from "../use-thread-identity";
const mocks = vi.hoisted(() => ({ GET: vi.fn(), PUT: vi.fn(), DELETE: vi.fn(), PATCH: vi.fn(), viewer: "u1" }));
vi.mock("@/api/client", () => ({ apiClient: mocks }));
vi.mock("@/api/use-viewer-scope", () => ({ useViewerScope: () => mocks.viewer }));
const value = { threadId: "t1", userId: "u1", enabled: true, eligible: true, canEdit: true,
  identity: null, display: null, account: { id: "u1", username: "小明", avatar: null }, identityToken: "token" };
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  function wrapper({ children }: { children: React.ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  return { client, wrapper };
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.viewer = "u1";
  for (const method of [mocks.GET, mocks.PUT, mocks.DELETE, mocks.PATCH]) method.mockResolvedValue({ data: { data: value } });
});
afterEach(cleanup);
test("本人资料按主题与访问者隔离，匿名不读取编辑身份", async () => {
  const { wrapper, client } = setup();
  const { result } = renderHook(() => useThreadIdentity("t1"), { wrapper });
  await waitFor(() => expect(result.current.data).toEqual(value));
  expect(client.getQueryData(queryKeys.threadIdentities.mine("t1", "u1"))).toEqual(value);
  expect(client.getQueryData(queryKeys.threadIdentities.mine("t2", "u1"))).toBeUndefined();
  mocks.viewer = "anonymous";
  renderHook(() => useThreadIdentity("t2"), { wrapper });
  expect(mocks.GET).toHaveBeenCalledTimes(1);
});
test("读卡使用目标稳定账号，延迟到打开再查询", async () => {
  const { wrapper } = setup();
  const { result, rerender } = renderHook(({ enabled }) => useThreadUserIdentity("t1", "u2", enabled), { wrapper, initialProps: { enabled: false } });
  expect(mocks.GET).not.toHaveBeenCalled();
  rerender({ enabled: true });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(mocks.GET).toHaveBeenCalledWith("/api/v1/threads/{threadId}/identities/{userId}", { params: { path: { threadId: "t1", userId: "u2" } } });
});
test.each(["PUT", "DELETE"] as const)("%s资料刷新身份、楼层、提及、搜索与通知缓存", async (method) => {
  const { client, wrapper } = setup();
  const invalidated = vi.spyOn(client, "invalidateQueries");
  const { result } = renderHook(() => useUpdateThreadIdentity("t1"), { wrapper });
  await act(async () => {
    if (method === "PUT") await result.current.save.mutateAsync({ nickname: "白鸦", clearAvatar: true, version: 3 });
    else await result.current.clear.mutateAsync();
  });
  expect(client.getQueryData(queryKeys.threadIdentities.mine("t1", "u1"))).toEqual(value);
  expect(mocks[method]).toHaveBeenCalledWith("/api/v1/threads/{threadId}/identity", expect.objectContaining({ params: { path: { threadId: "t1" } } }));
  for (const key of [queryKeys.floors.all, queryKeys.mentionCandidatesRoot, queryKeys.search.all, queryKeys.notifications.all]) {
    expect(invalidated).toHaveBeenCalledWith({ queryKey: key });
  }
});
test("楼主开关独立PATCH，出错不把本地状态伪装为成功", async () => {
  const { wrapper } = setup();
  const { result } = renderHook(() => useSetThreadIdentityEnabled("t1"), { wrapper });
  await act(async () => { await result.current.mutateAsync(false); });
  expect(mocks.PATCH).toHaveBeenCalledWith("/api/v1/threads/{threadId}/identity-settings", { params: { path: { threadId: "t1" } }, body: { enabled: false } });
  mocks.PATCH.mockResolvedValueOnce({ error: { code: 40300 } });
  await act(async () => { await expect(result.current.mutateAsync(true)).rejects.toEqual({ code: 40300 }); });
});
test("刷新发现关闭或重开即丢弃旧投影，同状态与换帖不反复重置", () => {
  const { wrapper, client } = setup();
  const reset = vi.spyOn(client, "resetQueries");
  const { rerender } = renderHook(({ thread, enabled }) => useRefreshThreadIdentityProjection(thread, enabled), { wrapper, initialProps: { thread: "t1", enabled: undefined as boolean | undefined } });
  rerender({ thread: "t1", enabled: true });
  rerender({ thread: "t1", enabled: true });
  expect(reset).not.toHaveBeenCalled();
  rerender({ thread: "t1", enabled: false });
  expect(reset).toHaveBeenCalledWith({ queryKey: queryKeys.floors.all });
  expect(reset).toHaveBeenCalledWith({ queryKey: queryKeys.mentionCandidatesRoot });
  reset.mockClear();
  rerender({ thread: "t2", enabled: true });
  expect(reset).not.toHaveBeenCalled();
});
test("API业务错误和空响应不当成有效身份", async () => {
  mocks.GET.mockResolvedValueOnce({ error: { code: 40402 } }).mockResolvedValueOnce({});
  await expect(readThreadIdentity("t1")).rejects.toEqual({ code: 40402 });
  await expect(readThreadIdentity("t1")).rejects.toThrow("响应为空");
  const { wrapper } = setup();
  mocks.PUT.mockResolvedValueOnce({ error: { code: 40011 } }).mockResolvedValueOnce({});
  const { result } = renderHook(() => useUpdateThreadIdentity("t1"), { wrapper });
  await act(async () => { await expect(result.current.save.mutateAsync({ nickname: "x" })).rejects.toEqual({ code: 40011 }); });
  await act(async () => { await expect(result.current.save.mutateAsync({ nickname: "x" })).rejects.toThrow("响应为空"); });
  mocks.DELETE.mockResolvedValueOnce({ error: { code: 40011 } }).mockResolvedValueOnce({});
  await act(async () => { await expect(result.current.clear.mutateAsync()).rejects.toEqual({ code: 40011 }); });
  await act(async () => { await expect(result.current.clear.mutateAsync()).rejects.toThrow("响应为空"); });
});

test("卡片读到新的关闭状态会更新同查看者详情并失效全部投影", async () => {
  const { client, wrapper } = setup();
  client.setQueryData(queryKeys.threads.detailForViewer("t1", "u1"), { rpIdentityEnabled: true, title: "原主题" });
  mocks.GET.mockResolvedValue({ data: { data: { ...value, enabled: false } } });
  const invalidated = vi.spyOn(client, "invalidateQueries");
  renderHook(() => useThreadUserIdentity("t1", "u2", true), { wrapper });
  await waitFor(() => expect(client.getQueryData(queryKeys.threads.detailForViewer("t1", "u1"))).toEqual({ rpIdentityEnabled: false, title: "原主题" }));
  expect(invalidated).toHaveBeenCalledWith({ queryKey: queryKeys.floors.all });
  expect(invalidated).toHaveBeenCalledWith({ queryKey: queryKeys.mentionCandidatesRoot });
});
