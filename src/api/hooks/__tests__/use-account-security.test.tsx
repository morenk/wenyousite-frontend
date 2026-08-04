/** 账号安全 hooks 测试：设备会话、黑名单与注销账号 */

import { describe, expect, test, vi } from "vitest";
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

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("账号安全 hooks", () => {
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

  test("撤销指定会话", async () => {
    mockDELETE.mockResolvedValueOnce({ data: { data: { message: "已撤销" } }, error: undefined });
    const { result } = renderHook(() => useRevokeSession(), { wrapper: createWrapper() });
    result.current.mutate("session-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDELETE).toHaveBeenCalledWith("/api/v1/auth/sessions/{id}", {
      params: { path: { id: "session-1" } },
    });
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
