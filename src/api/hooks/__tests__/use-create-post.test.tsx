/** useCreatePost hook 测试：楼层发布与楼中楼回复 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCreatePost } from "@/api/hooks/use-create-post";

const { mockPOST } = vi.hoisted(() => ({
  mockPOST: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { POST: mockPOST },
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

describe("useCreatePost", () => {
  test("发布楼层：只传 content", async () => {
    mockPOST.mockResolvedValueOnce({
      data: { code: 0, message: "ok", data: { id: "post-1" } },
      error: undefined,
    });

    const { result } = renderHook(() => useCreatePost(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ subthreadId: "s1", content: "新楼层" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/subthreads/{subthreadId}/posts", {
      params: { path: { subthreadId: "s1" } },
      body: { content: "新楼层", parentPostId: undefined, replyToPostId: undefined },
    });
  });

  test("发布楼中楼回复：传 parentPostId 与 replyToPostId", async () => {
    mockPOST.mockResolvedValueOnce({
      data: { code: 0, message: "ok", data: { id: "reply-1" } },
      error: undefined,
    });

    const { result } = renderHook(() => useCreatePost(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      subthreadId: "s1",
      content: "楼中楼回复",
      parentPostId: "post-1",
      replyToPostId: "post-1",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/subthreads/{subthreadId}/posts", {
      params: { path: { subthreadId: "s1" } },
      body: { content: "楼中楼回复", parentPostId: "post-1", replyToPostId: "post-1" },
    });
  });

  test("发布失败进入 error", async () => {
    mockPOST.mockRejectedValueOnce({ code: 40303, message: "该子贴仅限玩家发帖" });

    const { result } = renderHook(() => useCreatePost(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ subthreadId: "s1", content: "x" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: 40303 });
  });
});
