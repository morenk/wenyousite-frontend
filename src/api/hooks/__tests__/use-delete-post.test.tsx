/** useDeletePost hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDeletePost } from "@/api/hooks/use-delete-post";

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

describe("useDeletePost", () => {
  test("删除成功", async () => {
    mockDELETE.mockResolvedValueOnce({
      data: { code: 0, message: "ok" },
      error: undefined,
    });

    const { result } = renderHook(() => useDeletePost(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("post-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  test("删除无权限的楼层时进入 error", async () => {
    mockDELETE.mockRejectedValueOnce({ code: 40300, message: "无权删除" });

    const { result } = renderHook(() => useDeletePost(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("post-1");

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  test("网络错误时进入 error", async () => {
    mockDELETE.mockRejectedValueOnce(new Error("网络错误"));

    const { result } = renderHook(() => useDeletePost(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("post-1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/网络错误/);
  });
});
