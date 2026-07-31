/** useMemberActions + useThreadMembers hooks 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemberActions, useThreadMembers } from "@/api/hooks/use-member-actions";
import React from "react";

const { mockPOST, mockDELETE, mockGET } = vi.hoisted(() => ({
  mockPOST: vi.fn(),
  mockDELETE: vi.fn(),
  mockGET: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { POST: mockPOST, DELETE: mockDELETE, GET: mockGET },
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

const sampleMembers = [
  {
    id: "m1",
    threadId: "t1",
    userId: "u1",
    role: "OWNER",
    playerMarked: true,
    joinedAt: "2026-01-01T00:00:00Z",
    user: { id: "u1", username: "owner", avatar: null },
  },
  {
    id: "m2",
    threadId: "t1",
    userId: "u2",
    role: "PARTICIPANT",
    playerMarked: false,
    joinedAt: "2026-01-02T00:00:00Z",
    user: { id: "u2", username: "member", avatar: null },
  },
];

describe("useThreadMembers", () => {
  test("成功加载成员列表", async () => {
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: sampleMembers },
      error: undefined,
    });

    const { result } = renderHook(() => useThreadMembers("t1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].user.username).toBe("owner");
  });

  test("threadId 为 undefined 时不请求", () => {
    const { result } = renderHook(() => useThreadMembers(undefined), {
      wrapper: createWrapper(),
    });
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe("idle");
  });

  test("API 返回错误时 isError", async () => {
    mockGET.mockRejectedValue(new Error("error"));

    const { result } = renderHook(() => useThreadMembers("t1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useMemberActions", () => {
  test("join 调用 POST 接口并 invalidate", async () => {
    mockPOST.mockResolvedValue({ error: undefined });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries");

    function Wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    }
    Wrapper.displayName = "QueryClientWrapper";

    const { result } = renderHook(() => useMemberActions("t1"), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.join.mutateAsync();
    });

    expect(mockPOST).toHaveBeenCalledWith(
      "/api/v1/threads/{threadId}/members/join",
      { params: { path: { threadId: "t1" } } },
    );
    expect(spy).toHaveBeenCalledWith({ queryKey: ["thread", "t1"] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["thread-members", "t1"] });
  });

  test("exit 调用 DELETE 接口并 invalidate", async () => {
    mockDELETE.mockResolvedValue({ error: undefined });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries");

    function Wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    }
    Wrapper.displayName = "QueryClientWrapper";

    const { result } = renderHook(() => useMemberActions("t2"), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.exit.mutateAsync();
    });

    expect(mockDELETE).toHaveBeenCalledWith(
      "/api/v1/threads/{threadId}/members/me",
      { params: { path: { threadId: "t2" } } },
    );
    expect(spy).toHaveBeenCalledWith({ queryKey: ["thread", "t2"] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["thread-members", "t2"] });
  });
});
