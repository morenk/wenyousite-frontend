/** useMembers hook 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMembers } from "@/api/hooks/use-members";
import React from "react";

const { mockGET } = vi.hoisted(() => ({
  mockGET: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { GET: mockGET },
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

const sampleMember = {
  id: "m1",
  threadId: "t1",
  userId: "u1",
  role: "PARTICIPANT",
  playerMarked: true,
  joinedAt: "2026-01-01T00:00:00Z",
  user: { id: "u1", username: "player", avatar: null },
};

describe("useMembers", () => {
  test("success：返回参与人列表", async () => {
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: [sampleMember] },
      error: undefined,
    });

    const { result } = renderHook(() => useMembers("t1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].user.username).toBe("player");
    expect(result.current.data?.[0].playerMarked).toBe(true);
  });

  test("threadId 为 undefined 时不请求", () => {
    const { result } = renderHook(() => useMembers(undefined), {
      wrapper: createWrapper(),
    });
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe("idle");
  });
});
