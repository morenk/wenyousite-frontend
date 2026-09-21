import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useFollowActions } from "@/api/hooks/use-follow-actions";
import { queryKeys } from "@/api/query-keys";
import { setAuthSession, clearAuthSession } from "@/lib/auth-store";

const { mockPOST, mockDELETE, mockGET } = vi.hoisted(() => ({
  mockPOST: vi.fn(), mockDELETE: vi.fn(), mockGET: vi.fn(),
}));
vi.mock("@/api/client", () => ({ apiClient: { POST: mockPOST, DELETE: mockDELETE, GET: mockGET } }));

const actor = { id: "u1", username: "我", email: "me@example.test", role: "USER", avatar: null };
const target = { id: "u2", username: "对方", avatar: null, level: 1, viewerIsFollowing: true, viewerIsFollowedBy: true };
const key = (kind: "following" | "followers") => queryKeys.users.followListsForViewer(kind, "u1", "u1");
const ok = { data: { code: 0, data: { message: "ok" } } };
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(key("following"), [target]);
  client.setQueryData(key("followers"), [target]);
  function Wrapper({ children }: { children: React.ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  return { client, ...renderHook(() => useFollowActions("u2"), { wrapper: Wrapper }) };
}
beforeEach(() => { vi.resetAllMocks(); setAuthSession(actor, "test-only-token"); mockPOST.mockResolvedValue(ok); mockDELETE.mockResolvedValue(ok); });
afterEach(() => clearAuthSession());

describe("关系写入", () => {
  test("取消关注移出本人关注，保留粉丝并更新方向，失效资料与本人计数", async () => {
    const { client, result } = setup();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await act(() => result.current.unfollow.mutateAsync());
    expect(mockDELETE).toHaveBeenCalledWith("/api/v1/users/follow/{id}", {
      params: { path: { id: "u2" } }, signal: expect.any(AbortSignal),
    });
    expect(client.getQueryData(key("following"))).toEqual([]);
    expect(client.getQueryData(key("followers"))).toEqual([{ ...target, viewerIsFollowing: false }]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.users.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.me });
  });
  test("移除粉丝保留我关注对方", async () => {
    const { client, result } = setup();
    await act(() => result.current.removeFollower.mutateAsync());
    expect(mockDELETE).toHaveBeenCalledWith("/api/v1/users/me/followers/{id}", expect.objectContaining({ params: { path: { id: "u2" } } }));
    expect(client.getQueryData(key("followers"))).toEqual([]);
    expect(client.getQueryData(key("following"))).toEqual([{ ...target, viewerIsFollowedBy: false }]);
  });
  test("回关后粉丝仍在原位并显示互关", async () => {
    const { client, result } = setup();
    client.setQueryData(key("followers"), [{ ...target, viewerIsFollowing: false }]);
    await act(() => result.current.follow.mutateAsync());
    expect(mockPOST).toHaveBeenCalledOnce();
    expect(client.getQueryData(key("followers"))).toEqual([target]);
  });
  test("明确失败保留两向数据，不自动重试", async () => {
    mockDELETE.mockResolvedValue({ error: { message: "无权操作" }, response: { status: 403 } });
    const { client, result } = setup();
    await act(async () => { await expect(result.current.unfollow.mutateAsync()).rejects.toThrow("无权操作"); });
    expect(client.getQueryData(key("following"))).toEqual([target]);
    expect(mockDELETE).toHaveBeenCalledOnce();
    expect(mockGET).not.toHaveBeenCalled();
  });
  test("传输中断后只读确认移除已完成，正常收敛", async () => {
    mockDELETE.mockRejectedValue(new TypeError("network"));
    mockGET.mockResolvedValue({ data: { data: [] } });
    const { client, result } = setup();
    await act(() => result.current.removeFollower.mutateAsync());
    expect(client.getQueryData(key("followers"))).toEqual([]);
    expect(mockGET).toHaveBeenCalledTimes(2);
    expect(mockDELETE).toHaveBeenCalledOnce();
  });
  test("未能读回结果时保留原项并提示核实", async () => {
    mockDELETE.mockRejectedValue(new TypeError("network"));
    mockGET.mockRejectedValue(new TypeError("offline"));
    const { client, result } = setup();
    await act(async () => { await expect(result.current.unfollow.mutateAsync()).rejects.toThrow("请刷新核实"); });
    expect(client.getQueryData(key("following"))).toEqual([target]);
    expect(mockDELETE).toHaveBeenCalledOnce();
  });
  test("已读回但关系未达到预期，不声称成功", async () => {
    mockPOST.mockRejectedValue(new TypeError("network"));
    mockGET.mockResolvedValue({ data: { data: [] } });
    const { result } = setup();
    await act(async () => { await expect(result.current.follow.mutateAsync()).rejects.toThrow("已刷新最新关系"); });
    expect(mockPOST).toHaveBeenCalledOnce();
  });
  test("退出再登录同账号时旧响应不修补新会话缓存", async () => {
    let release!: (value: unknown) => void;
    mockDELETE.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const { client, result } = setup();
    let pending!: Promise<void>;
    act(() => { pending = result.current.unfollow.mutateAsync(); });
    await waitFor(() => expect(mockDELETE).toHaveBeenCalledOnce());
    act(() => { clearAuthSession(); setAuthSession(actor, "new-session"); });
    await act(async () => { release(ok); await expect(pending).rejects.toThrow("登录状态已变化"); });
    expect(client.getQueryData(key("following"))).toEqual([target]);
  });
  test("跨组件挂载共享忙碌并阻止相反写入", async () => {
    let release!: (value: unknown) => void;
    mockDELETE.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const { client, result, unmount } = setup();
    let pending!: Promise<void>;
    act(() => { pending = result.current.unfollow.mutateAsync(); });
    await waitFor(() => expect(mockDELETE).toHaveBeenCalledOnce());
    unmount();
    function Wrapper({ children }: { children: React.ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
    const second = renderHook(() => useFollowActions("u2"), { wrapper: Wrapper });
    expect(second.result.current.isPending).toBe(true);
    await act(async () => { await expect(second.result.current.follow.mutateAsync()).rejects.toThrow("正在更新"); });
    expect(mockPOST).not.toHaveBeenCalled();
    await act(async () => { release(ok); await pending; });
    await waitFor(() => expect(second.result.current.isPending).toBe(false));
  });
  test("结果未明锁定重复写入，成功只读核实后解锁", async () => {
    mockDELETE.mockRejectedValue(new TypeError("network"));
    mockGET.mockRejectedValue(new TypeError("offline"));
    const { result } = setup();
    await act(async () => { await expect(result.current.unfollow.mutateAsync()).rejects.toThrow("核实"); });
    await waitFor(() => expect(result.current.needsReconciliation).toBe(true));
    await act(async () => { await expect(result.current.unfollow.mutateAsync()).rejects.toThrow("请先刷新核实"); });
    expect(mockDELETE).toHaveBeenCalledOnce();
    mockGET.mockResolvedValue({ data: { data: [] } });
    await act(() => result.current.reconcile.mutateAsync());
    await waitFor(() => expect(result.current.needsReconciliation).toBe(false));
    expect(mockDELETE).toHaveBeenCalledOnce();
  });
  test("成功前取消正在加载的旧列表，迟到读取不能覆盖写入", async () => {
    const { client, result } = setup();
    let release!: (value: unknown) => void;
    const staleRead = client.fetchQuery({ queryKey: key("following"), queryFn: () => new Promise((resolve) => { release = resolve; }) }).catch(() => undefined);
    await act(() => result.current.unfollow.mutateAsync());
    release([target]);
    await staleRead;
    expect(client.getQueryData(key("following"))).toEqual([]);
  });
});
