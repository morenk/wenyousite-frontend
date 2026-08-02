/** UserBookmarksSection 组件测试：三态 + 渲染 */

import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockUseUserBookmarks } = vi.hoisted(() => ({
  mockUseUserBookmarks: vi.fn(),
}));

vi.mock("@/api/hooks/use-user-bookmarks", () => ({
  useUserBookmarks: () => mockUseUserBookmarks(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { UserBookmarksSection } from "@/components/user/user-bookmarks-section";

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

const sample = {
  id: "t1",
  title: "他人收藏",
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
};

describe("UserBookmarksSection", () => {
  test("加载中显示加载提示", () => {
    mockUseUserBookmarks.mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: true,
      isError: false,
      error: undefined,
    });
    render(<UserBookmarksSection userId="u1" />, { wrapper: createWrapper() });
    expect(screen.getByText("加载中…")).toBeInTheDocument();
  });

  test("未公开收藏（404）显示占位", () => {
    mockUseUserBookmarks.mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: true,
      error: { code: 404 },
    });
    render(<UserBookmarksSection userId="u1" />, { wrapper: createWrapper() });
    expect(screen.getByText("该用户未公开收藏")).toBeInTheDocument();
  });

  test("空收藏显示空态", () => {
    mockUseUserBookmarks.mockReturnValue({
      data: { pages: [] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: undefined,
    });
    render(<UserBookmarksSection userId="u1" />, { wrapper: createWrapper() });
    expect(screen.getByText("还没有收藏")).toBeInTheDocument();
  });

  test("渲染收藏列表（无取消按钮）", () => {
    mockUseUserBookmarks.mockReturnValue({
      data: { pages: [{ data: [sample], meta: { cursor: null, hasMore: false } }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: undefined,
    });
    render(<UserBookmarksSection userId="u1" />, { wrapper: createWrapper() });
    expect(screen.getByRole("link", { name: /他人收藏/ })).toHaveAttribute("href", "/threads/t1");
    expect(screen.queryByTitle("取消收藏")).not.toBeInTheDocument();
  });
});
