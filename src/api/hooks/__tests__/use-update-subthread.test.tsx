/** useUpdateSubthread hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUpdateSubthread } from "@/api/hooks/use-update-subthread";

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

const mockSubthread = {
  id: "sub-1",
  threadId: "thread-1",
  title: "更新后标题",
  sortOrder: 1,
  postingPolicy: "PARTICIPANTS" as const,
  version: 2,
  lastPostAt: null,
  bodyPostId: null,
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  bodyPost: null,
  _count: { posts: 0 },
  tags: [],
};

describe("useUpdateSubthread", () => {
  test("更新子贴标题成功", async () => {
    mockPATCH.mockResolvedValueOnce({
      data: { code: 0, message: "ok", data: mockSubthread },
      error: undefined,
    });

    const { result } = renderHook(() => useUpdateSubthread(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      subthreadId: "sub-1",
      body: { title: "更新后标题", version: 1 },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.title).toBe("更新后标题");
    expect(result.current.data?.version).toBe(2);
  });

  test("更新发帖权限", async () => {
    const updated = { ...mockSubthread, postingPolicy: "COLLABORATORS" as const };
    mockPATCH.mockResolvedValueOnce({
      data: { code: 0, message: "ok", data: updated },
      error: undefined,
    });

    const { result } = renderHook(() => useUpdateSubthread(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      subthreadId: "sub-1",
      body: { postingPolicy: "COLLABORATORS", version: 1 },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.postingPolicy).toBe("COLLABORATORS");
  });

  test("网络错误时进入 error", async () => {
    mockPATCH.mockRejectedValueOnce(new Error("网络错误"));

    const { result } = renderHook(() => useUpdateSubthread(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      subthreadId: "sub-1",
      body: { title: "xx", version: 1 },
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/网络错误/);
  });
});
