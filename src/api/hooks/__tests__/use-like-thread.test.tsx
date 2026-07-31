/** useLikeThread hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLikeThread } from "@/api/hooks/use-like-thread";
import React from "react";

const { mockPOST, mockDELETE } = vi.hoisted(() => ({
  mockPOST: vi.fn(),
  mockDELETE: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { POST: mockPOST, DELETE: mockDELETE },
}));

describe("useLikeThread", () => {
  function createWrapper() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function Wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    }
    Wrapper.displayName = "QueryClientWrapper";
    return Wrapper;
  }

  test("like 调用 POST 接口", async () => {
    mockPOST.mockResolvedValue({ error: undefined });

    const { result } = renderHook(() => useLikeThread("thread-1"), {
      wrapper: createWrapper(),
    });

    expect(result.current.like.isPending).toBe(false);

    await act(async () => {
      await result.current.like.mutateAsync();
    });

    expect(mockPOST).toHaveBeenCalledWith(
      "/api/v1/threads/{id}/like",
      { params: { path: { id: "thread-1" } } },
    );
  });

  test("unlike 调用 DELETE 接口", async () => {
    mockDELETE.mockResolvedValue({ error: undefined });

    const { result } = renderHook(() => useLikeThread("thread-2"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.unlike.mutateAsync();
    });

    expect(mockDELETE).toHaveBeenCalledWith(
      "/api/v1/threads/{id}/like",
      { params: { path: { id: "thread-2" } } },
    );
  });

  test("like 成功后 invalidate thread query", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    mockPOST.mockResolvedValue({ error: undefined });

    function Wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    }
    Wrapper.displayName = "QueryClientWrapper";

    const { result } = renderHook(() => useLikeThread("thread-1"), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.like.mutateAsync();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["thread", "thread-1"] });
  });

  test("like 失败时抛出错误", async () => {
    mockPOST.mockRejectedValue(new Error("网络错误"));

    const { result } = renderHook(() => useLikeThread("thread-1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.like.mutateAsync();
      } catch {
        // expected
      }
    });

    expect(result.current.like.isError).toBe(true);
  });
});
