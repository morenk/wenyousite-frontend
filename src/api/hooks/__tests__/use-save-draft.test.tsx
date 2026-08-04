/** useSaveDraft hook 测试：保存正文草稿 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSaveDraft } from "@/api/hooks/use-save-draft";
import React from "react";

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

const createdDraft = {
  id: "d1",
  userId: "u1",
  slot: 1,
  content: "槽位 1 的草稿",
  version: 2,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("useSaveDraft", () => {
  test("指定 slot 保存", async () => {
    mockPOST.mockResolvedValueOnce({
      data: { code: 0, message: "ok", data: createdDraft },
      error: undefined,
    });

    const { result } = renderHook(() => useSaveDraft(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ content: "槽位 1 的草稿", slot: 1, version: 1 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/drafts", {
      body: { content: "槽位 1 的草稿", slot: 1, version: 1 },
    });
    expect(result.current.data?.slot).toBe(1);
  });

  test("不指定 slot 由后端自动分配", async () => {
    mockPOST.mockResolvedValueOnce({
      data: {
        code: 0,
        message: "ok",
        data: { ...createdDraft, id: "d2", slot: 2 },
      },
      error: undefined,
    });

    const { result } = renderHook(() => useSaveDraft(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ content: "自动分配的草稿" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/drafts", {
      body: { content: "自动分配的草稿" },
    });
    expect(result.current.data?.slot).toBe(2);
  });
});
