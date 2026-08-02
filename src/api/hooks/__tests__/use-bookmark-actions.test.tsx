/** useBookmarkActions hook 测试：收藏/取消收藏 + 失效 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useBookmarkActions } from "@/api/hooks/use-bookmark-actions";
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

describe("useBookmarkActions", () => {
  test("收藏：POST 带 threadId", async () => {
    mockPOST.mockResolvedValue({
      data: { code: 0, message: "ok", data: { id: "bm1" } },
      error: undefined,
    });

    const { result } = renderHook(() => useBookmarkActions("t1"), {
      wrapper: createWrapper(),
    });

    result.current.add.mutate();
    await waitFor(() => expect(result.current.add.isSuccess).toBe(true));
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/bookmarks", {
      body: { threadId: "t1" },
    });
  });

  test("取消收藏：DELETE 按 bookmarkId", async () => {
    mockDELETE.mockResolvedValue({
      data: { code: 0, message: "ok", data: { message: "已取消收藏" } },
      error: undefined,
    });

    const { result } = renderHook(() => useBookmarkActions("t1"), {
      wrapper: createWrapper(),
    });

    result.current.remove.mutate("bm1");
    await waitFor(() => expect(result.current.remove.isSuccess).toBe(true));
    expect(mockDELETE).toHaveBeenCalledWith("/api/v1/bookmarks/{id}", {
      params: { path: { id: "bm1" } },
    });
  });
});
