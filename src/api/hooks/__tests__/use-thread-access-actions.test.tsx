/** 主题帖邀请与成员加入/退出 hooks 测试 */

import { describe, expect, test, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useCreateInviteLink,
  useExitThreadPlayer,
  useInvitePreview,
  useJoinThreadByInvite,
} from "@/api/hooks/use-thread-access-actions";

const { mockGET, mockPOST, mockDELETE } = vi.hoisted(() => ({
  mockGET: vi.fn(), mockPOST: vi.fn(), mockDELETE: vi.fn(),
}));
vi.mock("@/api/client", () => ({ apiClient: { GET: mockGET, POST: mockPOST, DELETE: mockDELETE } }));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("主题帖访问操作 hooks", () => {
  test("生成邀请链接", async () => {
    mockPOST.mockResolvedValueOnce({ data: { data: { threadId: "t1", token: "invite-token" } }, error: undefined });
    const { result } = renderHook(() => useCreateInviteLink(), { wrapper: createWrapper() });
    result.current.mutate("t1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.token).toBe("invite-token");
  });

  test("预览并通过邀请加入", async () => {
    mockGET.mockResolvedValueOnce({ data: { data: { thread: { id: "t1", title: "私密帖", category: "RPG", status: "RECRUITING", owner: { id: "u1", username: "楼主", avatar: null }, memberCount: 2, createdAt: "2026-08-01T00:00:00Z" } } }, error: undefined });
    const wrapper = createWrapper();
    const preview = renderHook(() => useInvitePreview("invite-token"), { wrapper });
    await waitFor(() => expect(preview.result.current.isSuccess).toBe(true));
    expect(preview.result.current.data?.thread.title).toBe("私密帖");

    mockPOST.mockResolvedValueOnce({ data: { data: { thread: { id: "t1", title: "私密帖" } } }, error: undefined });
    const join = renderHook(() => useJoinThreadByInvite(), { wrapper });
    join.result.current.mutate("invite-token");
    await waitFor(() => expect(join.result.current.isSuccess).toBe(true));
  });

  test("退出玩家身份", async () => {
    const wrapper = createWrapper();
    mockDELETE.mockResolvedValueOnce({ data: { data: { message: "已退出主题帖" } }, error: undefined });
    const exit = renderHook(() => useExitThreadPlayer(), { wrapper });
    exit.result.current.mutate("t1");
    await waitFor(() => expect(exit.result.current.isSuccess).toBe(true));
    expect(mockDELETE).toHaveBeenCalledWith("/api/v1/threads/{threadId}/members/me", { params: { path: { threadId: "t1" } } });
  });
});
