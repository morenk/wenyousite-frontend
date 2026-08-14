import { beforeEach, describe, expect, test, vi } from "vitest";
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

import { useSetProfileCover } from "@/api/hooks/use-set-profile-cover";

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

describe("useSetProfileCover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPatch.mockResolvedValue({ data: {}, error: undefined });
    mockDelete.mockResolvedValue({ data: {}, error: undefined });
  });

  test("同时绑定电脑端和移动端背景 mediaId", async () => {
    const { result } = renderHook(() => useSetProfileCover(), { wrapper: createWrapper() });
    result.current.setProfileCover.mutate({
      mediaId: "media-cover-web-1",
      mobileMediaId: "media-cover-mobile-1",
    });
    await waitFor(() => expect(result.current.setProfileCover.isSuccess).toBe(true));
    expect(mockPatch).toHaveBeenCalledWith("/api/v1/users/me/profile-cover", {
      body: {
        mediaId: "media-cover-web-1",
        mobileMediaId: "media-cover-mobile-1",
      },
    });
  });

  test("移除主页背景", async () => {
    const { result } = renderHook(() => useSetProfileCover(), { wrapper: createWrapper() });
    result.current.removeProfileCover.mutate();
    await waitFor(() => expect(result.current.removeProfileCover.isSuccess).toBe(true));
    expect(mockDelete).toHaveBeenCalledWith("/api/v1/users/me/profile-cover");
  });
});
