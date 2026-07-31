/** useDeleteThread hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDeleteThread } from "@/api/hooks/use-delete-thread";

const { mockDELETE } = vi.hoisted(() => ({
  mockDELETE: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { DELETE: mockDELETE },
}));

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

describe("useDeleteThread", () => {
  test("删除成功", async () => {
    mockDELETE.mockResolvedValueOnce({
      data: { code: 0, message: "ok", data: null },
      error: undefined,
    });

    const { result } = renderHook(() => useDeleteThread(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("t1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  test("删除无权限的帖子时进入 error", async () => {
    mockDELETE.mockRejectedValueOnce({ code: 40300, message: "无权限" });

    const { result } = renderHook(() => useDeleteThread(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("t1");

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  test("网络错误时进入 error", async () => {
    mockDELETE.mockRejectedValueOnce(new Error("网络错误"));

    const { result } = renderHook(() => useDeleteThread(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("t1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/网络错误/);
  });
});
