/** ReplyList 组件测试：楼中楼回复列表 + 回复串内对用户回复 */

import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockUseReplies } = vi.hoisted(() => ({
  mockUseReplies: vi.fn(),
}));
const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

vi.mock("@/api/hooks/use-replies", () => ({
  useReplies: () => mockUseReplies(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/components/thread/reply-form", () => ({
  ReplyForm: ({
    subthreadId,
    parentPostId,
    replyToPostId,
    replyToLabel,
    onReplied,
  }: {
    subthreadId: string;
    parentPostId: string;
    replyToPostId?: string;
    replyToLabel?: string;
    onReplied?: () => void;
  }) => (
    <div data-testid="reply-form">
      <span>subthread:{subthreadId}</span>
      <span>parent:{parentPostId}</span>
      <span>replyTo:{replyToPostId}</span>
      <span>label:{replyToLabel}</span>
      <button type="button" onClick={onReplied}>
        onReplied
      </button>
    </div>
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => {
    return <a href={href} {...props}>{children}</a>;
  },
}));

import { ReplyList } from "@/components/thread/reply-list";

// happy-dom 无 IntersectionObserver
beforeAll(() => {
  vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});
afterEach(() => cleanup());
beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: null });
});

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

function baseReply(overrides: Record<string, unknown> = {}) {
  return {
    id: "reply-1",
    threadId: "t1",
    subthreadId: "s1",
    authorId: "u2",
    floorNumber: null,
    parentPostId: "post-1",
    replyToPostId: null,
    replyToPost: null,
    content: "楼中楼回复内容",
    version: 1,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    deletedAt: null,
    author: { id: "u2", username: "replier", avatar: null },
    _count: { replies: 0 },
    replies: [],
    ...overrides,
  };
}

function dataWithReplies(replies: unknown[]) {
  return {
    data: { pages: [{ data: replies, meta: { cursor: null, hasMore: false } }] },
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    error: undefined,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  };
}

describe("ReplyList", () => {
  test("加载中显示 spinner", () => {
    mockUseReplies.mockReturnValue({ isLoading: true, data: undefined, hasNextPage: false, isFetchingNextPage: false, error: undefined, fetchNextPage: vi.fn(), refetch: vi.fn() });
    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    expect(document.querySelector(".animate-spin")).toBeTruthy();
  });

  test("空列表提示", () => {
    mockUseReplies.mockReturnValue({ isLoading: false, data: { pages: [] }, hasNextPage: false, isFetchingNextPage: false, error: undefined, fetchNextPage: vi.fn(), refetch: vi.fn() });
    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    expect(screen.getByText("还没有回复")).toBeInTheDocument();
  });

  test("渲染回复内容与作者", () => {
    mockUseReplies.mockReturnValue(dataWithReplies([baseReply()]));
    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    expect(screen.getByText("replier")).toBeInTheDocument();
    expect(screen.getByText("楼中楼回复内容")).toBeInTheDocument();
  });

  test("错误状态显示重试", () => {
    mockUseReplies.mockReturnValue({ isLoading: false, data: undefined, hasNextPage: false, isFetchingNextPage: false, error: new Error("网络错误"), fetchNextPage: vi.fn(), refetch: vi.fn() });
    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    expect(screen.getByText("回复加载失败")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });

  test("未登录不显示回复按钮", () => {
    mockUseAuth.mockReturnValue({ user: null });
    mockUseReplies.mockReturnValue(dataWithReplies([baseReply()]));
    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    expect(screen.queryByRole("button", { name: "回复" })).not.toBeInTheDocument();
  });

  test("登录后显示回复按钮，点击展开回复串内 ReplyForm 并传入目标", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    const reply = baseReply({ id: "reply-2", author: { id: "u3", username: "小明", avatar: null } });
    mockUseReplies.mockReturnValue(dataWithReplies([reply]));

    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    const replyButton = screen.getByRole("button", { name: "回复" });
    expect(replyButton).toBeInTheDocument();

    await user.click(replyButton);
    const form = screen.getByTestId("reply-form");
    expect(form).toHaveTextContent("subthread:s1");
    expect(form).toHaveTextContent("parent:post-1");
    expect(form).toHaveTextContent("replyTo:reply-2");
    expect(form).toHaveTextContent("label:@小明");
  });

  test("再次点击收起回复表单", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    mockUseReplies.mockReturnValue(dataWithReplies([baseReply()]));

    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    const replyButton = screen.getByRole("button", { name: "回复" });

    await user.click(replyButton);
    expect(screen.getByTestId("reply-form")).toBeInTheDocument();

    await user.click(replyButton);
    expect(screen.queryByTestId("reply-form")).not.toBeInTheDocument();
  });

  test("回复串内回复显示「回复 @被回复者」上下文", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    const reply = baseReply({
      id: "reply-3",
      replyToPostId: "reply-1",
      replyToPost: {
        id: "reply-1",
        authorId: "u2",
        author: { id: "u2", username: "replier", avatar: null },
      },
    });
    mockUseReplies.mockReturnValue(dataWithReplies([reply]));

    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    const contextLink = screen.getByRole("link", { name: "@replier" });
    expect(contextLink).toHaveAttribute("href", "/users/u2");
    expect(screen.getByText("楼中楼回复内容")).toBeInTheDocument();
  });
});
