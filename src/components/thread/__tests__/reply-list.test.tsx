/** ReplyList 组件测试：楼中楼回复列表 */

import { describe, test, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockUseReplies } = vi.hoisted(() => ({
  mockUseReplies: vi.fn(),
}));

vi.mock("@/api/hooks/use-replies", () => ({
  useReplies: () => mockUseReplies(),
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

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

const sampleReply = {
  id: "reply-1",
  threadId: "t1",
  subthreadId: "s1",
  authorId: "u2",
  floorNumber: null,
  parentPostId: "post-1",
  replyToPostId: null,
  content: "楼中楼回复内容",
  version: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  author: { id: "u2", username: "replier", avatar: null },
  _count: { replies: 0 },
  replies: [],
};

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
    mockUseReplies.mockReturnValue({
      isLoading: false,
      data: { pages: [{ data: [sampleReply], meta: { cursor: null, hasMore: false } }] },
      hasNextPage: false,
      isFetchingNextPage: false,
      error: undefined,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    });
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
});
