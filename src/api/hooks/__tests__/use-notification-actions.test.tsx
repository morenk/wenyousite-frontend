/** useNotificationActions hook 测试：标记已读 / 删除 / 全部已读 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useNotificationActions } from "@/api/hooks/use-notification-actions";
import React from "react";

const { mockPATCH, mockDELETE, mockPOST } = vi.hoisted(() => ({
  mockPATCH: vi.fn(),
  mockDELETE: vi.fn(),
  mockPOST: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { PATCH: mockPATCH, DELETE: mockDELETE, POST: mockPOST },
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

describe("useNotificationActions", () => {
  test("标记已读：PATCH 带 isRead true", async () => {
    mockPATCH.mockResolvedValue({
      data: { code: 0, message: "ok", data: { message: "已标记为已读" } },
      error: undefined,
    });

    const { result } = renderHook(() => useNotificationActions(), {
      wrapper: createWrapper(),
    });

    result.current.markRead.mutate("n1");
    await waitFor(() => expect(result.current.markRead.isSuccess).toBe(true));
    expect(mockPATCH).toHaveBeenCalledWith("/api/v1/notifications/{id}", {
      params: { path: { id: "n1" } },
      body: { isRead: true },
    });
  });

  test("删除通知：DELETE 无 body", async () => {
    mockDELETE.mockResolvedValue({
      data: { code: 0, message: "ok", data: { message: "已删除" } },
      error: undefined,
    });

    const { result } = renderHook(() => useNotificationActions(), {
      wrapper: createWrapper(),
    });

    result.current.remove.mutate("n1");
    await waitFor(() => expect(result.current.remove.isSuccess).toBe(true));
    expect(mockDELETE).toHaveBeenCalledWith("/api/v1/notifications/{id}", {
      params: { path: { id: "n1" } },
    });
  });

  test("全部已读：POST 无 body", async () => {
    mockPOST.mockResolvedValue({
      data: { code: 0, message: "ok", data: { message: "全部已标记为已读" } },
      error: undefined,
    });

    const { result } = renderHook(() => useNotificationActions(), {
      wrapper: createWrapper(),
    });

    result.current.markAllRead.mutate();
    await waitFor(() => expect(result.current.markAllRead.isSuccess).toBe(true));
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/notifications/read-all");
  });
});
