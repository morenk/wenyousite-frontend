/** ReplyDiscussion 测试：原楼层上下文与沉浸式回复列表 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ReplyDiscussion } from "@/components/thread/reply-discussion";
import { ThreadComposerProvider } from "@/components/thread/thread-composer-context";
import type { PostDetail } from "@/api/hooks/use-post";

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/components/thread/markdown-content", () => ({
  MarkdownContent: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock("@/components/thread/reply-list", () => ({
  ReplyList: ({ postId, variant }: { postId: string; variant: string }) => (
    <div data-testid="reply-list">{postId}:{variant}</div>
  ),
}));

afterEach(() => cleanup());

const rootPost: PostDetail = {
  id: "p1",
  threadId: "t1",
  subthreadId: "s1",
  authorId: "u1",
  kind: "FLOOR",
  floorNumber: 12,
  parentPostId: null,
  replyToPostId: null,
  clientRequestId: null,
  content: "原楼层长文",
  version: 1,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
  deletedAt: null,
  author: { id: "u1", username: "作者", avatar: null, level: 1 },
  _count: { replies: 87 },
  thread: { id: "t1", title: "主题帖" },
  subthread: { id: "s1", title: "剧情子贴" },
  parentPost: null,
};

describe("ReplyDiscussion", () => {
  test("回复入口语义上位于列表底部，但使用浮动输入坞持续可达", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    render(
      <ThreadComposerProvider>
        <ReplyDiscussion rootPost={rootPost} />
      </ThreadComposerProvider>,
    );

    expect(screen.getByText("原楼层长文")).toBeInTheDocument();
    expect(screen.getByText("原子贴 #12 楼", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("共 87 条回复")).toBeInTheDocument();
    const list = screen.getByTestId("reply-list");
    const anchor = document.querySelector<HTMLElement>(
      '[data-slot="floating-composer-anchor"]',
    );
    const dock = document.querySelector<HTMLElement>(
      '[data-slot="floating-composer-dock"]',
    );
    expect(list).toHaveTextContent("p1:discussion");
    expect(dock).toHaveClass("fixed", "bottom-4", "z-30");
    expect(dock?.parentElement).toBe(document.body);
    expect(
      list.compareDocumentPosition(anchor!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "参与讨论" })).not.toBeInTheDocument();
    expect(screen.getByText("登录后即可参与讨论")).toBeInTheDocument();
  });

  test("登录用户在浮动输入坞中看到发表回复入口", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u2" }, isInitialized: true });
    render(
      <ThreadComposerProvider>
        <ReplyDiscussion rootPost={rootPost} />
      </ThreadComposerProvider>,
    );

    expect(screen.queryByRole("button", { name: "参与讨论" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发表回复…" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /返回原楼层/ })).toHaveAttribute(
      "href",
      "/threads/t1?post=p1",
    );
  });
});
