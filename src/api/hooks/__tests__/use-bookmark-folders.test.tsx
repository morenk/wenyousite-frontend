import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import {
  useBookmarkFolders,
  useCreateBookmarkFolder,
  useMoveBookmark,
} from "@/api/hooks/use-bookmark-folders";

const { mockGET, mockPOST, mockPATCH } = vi.hoisted(() => ({
  mockGET: vi.fn(),
  mockPOST: vi.fn(),
  mockPATCH: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { GET: mockGET, POST: mockPOST, PATCH: mockPATCH },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const folder = {
  id: "cfolderdefault000000000001",
  name: "默认收藏夹",
  isDefault: true,
  bookmarkCount: 2,
  momentBookmarkCount: 3,
  createdAt: "2026-08-09T00:00:00.000Z",
};

describe("bookmark folder hooks", () => {
  test("读取当前用户收藏夹和数量", async () => {
    mockGET.mockResolvedValue({
      data: { code: 0, message: "ok", data: [folder] },
      error: undefined,
    });
    const { result } = renderHook(() => useBookmarkFolders(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGET).toHaveBeenCalledWith("/api/v1/bookmarks/folders");
    expect(result.current.data).toEqual([folder]);
  });

  test("新建收藏夹提交名称", async () => {
    mockPOST.mockResolvedValue({
      data: { code: 0, message: "ok", data: { ...folder, id: "cfoldercustom00000000001", name: "跑团资料" } },
      error: undefined,
    });
    const { result } = renderHook(() => useCreateBookmarkFolder(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync("跑团资料");
    });
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/bookmarks/folders", {
      body: { name: "跑团资料" },
    });
  });

  test("移动收藏提交收藏记录与目标收藏夹", async () => {
    mockPATCH.mockResolvedValue({ data: { code: 0, message: "ok", data: {} }, error: undefined });
    const { result } = renderHook(() => useMoveBookmark(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        bookmarkId: "cbookmark00000000000000001",
        folderId: "cfoldercustom00000000001",
      });
    });
    expect(mockPATCH).toHaveBeenCalledWith("/api/v1/bookmarks/{id}", {
      params: { path: { id: "cbookmark00000000000000001" } },
      body: { folderId: "cfoldercustom00000000001" },
    });
  });

  test("移动动态收藏提交动态与目标收藏夹", async () => {
    const { useMoveMomentBookmark } = await import("@/api/hooks/use-bookmark-folders");
    mockPATCH.mockResolvedValue({ data: { code: 0, message: "ok", data: {} }, error: undefined });
    const { result } = renderHook(() => useMoveMomentBookmark(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ momentId: "moment-1", folderId: "folder-2" });
    });
    expect(mockPATCH).toHaveBeenCalledWith("/api/v1/moments/{id}/bookmark", {
      params: { path: { id: "moment-1" } },
      body: { folderId: "folder-2" },
    });
  });
});
