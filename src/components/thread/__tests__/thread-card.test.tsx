/** ThreadCard 组件测试 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ThreadCard } from "@/components/thread/thread-card";
import type { ThreadCardData } from "@/api/hooks/use-threads";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => {
    return <a href={href} {...props}>{children}</a>;
  },
}));

afterEach(() => cleanup());

const baseThread: ThreadCardData = {
  id: "thread-1",
  title: "测试帖子标题",
  category: "RPG",
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: true,
  pinned: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  owner: { id: "u1", username: "测试作者", avatar: null },
  defaultSubthread: { id: "s1", title: "主帖" },
  topicTags: [
    { tag: { id: "tag-1", name: "测试标签", color: null } },
    { tag: { id: "tag-2", name: "RPG", color: null } },
  ],
  _count: { members: 5, players: 2, posts: 12 },
  preview: "这是帖子摘要预览...",
};

describe("ThreadCard", () => {
  test("渲染标题", () => {
    render(<ThreadCard thread={baseThread} />);
    expect(screen.getByText("测试帖子标题")).toBeInTheDocument();
  });

  test("渲染分类（中文映射）", () => {
    render(<ThreadCard thread={baseThread} />);
    expect(screen.getByText("RPG")).toBeInTheDocument();
  });

  test("渲染状态（中文映射）", () => {
    render(<ThreadCard thread={baseThread} />);
    expect(screen.getByText("招募中")).toBeInTheDocument();
  });

  test("渲染作者名", () => {
    render(<ThreadCard thread={baseThread} />);
    expect(screen.getByText("测试作者")).toBeInTheDocument();
  });

  test("渲染标签", () => {
    render(<ThreadCard thread={baseThread} />);
    expect(screen.getByText("#测试标签")).toBeInTheDocument();
    expect(screen.getByText("#RPG")).toBeInTheDocument();
  });

  test("渲染玩家数和楼层数", () => {
    render(<ThreadCard thread={baseThread} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  test("渲染预览摘要", () => {
    render(<ThreadCard thread={baseThread} />);
    expect(screen.getByText("这是帖子摘要预览...")).toBeInTheDocument();
  });

  test("已关闭状态显示'已关闭'", () => {
    const closed = { ...baseThread, status: "CLOSED" as const };
    render(<ThreadCard thread={closed} />);
    expect(screen.getByText("已关闭")).toBeInTheDocument();
  });

  test("已完结状态显示'已完结'", () => {
    const finished = { ...baseThread, status: "FINISHED" as const };
    render(<ThreadCard thread={finished} />);
    expect(screen.getByText("已完结")).toBeInTheDocument();
  });

  test("国策分类显示'国策'", () => {
    const nation = { ...baseThread, category: "NATION" as const };
    render(<ThreadCard thread={nation} />);
    expect(screen.getByText("国策")).toBeInTheDocument();
  });

  test("置顶帖显示'置顶'", () => {
    const pinned = { ...baseThread, pinned: true };
    render(<ThreadCard thread={pinned} />);
    expect(screen.getByText("置顶")).toBeInTheDocument();
  });

  test("无预览时不在文档中", () => {
    const noPreview = { ...baseThread, preview: "" };
    render(<ThreadCard thread={noPreview} />);
    expect(screen.queryByText("这是帖子摘要预览...")).toBeNull();
  });

  test("无标签时不渲染标签区", () => {
    const noTags = { ...baseThread, topicTags: [] };
    render(<ThreadCard thread={noTags} />);
    expect(screen.queryByText("#测试标签")).toBeNull();
  });

  test("链接指向正确地址", () => {
    render(<ThreadCard thread={baseThread} />);
    const link = screen.getByText("测试帖子标题").closest("a");
    expect(link).toHaveAttribute("href", "/threads/thread-1");
  });
});
