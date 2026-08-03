/** useUpdateMember hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUpdateMember } from "@/api/hooks/use-update-member";
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
});
