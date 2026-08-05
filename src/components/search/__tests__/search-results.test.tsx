/** SearchResults 组件测试：三类结果 Tab、分类切换与空态 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SearchResults } from "@/components/search/search-results";
import type { SearchResult } from "@/api/hooks/use-search";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

afterEach(() => cleanup());

const data: SearchResult = {
  users: [
    {
      id: "u1",
      username: "测试用户",
      avatar: null,
      bio: "一起写故事",
    },
  ],
  threads: [
    {
      id: "t1",
      title: "测试帖子",
      category: "RPG",
      createdAt: "2026-01-01T00:00:00Z",
      owner: { id: "u1", username: "morenk", avatar: null },
      _count: { members: 1, posts: 2, players: 1 },
    },
  ],
  posts: [
    {
      id: "p1",
      floorNumber: 1,
      content: "这是匹配的楼层内容",
      createdAt: "2026-01-01T00:00:00Z",
      author: { id: "u1", username: "morenk" },
      thread: { id: "t1", title: "测试帖子" },
      subthread: { id: "s1", title: "主讨论区" },
    },
  ],
};

describe("SearchResults", () => {
  test("空结果显示空态", () => {
    render(<SearchResults data={{ users: [], threads: [], posts: [] }} />);
    expect(screen.getByText("没有找到相关内容")).toBeInTheDocument();
  });

  test("以 Tab 展示三类结果且默认优先展示主题帖", () => {
    render(<SearchResults data={data} />);

    const threadTab = screen.getByRole("tab", { name: "主题帖 1" });
    const postTab = screen.getByRole("tab", { name: "楼层内容 1" });
    const userTab = screen.getByRole("tab", { name: "用户 1" });
    expect(threadTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("link", { name: /测试帖子/ })).toHaveAttribute("href", "/threads/t1");
    expect(screen.queryByRole("link", { name: /测试用户/ })).not.toBeInTheDocument();
    expect(screen.queryByText("这是匹配的楼层内容")).not.toBeInTheDocument();

    fireEvent.click(userTab);
    expect(screen.getByRole("link", { name: /测试用户/ })).toHaveAttribute("href", "/users/u1");
    expect(screen.queryByRole("link", { name: /测试帖子/ })).not.toBeInTheDocument();

    fireEvent.click(postTab);
    expect(screen.getByText("这是匹配的楼层内容")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /测试帖子/ })).toHaveAttribute(
      "href",
      "/threads/t1?post=p1",
    );
  });

  test("可切换到无结果分类并显示分类空态", () => {
    render(<SearchResults data={{ users: [], threads: data.threads, posts: [] }} />);
    fireEvent.click(screen.getByRole("tab", { name: "楼层内容 0" }));
    expect(screen.getByText("没有匹配的楼层内容")).toBeInTheDocument();
  });

  test("仅用户有结果时默认打开用户 Tab", () => {
    render(<SearchResults data={{ users: data.users, threads: [], posts: [] }} />);
    expect(screen.getByRole("tab", { name: "用户 1" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("一起写故事")).toBeInTheDocument();
  });
});
