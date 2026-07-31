/** useCreateSubthread hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCreateSubthread } from "@/api/hooks/use-create-subthread";

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

const mockSubthread = {
  id: "sub-1",
  threadId: "thread-1",
  title: "新子贴",
  sortOrder: 1,
  postingPolicy: "PARTICIPANTS" as const,
  version: 1,
  lastPostAt: null,
  bodyPostId: null,
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  bodyPost: null,
  _count: { posts: 0 },
  tags: [],
};

describe("useCreateSubthread", () => {
  test("成功创建子贴", async () => {
    mockPOST.mockResolvedValueOnce({
      data: { code: 0, message: "ok", data: mockSubthread },
      error: undefined,
    });

    const { result } = renderHook(() => useCreateSubthread(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      threadId: "thread-1",
      body: { title: "新子贴", postingPolicy: "PARTICIPANTS" as const },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe("sub-1");
    expect(result.current.data?.title).toBe("新子贴");
  });

  test("创建子贴时可指定发帖权限", async () => {
    const withPolicy = { ...mockSubthread, postingPolicy: "COLLABORATORS" as const };
    mockPOST.mockResolvedValueOnce({
      data: { code: 0, message: "ok", data: withPolicy },
      error: undefined,
    });

    const { result } = renderHook(() => useCreateSubthread(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      threadId: "thread-1",
      body: { title: "设定区", postingPolicy: "COLLABORATORS" },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.postingPolicy).toBe("COLLABORATORS");
  });

  test("网络错误时进入 error", async () => {
    mockPOST.mockRejectedValueOnce(new Error("网络错误"));

    const { result } = renderHook(() => useCreateSubthread(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      threadId: "thread-1",
      body: { title: "新子贴", postingPolicy: "PARTICIPANTS" as const },
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/网络错误/);
  });
});
