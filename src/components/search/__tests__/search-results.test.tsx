/** SearchResults 组件测试：分类惰性加载、短词提示与楼层分页。 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render as testingLibraryRender,
  screen,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { SearchResults } from "@/components/search/search-results";

const {
  mockUseSearchThreads,
  mockUseSearchUsers,
  mockUseSearchPosts,
  mockUseSearchMoments,
  mockFetchNextPage,
  mockMomentMasonry,
} = vi.hoisted(() => ({
  mockUseSearchThreads: vi.fn(),
  mockUseSearchUsers: vi.fn(),
  mockUseSearchPosts: vi.fn(),
  mockUseSearchMoments: vi.fn(),
  mockFetchNextPage: vi.fn(),
  mockMomentMasonry: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/api/hooks/use-search", () => ({
  useSearchThreads: mockUseSearchThreads,
  useSearchUsers: mockUseSearchUsers,
  useSearchPosts: mockUseSearchPosts,
  useSearchMoments: mockUseSearchMoments,
  isPostSearchKeywordValid: (q: string) => Array.from(q.trim()).length >= 2,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/components/moment/moment-masonry", () => ({
  MomentMasonry: (props: { moments: unknown[]; maxLanes?: number }) => {
    mockMomentMasonry(props);
    return <div>动态结果 {props.moments.length}</div>;
  },
}));

const thread = {
  id: "t1",
  title: "测试帖子",
  category: "RPG",
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: true,
  pinned: false,
  tipTotal: "12",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
  deletedAt: null,
  owner: { id: "u1", username: "morenk", avatar: null, level: 3 },
  defaultSubthread: { id: "s1", title: "主贴", lastPostAt: null },
  topicTags: [],
  _count: { members: 1, posts: 2, players: 1 },
  preview: "统一后的主题帖正文预览",
  coverImages: [
    "https://cdn.example.com/uploads/search-cover.jpg",
    "https://cdn.example.com/uploads/search-second.jpg",
  ],
};

const user = {
  id: "u1",
  username: "测试用户",
  avatar: null,
  bio: "一起写故事",
};

const post = {
  id: "p1",
  floorNumber: 1,
  content: "这是匹配的楼层内容",
  createdAt: "2026-01-01T00:00:00Z",
  author: { id: "u1", username: "morenk" },
  thread: { id: "t1", title: "测试帖子" },
  subthread: { id: "s1", title: "主讨论区" },
};

const idleQuery = {
  data: undefined,
  isLoading: false,
  isError: false,
  error: null,
  isPlaceholderData: false,
  refetch: vi.fn(),
};

function render(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return testingLibraryRender(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("SearchResults", () => {
  beforeEach(() => {
    mockFetchNextPage.mockReset();
    mockMomentMasonry.mockClear();
    mockUseSearchThreads.mockImplementation((_q, enabled: boolean) =>
      enabled
        ? {
            ...idleQuery,
            data: {
              pages: [{
                data: [thread],
                meta: { cursor: null, hasMore: false },
              }],
            },
            hasNextPage: false,
            isFetchingNextPage: false,
            fetchNextPage: mockFetchNextPage,
          }
        : {
            ...idleQuery,
            hasNextPage: false,
            isFetchingNextPage: false,
            fetchNextPage: mockFetchNextPage,
          },
    );
    mockUseSearchUsers.mockImplementation((_q, enabled: boolean) =>
      enabled ? { ...idleQuery, data: [user] } : idleQuery,
    );
    mockUseSearchPosts.mockImplementation((_q, enabled: boolean) =>
      enabled
        ? {
            ...idleQuery,
            data: {
              pages: [{
                data: [post],
                meta: { cursor: "next", hasMore: true },
              }],
            },
            hasNextPage: true,
            isFetchingNextPage: false,
            fetchNextPage: mockFetchNextPage,
          }
        : {
            ...idleQuery,
            hasNextPage: false,
            isFetchingNextPage: false,
            fetchNextPage: mockFetchNextPage,
          },
    );
    mockUseSearchMoments.mockImplementation((_q, enabled: boolean) => ({
      ...idleQuery,
      data: enabled
        ? { pages: [{ data: [], meta: { cursor: null, hasMore: false } }] }
        : undefined,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: mockFetchNextPage,
      error: null,
    }));
  });

  afterEach(() => cleanup());

  test("默认只启用动态，切换 Tab 后按需启用对应搜索", () => {
    render(<SearchResults keyword="测试" />);

    expect(document.querySelector('[data-slot="tabs"]')).toHaveClass(
      "w-full",
      "flex-col",
      "min-w-0",
    );
    expect(screen.getByRole("tabpanel")).toHaveClass("w-full", "min-w-0");
    expect(mockUseSearchMoments).toHaveBeenLastCalledWith("测试", true, undefined);
    expect(mockUseSearchThreads).toHaveBeenLastCalledWith("测试", false);
    expect(mockUseSearchUsers).toHaveBeenLastCalledWith("测试", false);
    expect(mockUseSearchPosts).toHaveBeenLastCalledWith("测试", false);
    expect(mockMomentMasonry).toHaveBeenLastCalledWith(
      expect.objectContaining({ maxLanes: 3 }),
    );
    expect(screen.getByRole("tab", { name: "动态" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "动态" })).toHaveClass(
      "self-stretch",
    );
    expect(screen.getByRole("tab", { name: "动态" })).not.toHaveClass(
      "h-full",
    );

    fireEvent.click(screen.getByRole("tab", { name: "主题帖" }));
    expect(mockUseSearchThreads).toHaveBeenLastCalledWith("测试", true);
    expect(screen.getByRole("link", { name: "查看主题帖：测试帖子" })).toHaveAttribute(
      "href",
      "/threads/t1",
    );
    expect(screen.getByText("统一后的主题帖正文预览")).toBeInTheDocument();
    expect(screen.getByText("招募中")).toBeInTheDocument();
    expect(document.querySelector("[data-thread-cover='true'] img")).toHaveAttribute(
      "src",
      "https://cdn.example.com/uploads/search-cover_feed.webp",
    );
    expect(document.querySelectorAll("[data-thread-cover='true'] img")).toHaveLength(1);

    fireEvent.click(screen.getByRole("tab", { name: "用户" }));
    expect(mockUseSearchUsers).toHaveBeenLastCalledWith("测试", true);
    expect(screen.getByRole("link", { name: /测试用户/ })).toHaveAttribute(
      "href",
      "/users/u1",
    );
    expect(screen.getByRole("link", { name: /测试用户/ })).toHaveClass("w-full");
  });

  test("主题帖分类展示加载和错误状态，并允许重试", () => {
    mockUseSearchThreads.mockImplementation((_q, enabled: boolean) =>
      enabled ? { ...idleQuery, isLoading: true } : idleQuery,
    );
    const loadingView = render(<SearchResults keyword="测试" />);

    fireEvent.click(screen.getByRole("tab", { name: "主题帖" }));
    expect(
      screen.getByRole("status", { name: "正在加载主题帖" }),
    ).toBeInTheDocument();
    loadingView.unmount();

    const refetch = vi.fn();
    mockUseSearchThreads.mockImplementation((_q, enabled: boolean) =>
      enabled
        ? {
            ...idleQuery,
            isError: true,
            error: new Error("搜索失败"),
            refetch,
            hasNextPage: false,
            isFetchingNextPage: false,
            fetchNextPage: mockFetchNextPage,
          }
        : idleQuery,
    );
    render(<SearchResults keyword="测试" />);

    fireEvent.click(screen.getByRole("tab", { name: "主题帖" }));
    expect(screen.getByText("搜索失败")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  test("楼层 Tab 不显示计数并可游标加载下一页", () => {
    render(<SearchResults keyword="测试" />);
    fireEvent.click(screen.getByRole("tab", { name: "楼层内容" }));

    expect(mockUseSearchPosts).toHaveBeenLastCalledWith("测试", true);
    expect(screen.getByRole("tab", { name: "楼层内容" })).toBeInTheDocument();
    expect(screen.queryByText("1+")).toBeNull();
    expect(screen.getByText("这是匹配的楼层内容")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /测试帖子/ })).toHaveAttribute(
      "href",
      "/threads/t1?post=p1",
    );
    expect(screen.getByRole("link", { name: /测试帖子/ })).toHaveClass("w-full");

    fireEvent.click(screen.getByRole("button", { name: "加载更多楼层" }));
    expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
  });

  test("单字符切到楼层 Tab 时提示补充关键词且不启用请求", () => {
    render(<SearchResults keyword="字" />);
    fireEvent.click(screen.getByRole("tab", { name: "楼层内容" }));

    expect(mockUseSearchPosts).toHaveBeenLastCalledWith("字", false);
    expect(screen.getByText("楼层内容搜索至少需要 2 个字符")).toBeInTheDocument();
    expect(screen.queryByText("这是匹配的楼层内容")).not.toBeInTheDocument();
  });

  test("关键词变化时保留旧结果但分类不显示计数", () => {
    mockUseSearchThreads.mockReturnValue({
      ...idleQuery,
      data: {
        pages: [{
          data: [thread],
          meta: { cursor: null, hasMore: false },
        }],
      },
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: mockFetchNextPage,
      isPlaceholderData: true,
    });

    render(<SearchResults keyword="新关键词" />);
    fireEvent.click(screen.getByRole("tab", { name: "主题帖" }));

    expect(screen.getByRole("link", { name: "查看主题帖：测试帖子" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "正在更新列表" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "主题帖 1" })).toBeNull();
  });
});
