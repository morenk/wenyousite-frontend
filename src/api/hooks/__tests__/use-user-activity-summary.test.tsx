import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { useUserActivitySummary } from "@/api/hooks/use-user-activity-summary";

const { mockGET } = vi.hoisted(() => ({ mockGET: vi.fn() }));

vi.mock("@/api/client", () => ({ apiClient: { GET: mockGET } }));

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useUserActivitySummary", () => {
  test("按查看者隔离的查询获取精确活动汇总", async () => {
    mockGET.mockResolvedValue({
      data: {
        code: 0,
        message: "ok",
        data: {
          momentCount: 7,
          createdThreadCount: 3,
          playedThreadCount: 4,
          replyCount: 28,
        },
      },
      error: undefined,
    });

    const { result } = renderHook(() => useUserActivitySummary("user-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/users/{id}/activity-summary", {
      params: { path: { id: "user-1" } },
    });
    expect(result.current.data).toEqual({
      momentCount: 7,
      createdThreadCount: 3,
      playedThreadCount: 4,
      replyCount: 28,
    });
  });
});
