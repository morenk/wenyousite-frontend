import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminContent, useAdminContentDetail, useAdminContentTaxonomy, useAdminUserDetail } from "../admin/use-admin-content";
import { queryKeys } from "@/api/query-keys";

const api = vi.hoisted(() => ({ GET: vi.fn(), PATCH: vi.fn() }));
vi.mock("@/api/client", () => ({ apiClient: api }));
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}
beforeEach(() => vi.clearAllMocks());
describe("后台内容与资料查询", () => {
  it("完整传递筛选与不透明游标", async () => {
    api.GET.mockResolvedValue({ data: { data: [], meta: { cursor: "next", hasMore: true } } });
    const filters = { type: "moment" as const, authorId: "a", q: "中文", status: "HIDDEN" as const, limit: 50 as const, cursor: "opaque" };
    const { wrapper } = setup();
    const result = renderHook(() => useAdminContent(filters), { wrapper });
    await waitFor(() => expect(result.result.current.isSuccess).toBe(true));
    expect(api.GET).toHaveBeenCalledWith("/api/v1/admin/content", { params: { query: filters } });
    expect(result.result.current.data?.meta?.cursor).toBe("next");
  });
  it("详情使用管理接口且失败不伪造资料", async () => {
    api.GET.mockResolvedValue({ error: { code: 40400, message: "not found" } });
    const { wrapper } = setup();
    const result = renderHook(() => useAdminUserDetail("missing"), { wrapper });
    await waitFor(() => expect(result.result.current.isError).toBe(true));
    expect(result.result.current.data).toBeUndefined();
    expect(api.GET).toHaveBeenCalledTimes(1);
  });
  it("分类标签保存更新详情并刷新公开消费者和后台列表", async () => {
    api.PATCH.mockResolvedValue({ data: { data: { id: "thread-1", version: 2 } } });
    const { client, wrapper } = setup();
    const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
    const result = renderHook(() => useAdminContentTaxonomy(), { wrapper });
    await result.result.current.mutateAsync({ id: "thread-1", version: 1, reason: "整理", category: "RPG", tagIds: [] });
    expect(api.PATCH).toHaveBeenCalledWith("/api/v1/admin/content/thread/{id}/taxonomy", { params: { path: { id: "thread-1" } }, body: { version: 1, reason: "整理", category: "RPG", tagIds: [] } });
    expect(client.getQueryData(queryKeys.admin.contentDetail("thread", "thread-1"))).toEqual({ id: "thread-1", version: 2 });
    expect(invalidate.mock.calls.map(([filter]) => filter?.queryKey)).toEqual(expect.arrayContaining([queryKeys.admin.contentRoot, queryKeys.admin.auditsRoot, queryKeys.threads.all, queryKeys.threads.details, queryKeys.search.all, queryKeys.bookmarks.all, queryKeys.users.all]));
  });
});

it("安全内容详情只读取管理端授权结果，拒绝响应不保留正文", async () => {
  const { wrapper } = setup();
  api.GET.mockResolvedValueOnce({ data: { data: { id: "safe", content: "公开正文", media: [] } } });
  const result = renderHook(({ id }) => useAdminContentDetail("thread", id), { wrapper, initialProps: { id: "safe" } });
  await waitFor(() => expect(result.result.current.data?.content).toBe("公开正文"));
  api.GET.mockResolvedValueOnce({ error: { code: 40400, message: "不可查看" } });
  result.rerender({ id: "private" });
  await waitFor(() => expect(result.result.current.isError).toBe(true));
  expect(result.result.current.data).toBeUndefined();
  expect(api.GET).toHaveBeenLastCalledWith("/api/v1/admin/content/{type}/{id}", { params: { path: { type: "thread", id: "private" } } });
});
it("用户资料保留业务日和四类计数，列表请求失败不伪造空结果", async () => {
  const { wrapper } = setup();
  const data = { id: "u", lastActiveDate: null, contentCounts: { thread: 2, post: 3, moment: 4, moment_comment: 5 } };
  api.GET.mockResolvedValueOnce({ data: { data } });
  const user = renderHook(() => useAdminUserDetail("u"), { wrapper });
  await waitFor(() => expect(user.result.current.data).toEqual(data));
  api.GET.mockResolvedValueOnce({ error: { code: 50000, message: "读取失败" } });
  const list = renderHook(() => useAdminContent({ type: "thread" }), { wrapper });
  await waitFor(() => expect(list.result.current.isError).toBe(true));
  expect(list.result.current.data).toBeUndefined();
});
it("整理请求失败保留已有缓存且不发成功失效通知", async () => {
  const { client, wrapper } = setup();
  const key = queryKeys.admin.contentDetail("thread", "thread-1");
  client.setQueryData(key, { id: "thread-1", category: "RPG", version: 1 });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const error = { code: 40002, message: "版本冲突" };
  api.PATCH.mockResolvedValueOnce({ error });
  const mutation = renderHook(() => useAdminContentTaxonomy(), { wrapper });
  await expect(mutation.result.current.mutateAsync({ id: "thread-1", version: 1, reason: "整理内容", category: "OTHER" })).rejects.toEqual(error);
  expect(client.getQueryData(key)).toEqual({ id: "thread-1", category: "RPG", version: 1 });
  expect(invalidate).not.toHaveBeenCalled();
});
