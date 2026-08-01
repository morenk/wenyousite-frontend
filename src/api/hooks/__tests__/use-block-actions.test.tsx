/** useBlockActions hook 测试：拉黑/取消拉黑 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useBlockActions } from "@/api/hooks/use-block-actions";
import React from "react";

const { mockPOST, mockDELETE } = vi.hoisted(() => ({
  mockPOST: vi.fn(),
  mockDELETE: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { POST: mockPOST, DELETE: mockDELETE },
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
      params: { path: { id: "u2" } },
    });
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
      params: { path: { id: "u2" } },
    });
  });
});
