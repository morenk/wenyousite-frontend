/** useUpdatePost hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUpdatePost } from "@/api/hooks/use-update-post";

const { mockPATCH } = vi.hoisted(() => ({
  mockPATCH: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { PATCH: mockPATCH },
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

describe("useUpdatePost", () => {
  test("编辑成功：以正确 path/body 调用 PATCH 并返回新正文", async () => {
    const updated: Record<string, unknown> = {
      id: "post-1",
      content: "编辑后的内容",
      version: 2,
    };
    mockPATCH.mockResolvedValueOnce({
      data: { code: 0, message: "ok", data: updated },
      error: undefined,
    });

    const { result } = renderHook(() => useUpdatePost(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ postId: "post-1", content: "编辑后的内容", version: 1 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPATCH).toHaveBeenCalledWith("/api/v1/posts/{id}", {
      params: { path: { id: "post-1" } },
      body: { content: "编辑后的内容", version: 1 },
    });
    expect(result.current.data).toEqual(updated);
  });

  test("乐观锁冲突（40900）进入 error", async () => {
    mockPATCH.mockRejectedValueOnce({ code: 40900, message: "内容已被修改" });

    const { result } = renderHook(() => useUpdatePost(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ postId: "post-1", content: "x", version: 1 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: 40900 });
  });

  test("无权编辑（40300）进入 error", async () => {
    mockPATCH.mockRejectedValueOnce({ code: 40300, message: "无权编辑" });

    const { result } = renderHook(() => useUpdatePost(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ postId: "post-1", content: "x", version: 1 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: 40300 });
  });
});
