import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { queryKeys } from "@/api/query-keys";
import { readRpIdentities, readRpIdentity, useRpIdentities, useRpIdentity, useMutateRpIdentity, canPublishAsIdentity } from "../use-rp-identities";
import { collection, role } from "@/components/thread/__tests__/rp-identity-fixtures";
const mocks = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn(), PUT: vi.fn(), DELETE: vi.fn(), viewer: "u1" }));
vi.mock("@/api/client", () => ({ apiClient: mocks }));
vi.mock("@/api/use-viewer-scope", () => ({ useViewerScope: () => mocks.viewer }));
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  function wrapper({ children }: { children: React.ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  return { client, wrapper };
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.viewer = "u1"; mocks.GET.mockResolvedValue({ data: { data: collection() } });
  for (const method of [mocks.POST, mocks.PUT, mocks.DELETE]) method.mockResolvedValue({ data: { data: role() } });
});
afterEach(cleanup);
test("角色集合按主题与账号隔离；匿名和未指定主题不读私有资料", async () => {
  const { wrapper, client } = setup();
  const { result } = renderHook(() => useRpIdentities("t1"), { wrapper });
  await waitFor(() => expect(result.current.data).toEqual(collection()));
  expect(client.getQueryData(queryKeys.threadIdentities.collection("t1", "u1"))).toEqual(collection());
  expect(client.getQueryData(queryKeys.threadIdentities.collection("t2", "u1"))).toBeUndefined();
  mocks.viewer = "anonymous";
  renderHook(() => useRpIdentities("t2"), { wrapper });
  renderHook(() => useRpIdentities(undefined), { wrapper });
  expect(mocks.GET).toHaveBeenCalledTimes(1);
});
test("历史卡延迟查询同一identityId，不查询当前默认或账号主角色", async () => {
  const { wrapper } = setup(); mocks.GET.mockResolvedValue({ data: { data: role("historical-b") } });
  const { result, rerender } = renderHook(({ enabled }) => useRpIdentity("t1", "historical-b", enabled), { wrapper, initialProps: { enabled: false } });
  expect(mocks.GET).not.toHaveBeenCalled(); rerender({ enabled: true });
  await waitFor(() => expect(result.current.data?.identityId).toBe("historical-b"));
  expect(mocks.GET).toHaveBeenCalledWith("/api/v1/threads/{threadId}/rp-identities/{identityId}", { params: { path: { threadId: "t1", identityId: "historical-b" } } });
});
test.each(["create", "update", "remove"] as const)("%s成功刷新全部投影，版本与角色ID只按请求原值传送", async (operation) => {
  const { wrapper, client } = setup(); const invalidate = vi.spyOn(client, "invalidateQueries");
  const { result } = renderHook(() => useMutateRpIdentity("t1"), { wrapper });
  await act(async () => {
    if (operation === "create") await result.current.create.mutateAsync({ nickname: "同名" });
    else if (operation === "update") await result.current.update.mutateAsync({ identityId: "rp1", body: { version: 3, clearNickname: true } });
    else await result.current.remove.mutateAsync({ identityId: "rp1", version: 3 });
  });
  if (operation === "create") expect(mocks.POST).toHaveBeenCalledWith("/api/v1/threads/{threadId}/rp-identities", { params: { path: { threadId: "t1" } }, body: { nickname: "同名" } });
  if (operation === "update") expect(mocks.PUT).toHaveBeenCalledWith("/api/v1/threads/{threadId}/rp-identities/{identityId}", { params: { path: { threadId: "t1", identityId: "rp1" } }, body: { version: 3, clearNickname: true } });
  if (operation === "remove") expect(mocks.DELETE).toHaveBeenCalledWith("/api/v1/threads/{threadId}/rp-identities/{identityId}", { params: { path: { threadId: "t1", identityId: "rp1" } }, body: { version: 3 } });
  expect(client.getQueryData(queryKeys.threadIdentities.role("t1", "rp1", "u1"))).toEqual(role());
  for (const key of [queryKeys.threadIdentities.thread("t1"), queryKeys.floors.all, queryKeys.mentionCandidatesRoot, queryKeys.search.all, queryKeys.notifications.all]) expect(invalidate).toHaveBeenCalledWith({ queryKey: key });
});
test.each(["collection", "role"] as const)("%s读取关闭态同步详情使已有投影失效，重复状态不循环刷新", async (kind) => {
  const { wrapper, client } = setup();
  client.setQueryData(queryKeys.threads.detailForViewer("t1", "u1"), { rpIdentityEnabled: true });
  mocks.GET.mockResolvedValue({ data: { data: kind === "collection" ? collection([], { enabled: false }) : role("rp1", "x", { enabled: false }) } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  renderHook(() => useRpIdentities(kind === "collection" ? "t1" : undefined), { wrapper });
  renderHook(() => useRpIdentity("t1", kind === "role" ? "rp1" : undefined), { wrapper });
  await waitFor(() => expect(client.getQueryData(queryKeys.threads.detailForViewer("t1", "u1"))).toEqual({ rpIdentityEnabled: false }));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.floors.all });
});
test("读写错误或空响应均失败，POST未知结果不自动重发", async () => {
  for (const read of [() => readRpIdentities("t1"), () => readRpIdentity("t1", "rp1")]) {
    mocks.GET.mockResolvedValueOnce({ error: { code: 40402 } }).mockResolvedValueOnce({});
    await expect(read()).rejects.toEqual({ code: 40402 }); await expect(read()).rejects.toThrow("响应为空");
  }
  const { wrapper } = setup(); const { result } = renderHook(() => useMutateRpIdentity("t1"), { wrapper });
  for (const [method, run] of [
    [mocks.POST, () => result.current.create.mutateAsync({ nickname: "x" })],
    [mocks.PUT, () => result.current.update.mutateAsync({ identityId: "rp1", body: { nickname: "x", version: 3 } })],
    [mocks.DELETE, () => result.current.remove.mutateAsync({ identityId: "rp1", version: 3 })],
  ] as const) {
    method.mockResolvedValueOnce({ error: { code: 40002 } }).mockResolvedValueOnce({});
    await act(async () => { await expect(run()).rejects.toEqual({ code: 40002 }); await expect(run()).rejects.toThrow("响应为空"); });
    expect(method).toHaveBeenCalledTimes(2);
  }
});
test.each([undefined, role("x", "", { display: null }), role("x", "", { deleted: true }), role("x", "", { enabled: false }), role("x", "", { eligible: false }), role("x", "", { identityToken: null })])("空、归档或无权角色不可被选作发表身份 %#", (state) => expect(canPublishAsIdentity(state)).toBe(false));
test("有效角色允许发表", () => expect(canPublishAsIdentity(role())).toBe(true));

