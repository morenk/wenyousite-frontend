/** BookmarkList 组件测试：三态 + 取消收藏 */

import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockUseBookmarks } = vi.hoisted(() => ({ mockUseBookmarks: vi.fn() }));
const { mockDELETE } = vi.hoisted(() => ({ mockDELETE: vi.fn() }));

vi.mock("@/api/hooks/use-bookmarks", () => ({
  useBookmarks: () => mockUseBookmarks(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { DELETE: mockDELETE },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";
import { BookmarkList } from "@/components/user/bookmark-list";

beforeAll(() => {
  vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

afterEach(() => cleanup());
beforeEach(() => vi.clearAllMocks());

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

const sampleBookmark = {
  id: "t1",
  title: "收藏帖",
  category: "RPG",
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: true,
  pinned: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  owner: { id: "u1", username: "morenk", avatar: null },
  _count: { members: 1, posts: 2 },
  bookmarkId: "bm1",
};

describe("BookmarkList", () => {
  test("加载中显示 spinner", () => {
    mockUseBookmarks.mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: true,
      isError: false,
      error: undefined,
      refetch: vi.fn(),
    });
    render(<BookmarkList />, { wrapper: createWrapper() });
    expect(document.querySelector(".animate-spin")).toBeTruthy();
  });

  test("空列表显示空状态", () => {
    mockUseBookmarks.mockReturnValue({
      data: { pages: [] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: undefined,
      refetch: vi.fn(),
    });
    render(<BookmarkList />, { wrapper: createWrapper() });
    expect(screen.getByText("还没有收藏")).toBeInTheDocument();
  });

  test("渲染收藏并取消收藏", async () => {
    const user = userEvent.setup();
    mockUseBookmarks.mockReturnValue({
      data: { pages: [{ data: [sampleBookmark], meta: { cursor: null, hasMore: false } }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: undefined,
      refetch: vi.fn(),
    });
    mockDELETE.mockResolvedValue({
      data: { code: 0, message: "ok", data: { message: "已取消收藏" } },
      error: undefined,
    });

    render(<BookmarkList />, { wrapper: createWrapper() });
    expect(screen.getByText("收藏帖")).toBeInTheDocument();

    const unbookmarkBtn = screen.getByTitle("取消收藏");
    await user.click(unbookmarkBtn);

    expect(mockDELETE).toHaveBeenCalledWith("/api/v1/bookmarks/{id}", {
      params: { path: { id: "bm1" } },
    });
    expect(toast.success).toHaveBeenCalledWith("已取消收藏");
  });
});
