/** SearchResults 组件测试：主题帖/楼层/空态 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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

  test("渲染用户、主题帖与楼层三栏", () => {
    render(<SearchResults data={data} />);
    expect(screen.getByText("用户（1）")).toBeInTheDocument();
    expect(screen.getByText("主题帖（1）")).toBeInTheDocument();
    expect(screen.getByText("楼层内容（1）")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /测试用户/ })).toHaveAttribute("href", "/users/u1");
    expect(screen.getByText("这是匹配的楼层内容")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: /测试帖子/ });
    expect(links).toHaveLength(2);
    links.forEach((l) => expect(l).toHaveAttribute("href", "/threads/t1"));
  });

  test("仅主题帖无楼层时只显示主题帖栏", () => {
    render(<SearchResults data={{ users: [], threads: data.threads, posts: [] }} />);
    expect(screen.getByText("主题帖（1）")).toBeInTheDocument();
    expect(screen.queryByText(/楼层内容/)).not.toBeInTheDocument();
  });

  test("仅用户结果时仍能进入用户主页", () => {
    render(<SearchResults data={{ users: data.users, threads: [], posts: [] }} />);
    expect(screen.getByText("用户（1）")).toBeInTheDocument();
    expect(screen.getByText("一起写故事")).toBeInTheDocument();
    expect(screen.queryByText(/主题帖（/)).not.toBeInTheDocument();
  });
});
