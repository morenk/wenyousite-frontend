/** 帖内楼层搜索面板测试：覆盖短词、四态、分页与精确定位。 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThreadPostSearch } from "@/components/thread/thread-post-search";

const { mockUseThreadSearchPosts, mockFetchNextPage } = vi.hoisted(() => ({
  mockUseThreadSearchPosts: vi.fn(),
  mockFetchNextPage: vi.fn(),
}));

vi.mock("@/api/hooks/use-search", () => ({
  isPostSearchKeywordValid: (q: string) => Array.from(q.trim()).length >= 2,
  useThreadSearchPosts: mockUseThreadSearchPosts,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: () => void;
  }) => <a href={href} {...props}>{children}</a>,
}));

const post = {
  id: "reply-1",
  floorNumber: null,
  parentPostId: "floor-1",
  content: "这是匹配的楼中楼回复",
  createdAt: "2026-01-01T00:00:00Z",
  author: { id: "u1", username: "测试用户" },
  thread: { id: "t1", title: "测试主题帖" },
  subthread: { id: "s2", title: "第二幕" },
};

const idleQuery = {
  data: undefined,
  isLoading: false,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: mockFetchNextPage,
  refetch: vi.fn(),
};

describe("ThreadPostSearch", () => {
  beforeEach(() => {
    mockFetchNextPage.mockReset();
    mockUseThreadSearchPosts.mockImplementation(
      (_threadId: string, _q: string, enabled: boolean) => enabled
        ? {
            ...idleQuery,
            data: {
              pages: [{
                data: [post],
                meta: { cursor: "next", hasMore: true },
              }],
            },
            hasNextPage: true,
          }
        : idleQuery,
    );
  });

  afterEach(() => cleanup());

  test("短词提交只显示友好提示且不启用请求", async () => {
    const user = userEvent.setup();
    render(<ThreadPostSearch threadId="t1" onClose={vi.fn()} />);

    await user.type(screen.getByRole("searchbox", { name: "搜索本帖楼层关键词" }), "字");
    await user.click(screen.getByRole("button", { name: "搜索" }));

    expect(mockUseThreadSearchPosts).toHaveBeenLastCalledWith("t1", "字", false);
    expect(screen.getByText("请输入至少 2 个字符")).toBeInTheDocument();
  });

  test("搜索全部子贴并复用精确跳转和加载更多结果", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ThreadPostSearch
        threadId="t1"
        onClose={vi.fn()}
        onSelect={onSelect}
      />,
    );

    await user.type(screen.getByRole("searchbox", { name: "搜索本帖楼层关键词" }), "测试");
    await user.click(screen.getByRole("button", { name: "搜索" }));

    expect(mockUseThreadSearchPosts).toHaveBeenLastCalledWith("t1", "测试", true);
    const result = screen.getByRole("link", { name: /这是匹配的楼中楼回复/ });
    expect(result).toHaveAttribute(
      "href",
      "/threads/t1/posts/floor-1/replies?post=reply-1",
    );

    await user.click(result);
    expect(onSelect).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "加载更多楼层" }));
    expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
  });

  test("搜索预览隐藏骰子协议和链接地址", async () => {
    const user = userEvent.setup();
    const protocolPost = {
      ...post,
      content:
        "概率 [[dice:v1:0f16151d-6e9e-415d-b9ae-c91829a52888:2d50]]，查看 [规则](https://example.com/rule)",
    };
    mockUseThreadSearchPosts.mockReturnValue({
      ...idleQuery,
      data: {
        pages: [{
          data: [protocolPost],
          meta: { cursor: null, hasMore: false },
        }],
      },
    });
    render(<ThreadPostSearch threadId="t1" onClose={vi.fn()} />);

    await user.type(
      screen.getByRole("searchbox", { name: "搜索本帖楼层关键词" }),
      "概率",
    );
    await user.click(screen.getByRole("button", { name: "搜索" }));

    expect(screen.getByText("概率 [2d50]，查看 [规则]")).toBeInTheDocument();
    expect(screen.queryByText(/dice:v1/)).not.toBeInTheDocument();
    expect(screen.queryByText(/example\.com/)).not.toBeInTheDocument();
  });

  test("无匹配结果显示空态", async () => {
    const user = userEvent.setup();
    mockUseThreadSearchPosts.mockReturnValue({
      ...idleQuery,
      data: {
        pages: [{ data: [], meta: { cursor: null, hasMore: false } }],
      },
    });
    render(<ThreadPostSearch threadId="t1" onClose={vi.fn()} />);

    await user.type(screen.getByRole("searchbox", { name: "搜索本帖楼层关键词" }), "测试");
    await user.click(screen.getByRole("button", { name: "搜索" }));

    expect(screen.getByText("本帖没有匹配的楼层")).toBeInTheDocument();
  });

  test("请求失败可重试", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseThreadSearchPosts.mockReturnValue({
      ...idleQuery,
      isError: true,
      refetch,
    });
    render(<ThreadPostSearch threadId="t1" onClose={vi.fn()} />);

    await user.type(screen.getByRole("searchbox", { name: "搜索本帖楼层关键词" }), "测试");
    await user.click(screen.getByRole("button", { name: "搜索" }));
    await user.click(screen.getByRole("button", { name: "重试" }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
