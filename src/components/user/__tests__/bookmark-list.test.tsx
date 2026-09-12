/** BookmarkList 组件测试：三态 + 取消收藏 */

import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockUseBookmarks } = vi.hoisted(() => ({ mockUseBookmarks: vi.fn() }));
const { mockDELETE, mockPOST } = vi.hoisted(() => ({ mockDELETE: vi.fn(), mockPOST: vi.fn() }));

vi.mock("@/api/hooks/use-bookmarks", () => ({
  useBookmarks: () => mockUseBookmarks(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { DELETE: mockDELETE, POST: mockPOST },
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }),
}));

import { toast, type Action } from "sonner";
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
  bookmarkFolderId: "folder-1",
};

describe("BookmarkList", () => {
  test("自有收藏展示可信静态首帧，封面位于进入详情的链接内", () => {
    mockUseBookmarks.mockReturnValue({
      data: { pages: [{ data: [{ ...sampleBookmark, coverImages: ["/test.gif"],
        coverMedia: { url: "/test.gif", animated: true, posterUrl: "/test-poster.webp" } }], meta: { cursor: null, hasMore: false } }] },
      fetchNextPage: vi.fn(), hasNextPage: false, isFetchingNextPage: false, isLoading: false, isError: false, refetch: vi.fn(),
    });
    render(<BookmarkList />, { wrapper: createWrapper() });
    const poster = document.querySelector("img[data-cover-poster]");
    expect(poster).toHaveAttribute("src", "/test-poster.webp");
    expect(poster?.closest("a")).toHaveAttribute("href", "/threads/t1");
    expect(document.querySelector("img[data-cover-animation]")).toBeNull();
  });

  test("加载中保留列表骨架", () => {
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
    expect(screen.getByRole("status", { name: "正在加载收藏" })).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "更多收藏操作：收藏帖" }));
    await user.click(screen.getByRole("menuitem", { name: "取消收藏" }));

    expect(mockDELETE).toHaveBeenCalledWith("/api/v1/bookmarks/{id}", {
      params: { path: { id: "bm1" } },
    });
    expect(toast.success).not.toHaveBeenCalled();
    const options = vi.mocked(toast).mock.calls[0][1]!;
    mockPOST.mockResolvedValue({ data: {} });
    (options.action as Action).onClick({ preventDefault: vi.fn() } as unknown as React.MouseEvent<HTMLButtonElement>);
    await vi.waitFor(() => expect(mockPOST).toHaveBeenCalledWith("/api/v1/bookmarks", { body: { threadId: "t1", folderId: "folder-1" } }));
  });

  test("取消收藏失败时显示错误提示", async () => {
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
    mockDELETE.mockResolvedValue({ data: undefined, error: { message: "网络错误" } });

    render(<BookmarkList />, { wrapper: createWrapper() });
    await user.click(screen.getByRole("button", { name: "更多收藏操作：收藏帖" }));
    await user.click(screen.getByRole("menuitem", { name: "取消收藏" }));

    expect(toast.error).toHaveBeenCalledWith("网络错误");
  });
});
