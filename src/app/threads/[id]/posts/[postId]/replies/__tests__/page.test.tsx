import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rootQuery: vi.fn(),
  replyQuery: vi.fn(),
  closeComposer: vi.fn().mockResolvedValue(true),
  removeQueries: vi.fn(),
  routerReplace: vi.fn(),
}));
let currentSearch = "post=reply-1";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "thread-1", postId: "root-1" }),
  usePathname: () => "/threads/thread-1/posts/root-1/replies",
  useRouter: () => ({ replace: mocks.routerReplace }),
  useSearchParams: () => new URLSearchParams(currentSearch),
}));
vi.mock("@/api/hooks/use-content-access-cache", () => ({
  useContentAccessCache: () => ({
    clearPost: mocks.removeQueries,
    clearThread: mocks.removeQueries,
  }),
}));
vi.mock("@/api/hooks/use-post", () => ({
  usePost: (id?: string) => id === "root-1" ? mocks.rootQuery() : mocks.replyQuery(),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ isInitialized: true }) }));
vi.mock("@/components/thread/thread-composer-context", () => ({
  ThreadComposerProvider: ({ children }: { children: React.ReactNode }) => children,
  useThreadComposer: () => ({ close: mocks.closeComposer }),
}));
vi.mock("@/components/thread/thread-permissions-context", () => ({
  ThreadPermissionsProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/thread/reply-discussion", () => ({
  ReplyDiscussion: ({ rootPost }: { rootPost: { content: string } }) => (
    <div id="reply-discussion-start">
      {rootPost.content}
      <section>回复列表开头</section>
      <button type="button">回复原楼层</button>
    </div>
  ),
}));
vi.mock("@/components/thread/post-target-focus", () => ({
  PostTargetFocusSkeleton: () => <div>正在打开目标楼层…</div>,
  ReplyTargetFocus: ({ reply, onViewFullDiscussion }: {
    reply: { content: string };
    onViewFullDiscussion: () => void;
  }) => (
    <div>
      {reply.content}
      <button type="button" onClick={onViewFullDiscussion}>查看完整讨论</button>
    </div>
  ),
}));

import ReplyDiscussionPage from "@/app/threads/[id]/posts/[postId]/replies/page";

const rootPost = {
  id: "root-1",
  kind: "FLOOR",
  subthreadId: "sub-1",
  thread: { id: "thread-1" },
  parentPostId: null,
  floorNumber: 1,
  content: "不应穿透的缓存正文",
};
const replyPost = {
  id: "reply-1",
  kind: "FLOOR",
  subthreadId: "sub-1",
  thread: { id: "thread-1" },
  parentPostId: "root-1",
  floorNumber: null,
  content: "目标回复正文",
};

function readyQuery(data: unknown, error: unknown = null) {
  return {
    data,
    error,
    isLoading: false,
    isFetching: false,
    isFetchedAfterMount: true,
  };
}

describe("楼中楼深链访问复核", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearch = "post=reply-1";
    mocks.rootQuery.mockReturnValue(readyQuery(rootPost));
    mocks.replyQuery.mockReturnValue(readyQuery(replyPost));
  });
  afterEach(cleanup);

  test("挂载复核完成前不展示缓存正文或回复入口", () => {
    mocks.rootQuery.mockReturnValue({
      ...readyQuery(rootPost),
      isFetching: true,
      isFetchedAfterMount: false,
    });

    render(<ReplyDiscussionPage />);

    expect(screen.getByText("正在打开目标楼层…")).toBeInTheDocument();
    expect(screen.queryByText("不应穿透的缓存正文")).toBeNull();
    expect(screen.queryByRole("button", { name: "回复原楼层" })).toBeNull();
  });

  test("管理员隐藏父楼后即使缓存仍有正文也显示统一不可访问态", async () => {
    mocks.rootQuery.mockReturnValue(
      readyQuery(rootPost, { code: 40403, message: "帖子不存在" }),
    );

    render(<ReplyDiscussionPage />);

    expect(screen.getByText("讨论不存在或无法访问")).toBeInTheDocument();
    expect(screen.queryByText("不应穿透的缓存正文")).toBeNull();
    expect(screen.queryByRole("button", { name: "回复原楼层" })).toBeNull();
    await waitFor(() => expect(mocks.closeComposer).toHaveBeenCalledWith({ force: true }));
    expect(mocks.removeQueries).toHaveBeenCalled();
  });

  test("通知指向的子回复已失效时不会回落到仍可回复的父楼页面", async () => {
    mocks.replyQuery.mockReturnValue(
      readyQuery(replyPost, { code: 40403, message: "帖子不存在" }),
    );

    render(<ReplyDiscussionPage />);

    expect(screen.getByText("讨论不存在或无法访问")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "回复原楼层" })).toBeNull();
    await waitFor(() => expect(mocks.closeComposer).toHaveBeenCalledWith({ force: true }));
  });

  test("复核通过后只展示目标回复，不挂载分页讨论列表", () => {
    render(<ReplyDiscussionPage />);

    expect(screen.getByText("目标回复正文")).toBeInTheDocument();
    expect(screen.queryByText("不应穿透的缓存正文")).toBeNull();
    expect(screen.queryByRole("button", { name: "回复原楼层" })).toBeNull();
  });

  test("查看完整讨论以 replace 清除 post 并在首帧对齐父楼层开头", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    mocks.routerReplace.mockImplementation(() => {
      currentSearch = "";
    });
    const view = render(<ReplyDiscussionPage />);

    await user.click(screen.getByRole("button", { name: "查看完整讨论" }));

    expect(mocks.closeComposer).toHaveBeenCalled();
    expect(mocks.routerReplace).toHaveBeenCalledWith(
      "/threads/thread-1/posts/root-1/replies",
      { scroll: false },
    );
    view.rerender(<ReplyDiscussionPage />);
    expect(screen.getByText("回复列表开头")).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
  });
});
