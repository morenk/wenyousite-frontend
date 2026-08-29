/** useLatestThreadPost hook 测试：按需读取主题最新有效发言。 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useLatestThreadPost } from "@/api/hooks/use-latest-thread-post";

const { mockGET } = vi.hoisted(() => ({ mockGET: vi.fn() }));

vi.mock("@/api/client", () => ({ apiClient: { GET: mockGET } }));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

describe("useLatestThreadPost", () => {
  beforeEach(() => mockGET.mockReset());

  test("每次点击按主题 ID 请求最新发言定位", async () => {
    const target = {
      id: "reply-latest",
      threadId: "thread-1",
      subthreadId: "subthread-2",
      parentPostId: "floor-9",
      createdAt: "2026-08-29T08:00:00.000Z",
    };
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: target },
      error: undefined,
    });
    const { result } = renderHook(() => useLatestThreadPost(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("thread-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(target);
    expect(mockGET).toHaveBeenCalledWith(
      "/api/v1/threads/{threadId}/posts/latest",
      { params: { path: { threadId: "thread-1" } } },
    );
  });

  test("API 错误与空响应都进入错误态", async () => {
    const apiError = { code: 40403, message: "主题帖暂无楼层或回复" };
    mockGET.mockResolvedValueOnce({ data: undefined, error: apiError });
    const first = renderHook(() => useLatestThreadPost(), {
      wrapper: createWrapper(),
    });
    first.result.current.mutate("thread-empty");
    await waitFor(() => expect(first.result.current.error).toEqual(apiError));

    mockGET.mockResolvedValueOnce({ data: undefined, error: undefined });
    const second = renderHook(() => useLatestThreadPost(), {
      wrapper: createWrapper(),
    });
    second.result.current.mutate("thread-empty-response");
    await waitFor(() =>
      expect(second.result.current.error).toEqual(
        new Error("最新发言响应为空"),
      ),
    );
  });
});
