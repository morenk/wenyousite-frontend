/** 账号安全 hooks 测试：设备会话、黑名单与注销账号 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useAccountSessions,
  useBlockedUsers,
  useDeleteAccount,
  useRevokeSession,
  useUnblockUser,
} from "@/api/hooks/use-account-security";

const { mockGET, mockDELETE } = vi.hoisted(() => ({
  mockGET: vi.fn(),
  mockDELETE: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { GET: mockGET, DELETE: mockDELETE },
}));

function createWrapper(queryOptions: { retry?: boolean | number; retryDelay?: number } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, ...queryOptions },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("账号安全 hooks", () => {
  beforeEach(() => {
    mockGET.mockReset();
    mockDELETE.mockReset();
  });

  test("加载活跃会话", async () => {
    mockGET.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "session-1",
            platform: "web",
            deviceInfo: "Chrome",
            isCurrent: true,
            createdAt: "2026-08-01T00:00:00Z",
            expiresAt: "2026-08-08T00:00:00Z",
          },
        ],
      },
      error: undefined,
    });
    const { result } = renderHook(() => useAccountSessions(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].isCurrent).toBe(true);
  });

  test("429 限流错误不会自动重试", async () => {
    mockGET.mockResolvedValue({
      data: undefined,
      error: { code: 42900, message: "请求过于频繁" },
    });
    const { result } = renderHook(() => useAccountSessions(), {
      wrapper: createWrapper({ retry: 3, retryDelay: 0 }),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockGET).toHaveBeenCalledTimes(1);
  });

  test("撤销指定会话", async () => {
    mockDELETE.mockResolvedValueOnce({ data: { data: { message: "已撤销" } }, error: undefined });
    const { result } = renderHook(() => useRevokeSession(), { wrapper: createWrapper() });
    result.current.mutate("session-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDELETE).toHaveBeenCalledWith("/api/v1/auth/sessions/{id}", {
      params: { path: { id: "session-1" } },
    });
  });

  test("撤销成功后从本地缓存移除会话，不重新请求列表", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(["auth-sessions"], [
      { id: "current", platform: "web", deviceInfo: null, isCurrent: true, createdAt: "2026-08-01", expiresAt: "2026-08-08" },
      { id: "remote", platform: "web", deviceInfo: null, isCurrent: false, createdAt: "2026-08-01", expiresAt: "2026-08-08" },
    ]);
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    mockDELETE.mockResolvedValueOnce({ data: { data: { message: "已撤销" } }, error: undefined });

    const { result } = renderHook(() => useRevokeSession(), { wrapper: Wrapper });
    result.current.mutate("remote");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData<{ id: string }[]>(["auth-sessions"])).toEqual([
      expect.objectContaining({ id: "current" }),
    ]);
    expect(mockGET).not.toHaveBeenCalled();
  });

  test("加载黑名单并取消拉黑", async () => {
    mockGET.mockResolvedValueOnce({
      data: { data: [{ id: "block-1", blocked: { id: "u2", username: "用户二", avatar: null } }] },
      error: undefined,
    });
    const wrapper = createWrapper();
    const blocked = renderHook(() => useBlockedUsers(), { wrapper });
    await waitFor(() => expect(blocked.result.current.isSuccess).toBe(true));
    expect(blocked.result.current.data?.[0].blocked.username).toBe("用户二");

    mockDELETE.mockResolvedValueOnce({ data: { data: { message: "已取消拉黑" } }, error: undefined });
    const unblock = renderHook(() => useUnblockUser(), { wrapper });
    unblock.result.current.mutate("u2");
    await waitFor(() => expect(unblock.result.current.isSuccess).toBe(true));
    expect(mockDELETE).toHaveBeenCalledWith("/api/v1/users/me/block/{id}", {
      params: { path: { id: "u2" } },
    });
  });

  test("注销账号", async () => {
    mockDELETE.mockResolvedValueOnce({ data: { data: { message: "账号已注销" } }, error: undefined });
    const { result } = renderHook(() => useDeleteAccount(), { wrapper: createWrapper() });
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDELETE).toHaveBeenCalledWith("/api/v1/users/me");
  });
});
