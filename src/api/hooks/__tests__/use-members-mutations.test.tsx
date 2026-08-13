/** useUpdateMember hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUpdateMember } from "@/api/hooks/use-update-member";
import { queryKeys } from "@/api/query-keys";
import type { ThreadMember } from "@/api/hooks/use-members";
import React from "react";

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

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, Wrapper };
}

const members: ThreadMember[] = [
  {
    id: "m1",
    threadId: "t1",
    userId: "u1",
    role: "PARTICIPANT",
    playerMarked: false,
    joinedAt: "2026-01-01T00:00:00Z",
    user: { id: "u1", username: "玩家甲", avatar: null, level: 2 },
  },
  {
    id: "m2",
    threadId: "t1",
    userId: "u2",
    role: "PARTICIPANT",
    playerMarked: false,
    joinedAt: "2026-01-02T00:00:00Z",
    user: { id: "u2", username: "玩家乙", avatar: null, level: 3 },
  },
];

describe("useUpdateMember", () => {
  test("授予玩家标记", async () => {
    mockPATCH.mockResolvedValueOnce({ data: { code: 0 }, error: undefined });

    const { result } = renderHook(() => useUpdateMember(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ threadId: "t1", userId: "u1", playerMarked: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPATCH).toHaveBeenCalledWith(
      "/api/v1/threads/{threadId}/members/{userId}",
      { params: { path: { threadId: "t1", userId: "u1" } }, body: { role: undefined, playerMarked: true } },
    );
  });

  test("升级为协作者", async () => {
    mockPATCH.mockResolvedValueOnce({ data: { code: 0 }, error: undefined });

    const { result } = renderHook(() => useUpdateMember(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ threadId: "t1", userId: "u1", role: "COLLABORATOR" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPATCH).toHaveBeenCalledWith(
      "/api/v1/threads/{threadId}/members/{userId}",
      { params: { path: { threadId: "t1", userId: "u1" } }, body: { role: "COLLABORATOR", playerMarked: undefined } },
    );
  });

  test("请求期间只乐观更新目标成员", async () => {
    let resolveRequest!: (value: { data: { code: number }; error: undefined }) => void;
    mockPATCH.mockReturnValueOnce(new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    const { queryClient, Wrapper } = createHarness();
    queryClient.setQueryData(queryKeys.members.list("t1"), members);
    const { result } = renderHook(() => useUpdateMember(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ threadId: "t1", userId: "u1", playerMarked: true });
    });
    await waitFor(() => {
      expect(queryClient.getQueryData<ThreadMember[]>(queryKeys.members.list("t1")))
        .toEqual([
          expect.objectContaining({ userId: "u1", playerMarked: true }),
          expect.objectContaining({ userId: "u2", playerMarked: false }),
        ]);
    });

    resolveRequest({ data: { code: 0 }, error: undefined });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  test("更新失败时回滚目标成员的乐观状态", async () => {
    mockPATCH.mockResolvedValueOnce({
      data: undefined,
      error: { code: 50000, message: "更新失败" },
    });
    const { queryClient, Wrapper } = createHarness();
    queryClient.setQueryData(queryKeys.members.list("t1"), members);
    const { result } = renderHook(() => useUpdateMember(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ threadId: "t1", userId: "u1", role: "COLLABORATOR" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(queryClient.getQueryData<ThreadMember[]>(queryKeys.members.list("t1")))
      .toEqual(members);
  });
});
