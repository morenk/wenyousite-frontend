/** useUnreadCount hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUnreadCount } from "@/api/hooks/use-unread-count";
import React from "react";

const { mockGET } = vi.hoisted(() => ({
  mockGET: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { GET: mockGET },
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

describe("useUnreadCount", () => {
  test("成功获取未读数", async () => {
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: { unreadCount: 3 } },
      error: undefined,
    });

    const { result } = renderHook(() => useUnreadCount("u1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/notifications/unread");
    expect(result.current.data).toBe(3);
  });

  test("无数据时返回 0", async () => {
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: { unreadCount: 0 } },
      error: undefined,
    });

    const { result } = renderHook(() => useUnreadCount("u1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(0);
  });

  test("未登录时不发起请求且 data 为空", async () => {
    mockGET.mockClear();

    const { result } = renderHook(() => useUnreadCount(undefined), {
      wrapper: createWrapper(),
    });

    expect(mockGET).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  test("登录后 userId 从空变为有效值时重新拉取未读数（回归：导航徽标登录即刷新）", async () => {
    mockGET.mockClear();
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: { unreadCount: 5 } },
      error: undefined,
    });

    const { result, rerender } = renderHook(
      ({ userId }: { userId?: string }) => useUnreadCount(userId),
      {
        initialProps: { userId: undefined } as { userId?: string },
        wrapper: createWrapper(),
      },
    );

    expect(mockGET).not.toHaveBeenCalled();

    rerender({ userId: "u1" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/notifications/unread");
    expect(result.current.data).toBe(5);
  });
});
