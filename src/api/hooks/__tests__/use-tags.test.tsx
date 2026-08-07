import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useTag } from "@/api/hooks/use-tags";

const { mockGET } = vi.hoisted(() => ({ mockGET: vi.fn() }));

vi.mock("@/api/client", () => ({
  apiClient: { GET: mockGET },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useTag", () => {
  test("按 ID 获取标签详情", async () => {
    mockGET.mockResolvedValue({
      data: {
        code: 0,
        message: "ok",
        data: {
          id: "cms7rnyij000z7qdyg6zbge8e",
          name: "无限流",
          color: null,
          createdAt: "2026-08-07T00:00:00Z",
        },
      },
      error: undefined,
    });

    const { result } = renderHook(() => useTag("cms7rnyij000z7qdyg6zbge8e"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/tags/{id}", {
      params: { path: { id: "cms7rnyij000z7qdyg6zbge8e" } },
    });
    expect(result.current.data?.name).toBe("无限流");
  });

  test("标签接口失败时进入错误状态", async () => {
    mockGET.mockResolvedValue({
      data: undefined,
      error: { message: "标签不存在" },
    });

    const { result } = renderHook(() => useTag("missing-tag"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
