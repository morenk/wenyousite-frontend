/** 主题帖邀请与成员加入/退出 hooks 测试 */

import { describe, expect, test, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { queryKeys } from "@/api/query-keys";
import {
  useCreateInviteLink,
  useEnsureInviteLink,
  useExitThreadPlayer,
  useInvitePreview,
  useJoinThreadByInvite,
} from "@/api/hooks/use-thread-access-actions";

const { mockGET, mockPOST, mockPUT, mockDELETE } = vi.hoisted(() => ({
  mockGET: vi.fn(), mockPOST: vi.fn(), mockPUT: vi.fn(), mockDELETE: vi.fn(),
}));
vi.mock("@/api/client", () => ({ apiClient: { GET: mockGET, POST: mockPOST, PUT: mockPUT, DELETE: mockDELETE } }));

function createWrapper(queryRetry: boolean | number = false, mutationRetry: boolean | number = false) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: queryRetry, retryDelay: 0 },
      mutations: { retry: mutationRetry, retryDelay: 0 },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { wrapper: Wrapper, queryClient };
}

describe("主题帖访问操作 hooks", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  test("生成邀请链接", async () => {
    mockPOST.mockResolvedValueOnce({ data: { data: { threadId: "t1", token: "AbCdEfGh12345678" } }, error: undefined });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateInviteLink(), { wrapper });
    result.current.mutate("t1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.token).toBe("AbCdEfGh12345678");
  });

  test("复制入口每次使用 PUT 而非轮换 POST", async () => {
    mockPUT.mockResolvedValue({ data: { data: { threadId: "t1", token: "AbCdEfGh12345678" } } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useEnsureInviteLink(), { wrapper });
    const first = await result.current.mutateAsync("t1");
    const second = await result.current.mutateAsync("t1");
    expect(first).toEqual(second);
    expect(mockPUT).toHaveBeenCalledTimes(2);
    expect(mockPUT).toHaveBeenCalledWith("/api/v1/threads/{id}/invite-link", { params: { path: { id: "t1" } } });
    expect(mockPOST).not.toHaveBeenCalled();
  });

  test.each(["PUT", "POST"])("%s 失败不使用全局重试配置", async (method) => {
    const request = method === "PUT" ? mockPUT : mockPOST;
    request.mockRejectedValue(new TypeError("offline"));
    const { wrapper } = createWrapper(false, 3);
    const { result } = renderHook(method === "PUT" ? useEnsureInviteLink : useCreateInviteLink, { wrapper });
    await expect(result.current.mutateAsync("t1")).rejects.toThrow("offline");
    expect(request).toHaveBeenCalledTimes(1);
  });

  test.each([undefined, {}, { threadId: "other", token: "AbCdEfGh12345678" }, { threadId: "t1", token: "bad" }, { threadId: "t1", token: "<unsafe-token/>!" }])("无效邀请响应不作为可分享凭据", async (invite) => {
    for (const method of ["PUT", "POST"]) {
      const request = method === "PUT" ? mockPUT : mockPOST;
      request.mockResolvedValue({ data: { data: invite } });
      const { wrapper } = createWrapper();
      const { result, unmount } = renderHook(method === "PUT" ? useEnsureInviteLink : useCreateInviteLink, { wrapper });
      await expect(result.current.mutateAsync("t1")).rejects.toThrow("邀请链接响应无效");
      unmount();
    }
  });

  test("PUT 404 不回退轮换并保留服务端错误", async () => {
    const error = { code: 40400, message: "接口不存在" };
    mockPUT.mockResolvedValue({ error });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useEnsureInviteLink(), { wrapper });
    await expect(result.current.mutateAsync("t1")).rejects.toBe(error);
    expect(mockPOST).not.toHaveBeenCalled();
  });

  test("预览并通过邀请加入", async () => {
    mockGET.mockResolvedValueOnce({ data: { data: { thread: { id: "t1", title: "私密帖", category: "RPG", status: "RECRUITING", owner: { id: "u1", username: "楼主", avatar: null }, memberCount: 2, createdAt: "2026-08-01T00:00:00Z" }, alreadyJoined: false } }, error: undefined });
    const { wrapper, queryClient } = createWrapper();
    queryClient.setQueryData(["user", "played-threads", "u2"], { pages: [] });
    const preview = renderHook(() => useInvitePreview("invite-token"), { wrapper });
    await waitFor(() => expect(preview.result.current.isSuccess).toBe(true));
    expect(preview.result.current.data?.thread.title).toBe("私密帖");

    mockPOST.mockResolvedValueOnce({ data: { data: { thread: { id: "t1", title: "私密帖" } } }, error: undefined });
    const join = renderHook(() => useJoinThreadByInvite(), { wrapper });
    join.result.current.mutate("invite-token");
    await waitFor(() => expect(join.result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryState(["user", "played-threads", "u2"])?.isInvalidated).toBe(true);
  });

  test("已加入缓存也必须挂载复核，404保留data但标记本次复核已完成", async () => {
    let finish!: (value: unknown) => void;
    mockGET.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { wrapper, queryClient } = createWrapper();
    queryClient.setQueryData(queryKeys.invitePreview("cached-token"), { alreadyJoined: true });
    const { result } = renderHook(() => useInvitePreview("cached-token"), { wrapper });
    expect(result.current.isFetchedAfterMount).toBe(false);
    expect(result.current.isFetching).toBe(true);
    finish({ error: { code: 40408, message: "邀请已失效" } });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isFetchedAfterMount).toBe(true);
    expect(result.current.data?.alreadyJoined).toBe(true);
  });

  test("失效邀请预览不重复请求 404", async () => {
    mockGET.mockClear();
    mockGET.mockResolvedValue({
      data: undefined,
      error: { code: 40404, message: "邀请链接无效或已失效" },
    });
    const { wrapper } = createWrapper(3);

    const preview = renderHook(() => useInvitePreview("expired-token"), { wrapper });

    await waitFor(() => expect(preview.result.current.isError).toBe(true));
    expect(mockGET).toHaveBeenCalledTimes(1);
  });

  test("退出玩家身份", async () => {
    const { wrapper } = createWrapper();
    mockDELETE.mockResolvedValueOnce({ data: { data: { message: "已退出主题帖" } }, error: undefined });
    const exit = renderHook(() => useExitThreadPlayer(), { wrapper });
    exit.result.current.mutate("t1");
    await waitFor(() => expect(exit.result.current.isSuccess).toBe(true));
    expect(mockDELETE).toHaveBeenCalledWith("/api/v1/threads/{threadId}/members/me", { params: { path: { threadId: "t1" } } });
  });
});
