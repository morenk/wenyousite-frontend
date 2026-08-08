/** SearchResults 组件测试：分类惰性加载、短词提示与楼层分页。 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SearchResults } from "@/components/search/search-results";

const {
  mockUseSearchThreads,
  mockUseSearchUsers,
  mockUseSearchPosts,
  mockFetchNextPage,
} = vi.hoisted(() => ({
  mockUseSearchThreads: vi.fn(),
  mockUseSearchUsers: vi.fn(),
  mockUseSearchPosts: vi.fn(),
  mockFetchNextPage: vi.fn(),
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
  isPostSearchKeywordValid: (q: string) => Array.from(q.trim()).length >= 2,
}));

const thread = {
  id: "t1",
  title: "测试帖子",
  category: "RPG",
  createdAt: "2026-01-01T00:00:00Z",
  owner: { id: "u1", username: "morenk", avatar: null },
  _count: { members: 1, posts: 2, players: 1 },
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
  refetch: vi.fn(),
};

describe("SearchResults", () => {
  beforeEach(() => {
    mockFetchNextPage.mockReset();
    mockUseSearchThreads.mockImplementation((_q, enabled: boolean) =>
      enabled ? { ...idleQuery, data: [thread] } : idleQuery,
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
  });

  afterEach(() => cleanup());

  test("默认只启用主题帖，点击用户 Tab 后才启用用户搜索", () => {
    render(<SearchResults keyword="测试" />);

    expect(mockUseSearchThreads).toHaveBeenLastCalledWith("测试", true);
    expect(mockUseSearchUsers).toHaveBeenLastCalledWith("测试", false);
    expect(mockUseSearchPosts).toHaveBeenLastCalledWith("测试", false);
    expect(screen.getByRole("tab", { name: "主题帖 1" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("link", { name: /测试帖子/ })).toHaveAttribute(
      "href",
      "/threads/t1",
    );

    fireEvent.click(screen.getByRole("tab", { name: "用户" }));
    expect(mockUseSearchUsers).toHaveBeenLastCalledWith("测试", true);
    expect(screen.getByRole("link", { name: /测试用户/ })).toHaveAttribute(
      "href",
      "/users/u1",
    );
  });

  test("楼层 Tab 显示更多标记并可游标加载下一页", () => {
    render(<SearchResults keyword="测试" />);
    fireEvent.click(screen.getByRole("tab", { name: "楼层内容" }));

    expect(mockUseSearchPosts).toHaveBeenLastCalledWith("测试", true);
    expect(screen.getByRole("tab", { name: "楼层内容 1+" })).toBeInTheDocument();
    expect(screen.getByText("这是匹配的楼层内容")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /测试帖子/ })).toHaveAttribute(
      "href",
      "/threads/t1?post=p1",
    );

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

  test("关键词变化时保留旧结果并标记列表正在更新", () => {
    mockUseSearchThreads.mockReturnValue({
      ...idleQuery,
      data: [thread],
      isPlaceholderData: true,
    });

    render(<SearchResults keyword="新关键词" />);

    expect(screen.getByRole("link", { name: /测试帖子/ })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "正在更新列表" })).toBeInTheDocument();
  });
});
