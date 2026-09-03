/** usePinPost hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePinPost } from "@/api/hooks/use-pin-post";

const { mockPOST, mockDELETE } = vi.hoisted(() => ({
  mockPOST: vi.fn(),
  mockDELETE: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { POST: mockPOST, DELETE: mockDELETE },
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

describe("usePinPost", () => {
  test("置顶成功并调用当前帖子 path", async () => {
    mockPOST.mockResolvedValueOnce({
      data: { code: 0, message: "ok", data: { id: "post-1" } },
      error: undefined,
    });

    const { result } = renderHook(() => usePinPost(), { wrapper: createWrapper() });
    result.current.mutate({ postId: "post-1", pinned: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/posts/{id}/pin", {
      params: { path: { id: "post-1" } },
    });
  });

  test("取消置顶调用 DELETE", async () => {
    mockDELETE.mockResolvedValueOnce({
      data: { code: 0, message: "ok" },
      error: undefined,
    });

    const { result } = renderHook(() => usePinPost(), { wrapper: createWrapper() });
    result.current.mutate({ postId: "post-1", pinned: false });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDELETE).toHaveBeenCalledWith("/api/v1/posts/{id}/pin", {
      params: { path: { id: "post-1" } },
    });
  });

  test("接口返回错误时进入 error", async () => {
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: { code: 40000, message: "置顶数量已达上限" },
    });

    const { result } = renderHook(() => usePinPost(), { wrapper: createWrapper() });
    result.current.mutate({ postId: "post-1", pinned: true });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: 40000 });
  });
});
