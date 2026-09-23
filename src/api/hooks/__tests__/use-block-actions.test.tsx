/** useBlockActions hook 测试：拉黑/取消拉黑 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useBlockActions } from "@/api/hooks/use-block-actions";
import React from "react";
import { setAuthSession, clearAuthSession } from "@/lib/auth-store";
beforeEach(() => { setAuthSession({ id: "u1", username: "本人", email: "me@example.test", role: "USER", avatar: null }, "test-token"); });
afterEach(() => clearAuthSession());

const { mockPOST, mockDELETE } = vi.hoisted(() => ({
  mockPOST: vi.fn(),
  mockDELETE: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { POST: mockPOST, DELETE: mockDELETE },
}));

function createWrapper(qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

describe("useBlockActions", () => {
  test("拉黑：POST 无 body", async () => {
    mockPOST.mockResolvedValue({
      data: { code: 0, message: "ok", data: { message: "已拉黑" } },
      error: undefined,
    });

    const { result } = renderHook(() => useBlockActions("u2"), {
      wrapper: createWrapper(),
    });

    result.current.block.mutate();
    await waitFor(() => expect(result.current.block.isSuccess).toBe(true));
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/users/me/block/{id}", {
      params: { path: { id: "u2" } }, signal: expect.any(AbortSignal),
    });
  });

  test("拉黑成功立即清除预热的内容缓存，保留无关账户数据", async () => {
    const client = new QueryClient();
    for (const root of ["thread", "search", "post", "moments", "direct-messages"]) {
      client.setQueryData([root, "cached"], { content: "历史内容" });
    }
    client.setQueryData(["wallet", "me"], { balance: 7 });
    mockPOST.mockResolvedValue({ data: { data: { message: "已拉黑" } } });
    const { result } = renderHook(() => useBlockActions("u2"), { wrapper: createWrapper(client) });
    result.current.block.mutate();
    await waitFor(() => expect(result.current.block.isSuccess).toBe(true));
    for (const root of ["thread", "search", "post", "moments", "direct-messages"]) {
      expect(client.getQueryData([root, "cached"])).toBeUndefined();
    }
    expect(client.getQueryData(["wallet", "me"])).toEqual({ balance: 7 });
  });

  test("取消拉黑：DELETE 无 body", async () => {
    mockDELETE.mockResolvedValue({
      data: { code: 0, message: "ok", data: { message: "已取消拉黑" } },
      error: undefined,
    });

    const { result } = renderHook(() => useBlockActions("u2"), {
      wrapper: createWrapper(),
    });

    result.current.unblock.mutate();
    await waitFor(() => expect(result.current.unblock.isSuccess).toBe(true));
    expect(mockDELETE).toHaveBeenCalledWith("/api/v1/users/me/block/{id}", {
      params: { path: { id: "u2" } }, signal: expect.any(AbortSignal),
    });
  });
});
