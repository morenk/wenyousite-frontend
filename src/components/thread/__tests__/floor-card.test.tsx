/** FloorCard 组件测试 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { FloorCard } from "@/components/thread/floor-card";
import type { PostData } from "@/api/hooks/use-floors";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => {
    return <a href={href} {...props}>{children}</a>;
  },
}));

afterEach(() => cleanup());

const baseFloor: PostData = {
  id: "post-1",
  threadId: "t1",
  subthreadId: "s1",
  authorId: "u1",
  floorNumber: 1,
  parentPostId: null,
  replyToPostId: null,
  content: "这是**加粗**的正文",
  version: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  author: { id: "u1", username: "测试用户", avatar: null },
  _count: { replies: 0 },
  replies: [],
};

describe("FloorCard", () => {
  test("渲染作者名和楼层号", () => {
    render(<FloorCard floor={baseFloor} isEven={false} />);
    expect(screen.getByText("测试用户")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
  });

  test("渲染 Markdown 加粗", () => {
    render(<FloorCard floor={baseFloor} isEven={false} />);
    const strong = screen.getByText("加粗");
    expect(strong.tagName).toBe("STRONG");
  });

  test("渲染纯文本内容", () => {
    const plain = { ...baseFloor, content: "纯文本正文" };
    render(<FloorCard floor={plain} isEven={false} />);
    expect(screen.getByText("纯文本正文")).toBeInTheDocument();
  });

  test("不显示回复数（replies 为 0）", () => {
    render(<FloorCard floor={baseFloor} isEven={false} />);
    expect(screen.queryByText("条回复")).toBeNull();
  });

  test("显示回复数（replies > 0）", () => {
    const withReplies = {
      ...baseFloor,
      _count: { replies: 3 },
    };
    render(<FloorCard floor={withReplies} isEven={false} />);
    expect(screen.getByText("3 条回复")).toBeInTheDocument();
  });

  test("偶数索引有 bg-muted 样式", () => {
    const { container } = render(
      <FloorCard floor={baseFloor} isEven={true} />,
    );
    expect(container.firstChild as HTMLElement).toHaveClass("bg-muted/30");
  });

  test("奇数索引没有 bg-muted 样式", () => {
    const { container } = render(
      <FloorCard floor={baseFloor} isEven={false} />,
    );
    expect(container.firstChild as HTMLElement).not.toHaveClass("bg-muted/30");
  });
});
