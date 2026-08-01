/** 订阅 hooks 测试 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSubscriptions } from "@/api/hooks/use-subscriptions";
import { useCreateSubscription, useDeleteSubscription } from "@/api/hooks/use-subscription-mutations";
import React from "react";

const { mockGET, mockPOST, mockDELETE } = vi.hoisted(() => ({
  mockGET: vi.fn(),
  mockPOST: vi.fn(),
  mockDELETE: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { GET: mockGET, POST: mockPOST, DELETE: mockDELETE },
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

const sampleSubscription = {
  id: "sub1",
  userId: "u1",
  threadId: "t1",
  type: "THREAD",
  targetUserId: null,
  createdAt: "2026-01-01T00:00:00Z",
  thread: { id: "t1", title: "测试帖" },
};

describe("useSubscriptions", () => {
  test("success：返回订阅列表", async () => {
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: [sampleSubscription] },
      error: undefined,
    });

    const { result } = renderHook(() => useSubscriptions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].thread.title).toBe("测试帖");
    expect(result.current.data?.[0].type).toBe("THREAD");
  });
});

describe("useCreateSubscription", () => {
  test("创建订阅：传 threadId 与 type", async () => {
    mockPOST.mockResolvedValueOnce({ data: { code: 0 }, error: undefined });

    const { result } = renderHook(() => useCreateSubscription(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ threadId: "t1", type: "THREAD" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/subscriptions", {
      body: { threadId: "t1", type: "THREAD" },
    });
  });
});

describe("useDeleteSubscription", () => {
  test("取消订阅", async () => {
    mockDELETE.mockResolvedValueOnce({ data: { code: 0 }, error: undefined });

    const { result } = renderHook(() => useDeleteSubscription(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("sub1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDELETE).toHaveBeenCalledWith("/api/v1/subscriptions/{id}", {
      params: { path: { id: "sub1" } },
    });
  });
});
