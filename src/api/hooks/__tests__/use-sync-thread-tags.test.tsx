/** useSyncThreadTags hook 测试 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSyncThreadTags } from "@/api/hooks/use-sync-thread-tags";
import type { ThreadTag } from "@/api/hooks/use-thread-detail";

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

const existingTags: ThreadTag[] = [
  { id: "tag-1", name: "已有", color: null },
  { id: "tag-2", name: "保留", color: null },
];

describe("useSyncThreadTags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPOST.mockResolvedValue({ data: { code: 0 }, error: undefined });
    mockDELETE.mockResolvedValue({ data: { code: 0 }, error: undefined });
  });

  test("只新增目标中不存在的新标签（现有标签全部保留）", async () => {
    const { result } = renderHook(() => useSyncThreadTags(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      threadId: "t1",
      existingTags,
      targetNames: ["已有", "保留", "新标签"],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/threads/{threadId}/tags", {
      params: { path: { threadId: "t1" } },
      body: { name: "新标签" },
    });
    expect(mockDELETE).not.toHaveBeenCalled();
  });

  test("移除现有中不在目标的标签", async () => {
    const { result } = renderHook(() => useSyncThreadTags(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      threadId: "t1",
      existingTags,
      targetNames: ["保留"],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPOST).not.toHaveBeenCalled();
    expect(mockDELETE).toHaveBeenCalledWith(
      "/api/v1/threads/{threadId}/tags/{tagId}",
      { params: { path: { threadId: "t1", tagId: "tag-1" } } },
    );
  });

  test("目标与现有一致时不调用任何端点", async () => {
    const { result } = renderHook(() => useSyncThreadTags(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      threadId: "t1",
      existingTags,
      targetNames: ["已有", "保留"],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPOST).not.toHaveBeenCalled();
    expect(mockDELETE).not.toHaveBeenCalled();
  });

  test("添加标签失败时抛错进入 error", async () => {
    mockPOST.mockRejectedValueOnce({ code: 40300, message: "无权修改标签" });

    const { result } = renderHook(() => useSyncThreadTags(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      threadId: "t1",
      existingTags,
      targetNames: ["新标签"],
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: 40300 });
  });
});
