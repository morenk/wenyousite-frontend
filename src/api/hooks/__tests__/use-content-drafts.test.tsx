/** useContentDrafts hook 测试：正文草稿列表 */

import { beforeEach, describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useContentDrafts } from "@/api/hooks/use-content-drafts";
import { useDraftSlots } from "@/api/hooks/use-draft-slots";
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

const sampleDraft = {
  id: "d1",
  userId: "u1",
  slot: 1,
  content: "槽位 1 的草稿",
  version: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("useContentDrafts", () => {
  beforeEach(() => {
    mockGET.mockReset();
  });

  test("成功获取正文草稿列表", async () => {
    mockGET.mockResolvedValue({
      data: {
        code: 0,
        message: "ok",
        data: { drafts: [sampleDraft], usedSlots: 1, maxSlots: 5, slots: [1] },
      },
      error: undefined,
    });

    const { result } = renderHook(() => useContentDrafts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/drafts/state");
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].slot).toBe(1);
    expect(result.current.data?.[0].content).toBe("槽位 1 的草稿");
  });

  test("空列表返回空数组", async () => {
    mockGET.mockResolvedValue({
      data: {
        code: 0,
        message: "ok",
        data: { drafts: [], usedSlots: 0, maxSlots: 5, slots: [] },
      },
      error: undefined,
    });

    const { result } = renderHook(() => useContentDrafts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  test("列表和槽位观察者共享一次原子状态请求", async () => {
    mockGET.mockResolvedValue({
      data: {
        code: 0,
        message: "ok",
        data: { drafts: [sampleDraft], usedSlots: 1, maxSlots: 5, slots: [1] },
      },
      error: undefined,
    });

    const { result } = renderHook(
      () => ({ drafts: useContentDrafts(), slots: useDraftSlots() }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.drafts.isSuccess).toBe(true);
      expect(result.current.slots.isSuccess).toBe(true);
    });
    expect(mockGET).toHaveBeenCalledTimes(1);
    expect(result.current.slots.data).toEqual({
      usedSlots: 1,
      maxSlots: 5,
      slots: [1],
    });
  });
});