test("已确认创建先写集合并返回稳定角色，即使刷新失败也不伪装POST失败", async () => {
  const { wrapper, client } = setup();
  client.setQueryData(queryKeys.threadIdentities.collection("t1", "u1"), collection());
  vi.spyOn(client, "invalidateQueries").mockRejectedValue(new TypeError("refresh offline"));
  const saved = role("rp-new"); mocks.POST.mockResolvedValueOnce({ data: { data: saved } });
  const { result } = renderHook(() => useMutateRpIdentity("t1"), { wrapper });
  await act(async () => { expect(await result.current.create.mutateAsync({ nickname: "新角色" })).toEqual(saved); });
  expect(client.getQueryData(queryKeys.threadIdentities.collection("t1", "u1"))).toMatchObject({ activeCount: 2, identities: [role(), saved] });
  expect(mocks.POST).toHaveBeenCalledTimes(1);
});
test("清空仍占位，归档才从本地集合删除；不自行提拔默认角色", async () => {
  const { wrapper, client } = setup();
  const key = queryKeys.threadIdentities.collection("t1", "u1");
  client.setQueryData(key, collection([role(), role("rp2")]));
  const { result } = renderHook(() => useMutateRpIdentity("t1"), { wrapper });
  mocks.PUT.mockResolvedValueOnce({ data: { data: role("rp1", "", { display: null, identityToken: null }) } });
  await act(async () => { await result.current.update.mutateAsync({ identityId: "rp1", body: { clearNickname: true, version: 3 } }); });
  expect(client.getQueryData(key)).toMatchObject({ activeCount: 2, defaultIdentityId: "rp1" });
  mocks.DELETE.mockResolvedValueOnce({ data: { data: role("rp1", "", { deleted: true, display: null, identity: null }) } });
  await act(async () => { await result.current.remove.mutateAsync({ identityId: "rp1", version: 4 }); });
  expect(client.getQueryData(key)).toMatchObject({ activeCount: 1, identities: [role("rp2")], defaultIdentityId: "rp1" });
});
