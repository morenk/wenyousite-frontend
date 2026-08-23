/** useSaveDraft hook 测试：保存正文草稿 */

import { beforeEach, describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSaveDraft } from "@/api/hooks/use-save-draft";
import { queryKeys } from "@/api/query-keys";
import type { DraftState } from "@/api/hooks/use-content-drafts";
import React from "react";

const { mockPOST, mockPATCH } = vi.hoisted(() => ({
  mockPOST: vi.fn(),
  mockPATCH: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { POST: mockPOST, PATCH: mockPATCH },
}));

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return { Wrapper, queryClient: qc };
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
  beforeEach(() => {
    mockPOST.mockReset();
    mockPATCH.mockReset();
  });

  test("已有草稿按稳定 ID 和 version 使用 PATCH，绝不再由 POST 覆盖槽位", async () => {
    mockPATCH.mockResolvedValueOnce({
      data: { code: 0, message: "ok", data: createdDraft },
      error: undefined,
    });

    const { Wrapper, queryClient } = createWrapper();
    queryClient.setQueryData<DraftState>(queryKeys.draftState, {
      drafts: [{ ...createdDraft, version: 1 }],
      usedSlots: 1,
      maxSlots: 5,
      slots: [1],
    });
    const { result } = renderHook(() => useSaveDraft(), { wrapper: Wrapper });

    result.current.mutate({
      draftId: "d1",
      content: "槽位 1 的草稿",
      version: 1,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPATCH).toHaveBeenCalledWith("/api/v1/drafts/{id}", {
      params: { path: { id: "d1" } },
      body: { content: "槽位 1 的草稿", version: 1 },
    });
    expect(mockPOST).not.toHaveBeenCalled();
    expect(result.current.data?.slot).toBe(1);
    expect(queryClient.getQueryData<DraftState>(queryKeys.draftState)).toEqual({
      drafts: [createdDraft],
      usedSlots: 1,
      maxSlots: 5,
      slots: [1],
    });
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

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveDraft(), { wrapper: Wrapper });

    const clientRequestId = "6f9619ff-8b86-4e4b-a59b-19a25f6d6f77";
    result.current.mutate({ content: "自动分配的草稿", clientRequestId });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/drafts", {
      body: { content: "自动分配的草稿", clientRequestId },
    });
    expect(result.current.data?.slot).toBe(2);
  });

  test("创建草稿时默认生成 UUID v4 幂等键", async () => {
    mockPOST.mockResolvedValueOnce({
      data: { code: 0, message: "ok", data: createdDraft },
      error: undefined,
    });
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveDraft(), { wrapper: Wrapper });

    result.current.mutate({ content: "新草稿", slot: 1 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/drafts", {
      body: {
        content: "新草稿",
        slot: 1,
        clientRequestId: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
      },
    });
  });
});
