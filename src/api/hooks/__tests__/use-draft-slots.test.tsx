/** useDraftSlots hook 测试：正文草稿槽位使用情况 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

describe("useDraftSlots", () => {
  test("成功获取槽位使用情况", async () => {
    mockGET.mockResolvedValue({
      data: {
        code: 0,
        message: "ok",
        data: { usedSlots: 2, maxSlots: 5, slots: [1, 2] },
      },
      error: undefined,
    });

    const { result } = renderHook(() => useDraftSlots(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/drafts/slots");
    expect(result.current.data).toEqual({
      usedSlots: 2,
      maxSlots: 5,
      slots: [1, 2],
    });
  });

  test("响应缺失时回退默认值", async () => {
    mockGET.mockResolvedValue({
      data: undefined,
      error: undefined,
    });

    const { result } = renderHook(() => useDraftSlots(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      usedSlots: 0,
      maxSlots: 5,
      slots: [],
    });
  });
});
