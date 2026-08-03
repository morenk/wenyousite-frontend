/** ReplyDiscussion 测试：原楼层上下文与沉浸式回复列表 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ReplyDiscussion } from "@/components/thread/reply-discussion";
import { ThreadComposerProvider } from "@/components/thread/thread-composer-context";
import type { PostDetail } from "@/api/hooks/use-post";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: null, isInitialized: true }),
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
  floorNumber: 12,
  parentPostId: null,
  replyToPostId: null,
  content: "原楼层长文",
  version: 1,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
  deletedAt: null,
  author: { id: "u1", username: "作者", avatar: null },
  _count: { replies: 87 },
  replies: [],
  thread: { id: "t1", title: "主题帖" },
  subthread: { id: "s1", title: "剧情子贴" },
  parentPost: null,
};

describe("ReplyDiscussion", () => {
  test("把原楼层作为讨论正文并使用沉浸式回复列表", () => {
    render(
      <ThreadComposerProvider>
        <ReplyDiscussion rootPost={rootPost} />
      </ThreadComposerProvider>,
    );

    expect(screen.getByText("原楼层长文")).toBeInTheDocument();
    expect(screen.getByText("原子贴 #12 楼", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("共 87 条回复")).toBeInTheDocument();
    expect(screen.getByTestId("reply-list")).toHaveTextContent("p1:discussion");
    expect(screen.getByRole("link", { name: /返回原楼层/ })).toHaveAttribute(
      "href",
      "/threads/t1?post=p1",
    );
  });
});
