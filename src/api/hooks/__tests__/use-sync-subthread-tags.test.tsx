/** useSyncSubthreadTags hook 测试 */

import { describe, expect, test, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useSyncSubthreadTags } from "@/api/hooks/use-sync-subthread-tags";

const { mockPOST, mockDELETE } = vi.hoisted(() => ({ mockPOST: vi.fn(), mockDELETE: vi.fn() }));
vi.mock("@/api/client", () => ({ apiClient: { POST: mockPOST, DELETE: mockDELETE } }));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useSyncSubthreadTags", () => {
  test("只添加新增标签并移除缺失标签", async () => {
    mockPOST.mockResolvedValue({ data: { data: {} }, error: undefined });
    mockDELETE.mockResolvedValue({ data: { data: {} }, error: undefined });
    const { result } = renderHook(() => useSyncSubthreadTags(), { wrapper: createWrapper() });
    result.current.mutate({
      subthreadId: "s1",
      existingTags: [
        { id: "tag-keep", name: "保留", color: null },
        { id: "tag-remove", name: "移除", color: null },
      ],
      targetNames: ["保留", "新增"],
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/subthreads/{subthreadId}/tags", {
      params: { path: { subthreadId: "s1" } },
      body: { name: "新增" },
    });
    expect(mockDELETE).toHaveBeenCalledWith(
      "/api/v1/subthreads/{subthreadId}/tags/{tagId}",
      { params: { path: { subthreadId: "s1", tagId: "tag-remove" } } },
    );
    expect(mockPOST).toHaveBeenCalledTimes(1);
    expect(mockDELETE).toHaveBeenCalledTimes(1);
  });
});
