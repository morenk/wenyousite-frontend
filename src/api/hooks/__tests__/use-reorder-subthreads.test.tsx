/** useReorderSubthreads hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useReorderSubthreads } from "@/api/hooks/use-reorder-subthreads";

const { mockPUT } = vi.hoisted(() => ({
  mockPUT: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { PUT: mockPUT },
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

describe("useReorderSubthreads", () => {
  test("重新排序成功", async () => {
    mockPUT.mockResolvedValueOnce({
      data: { code: 0, message: "ok" },
      error: undefined,
    });

    const { result } = renderHook(() => useReorderSubthreads(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      threadId: "thread-1",
      ids: ["sub-a", "sub-c", "sub-b"],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  test("网络错误时进入 error", async () => {
    mockPUT.mockRejectedValueOnce(new Error("网络错误"));

    const { result } = renderHook(() => useReorderSubthreads(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      threadId: "thread-1",
      ids: ["sub-a", "sub-b"],
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/网络错误/);
  });
});
