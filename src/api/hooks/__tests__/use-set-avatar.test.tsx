/** useSetAvatar hook 测试：PATCH/DELETE + 缓存失效 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockPatch, mockDelete } = vi.hoisted(() => ({
  mockPatch: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: {
    PATCH: (...args: unknown[]) => mockPatch(...args),
    DELETE: (...args: unknown[]) => mockDelete(...args),
  },
}));

import { useSetAvatar } from "@/api/hooks/use-set-avatar";

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

describe("useSetAvatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPatch.mockResolvedValue({ data: {}, error: undefined });
    mockDelete.mockResolvedValue({ data: {}, error: undefined });
  });

  test("setAvatar 调用 PATCH /users/me/avatar 并传 mediaId", async () => {
    const { result } = renderHook(() => useSetAvatar(), { wrapper: createWrapper() });
    result.current.setAvatar.mutate("media-1");
    await waitFor(() => expect(result.current.setAvatar.isSuccess).toBe(true));
    expect(mockPatch).toHaveBeenCalledWith("/api/v1/users/me/avatar", {
      body: { mediaId: "media-1" },
    });
  });

  test("removeAvatar 调用 DELETE /users/me/avatar", async () => {
    const { result } = renderHook(() => useSetAvatar(), { wrapper: createWrapper() });
    result.current.removeAvatar.mutate();
    await waitFor(() => expect(result.current.removeAvatar.isSuccess).toBe(true));
    expect(mockDelete).toHaveBeenCalledWith("/api/v1/users/me/avatar");
  });

  test("setAvatar 失败时 mutation 进入 error 状态", async () => {
    mockPatch.mockResolvedValue({ data: undefined, error: new Error("上传失败") });
    const { result } = renderHook(() => useSetAvatar(), { wrapper: createWrapper() });
    result.current.setAvatar.mutate("media-1");
    await waitFor(() => expect(result.current.setAvatar.isError).toBe(true));
  });
});
