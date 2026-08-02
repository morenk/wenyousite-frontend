/** useDeleteContentDraft hook 测试：删除正文草稿 */

import { describe, test, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDeleteContentDraft } from "@/api/hooks/use-delete-content-draft";
import React from "react";

const { mockDELETE } = vi.hoisted(() => ({
  mockDELETE: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { DELETE: mockDELETE },
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

describe("useDeleteContentDraft", () => {
  test("删除草稿", async () => {
    mockDELETE.mockResolvedValueOnce({
      data: {
        code: 0,
        message: "ok",
        data: { message: "草稿已删除" },
      },
      error: undefined,
    });

    const { result } = renderHook(() => useDeleteContentDraft(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("d1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDELETE).toHaveBeenCalledWith("/api/v1/drafts/{id}", {
      params: { path: { id: "d1" } },
    });
  });
});
