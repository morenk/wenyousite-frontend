import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { PostDetail } from "@/api/hooks/use-post";
import {
  FloorTargetFocus,
  PostTargetFocusSkeleton,
  ReplyTargetFocus,
} from "@/components/thread/post-target-focus";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("@/components/thread/floor-card", () => ({
  FloorCard: ({ floor }: { floor: { id: string; content: string } }) => (
    <article data-testid="focused-floor" data-post-id={floor.id}>{floor.content}</article>
  ),
}));

vi.mock("@/components/thread/reply-card", () => ({
  ReplyCard: ({ reply }: { reply: { id: string; content: string } }) => (
    <article data-testid="focused-reply" data-post-id={reply.id}>{reply.content}</article>
  ),
}));

afterEach(cleanup);

function post(overrides: Partial<PostDetail> = {}): PostDetail {
  return {
    id: "floor-42",
    threadId: "thread-1",
    subthreadId: "sub-2",
    authorId: "user-1",
    kind: "FLOOR",
    floorNumber: 42,
    parentPostId: null,
    replyToPostId: null,
    clientRequestId: null,
    content: "目标楼层正文",
    version: 1,
    createdAt: "2026-09-25T00:00:00Z",
    updatedAt: "2026-09-25T00:00:00Z",
    deletedAt: null,
    author: { id: "user-1", username: "作者", avatar: null, level: 1 },
    thread: { id: "thread-1", title: "主题标题" },
    subthread: { id: "sub-2", title: "剧情子贴" },
    parentPost: null,
    _count: { replies: 0 },
    ...overrides,
  };
}

describe("精确楼层稳定阅读态", () => {
  test("复核期间只显示稳定骨架，不泄露缓存目标正文", () => {
    render(<PostTargetFocusSkeleton />);

    expect(screen.getByRole("status", { name: "正在打开目标楼层" })).toBeInTheDocument();
    expect(screen.getByText("正在打开目标楼层…")).toBeInTheDocument();
    expect(screen.queryByText("目标楼层正文")).toBeNull();
    expect(screen.getByRole("status", { name: "正在打开目标楼层" })).toHaveClass("min-h-[28rem]");
  });

  test("主楼层独立于分页列表呈现，并保留主题与子贴上下文", async () => {
    const user = userEvent.setup();
    const onViewFullDiscussion = vi.fn();
    render(
      <FloorTargetFocus
        floor={post()}
        defaultSubthreadId="sub-1"
        onViewFullDiscussion={onViewFullDiscussion}
      />,
    );

    expect(screen.getByRole("heading", { name: "目标楼层 #42" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "主题标题" })).toHaveAttribute("href", "/threads/thread-1");
    expect(screen.getByRole("link", { name: "剧情子贴" })).toHaveAttribute(
      "href",
      "/threads/thread-1?subthread=sub-2",
    );
    expect(screen.getByTestId("focused-floor")).toHaveTextContent("目标楼层正文");
    expect(document.querySelector('[data-slot="floor-list-sentinel"]')).toBeNull();

    await user.click(screen.getByRole("button", { name: "查看完整讨论" }));
    expect(onViewFullDiscussion).toHaveBeenCalledOnce();
  });

  test("切换目标时直接替换独立卡片，不累计旧目标", () => {
    const view = render(
      <FloorTargetFocus
        floor={post()}
        defaultSubthreadId="sub-1"
        onViewFullDiscussion={vi.fn()}
      />,
    );

    view.rerender(
      <FloorTargetFocus
        floor={post({ id: "floor-99", floorNumber: 99, content: "新目标正文" })}
        defaultSubthreadId="sub-1"
        onViewFullDiscussion={vi.fn()}
      />,
    );

    expect(screen.getByTestId("focused-floor")).toHaveAttribute("data-post-id", "floor-99");
    expect(screen.getByText("新目标正文")).toBeInTheDocument();
    expect(screen.queryByText("目标楼层正文")).toBeNull();
  });

  test("精确回复留在独立讨论坐标且不注入回复分页", () => {
    const rootPost = post({ id: "floor-1", floorNumber: 1 });
    const reply = post({
      id: "reply-8",
      floorNumber: null,
      parentPostId: "floor-1",
      content: "精确回复正文",
    });

    render(
      <ReplyTargetFocus
        rootPost={rootPost}
        reply={reply}
        onViewFullDiscussion={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "目标回复" })).toBeInTheDocument();
    expect(screen.getByTestId("focused-reply")).toHaveTextContent("精确回复正文");
    expect(screen.getByRole("link", { name: /回复于楼层 #1/ })).toHaveAttribute(
      "href",
      "/threads/thread-1?post=floor-1",
    );
    expect(screen.queryByTestId("reply-list")).toBeNull();
  });
});
