/** UserPlayedThreads 组件测试：加载/空/列表渲染 */

import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockUseUserPlayedThreads } = vi.hoisted(() => ({
  mockUseUserPlayedThreads: vi.fn(),
}));

vi.mock("@/api/hooks/use-user-played-threads", () => ({
  useUserPlayedThreads: (...args: unknown[]) => mockUseUserPlayedThreads(...args),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { UserPlayedThreads } from "@/components/user/user-played-threads";

beforeAll(() => {
  vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

afterEach(() => cleanup());
beforeEach(() => vi.clearAllMocks());

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

const sampleThread = {
  id: "t1",
  title: "测试帖",
  ownerId: "u1",
  category: "RPG",
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: true,
  pinned: false,
  tipTotal: "4",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  owner: { id: "u1", username: "testuser", avatar: null, level: 2 },
  defaultSubthread: { id: "s1", title: "测试帖", lastPostAt: null },
  topicTags: [],
  _count: { members: 1, players: 1, posts: 2 },
  preview: "预览",
  coverImages: [],
};

describe("UserPlayedThreads", () => {
  test("加载中显示加载提示", () => {
    mockUseUserPlayedThreads.mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: true,
      isError: false,
      error: undefined,
    });
    render(<UserPlayedThreads userId="u1" isSelf={false} />, { wrapper: createWrapper() });
    expect(screen.getByRole("status", { name: "正在加载主题帖" })).toBeInTheDocument();
  });

  test("空列表显示空状态", () => {
    mockUseUserPlayedThreads.mockReturnValue({
      data: { pages: [] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: undefined,
    });
    render(<UserPlayedThreads userId="u1" isSelf={false} />, { wrapper: createWrapper() });
    expect(screen.getByText("还没有参与过帖子")).toBeInTheDocument();
  });

  test("错误显示未公开占位", () => {
    mockUseUserPlayedThreads.mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: true,
      error: new Error("404"),
    });
    render(<UserPlayedThreads userId="u1" isSelf={false} />, { wrapper: createWrapper() });
    expect(screen.getByText("该用户未公开参与的帖子")).toBeInTheDocument();
  });

  test("渲染参与的帖子", () => {
    mockUseUserPlayedThreads.mockReturnValue({
      data: { pages: [{ data: [sampleThread], meta: { cursor: null, hasMore: false } }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: undefined,
    });
    render(<UserPlayedThreads userId="u1" isSelf={false} />, { wrapper: createWrapper() });
    expect(screen.getByRole("link", { name: /测试帖/ })).toBeInTheDocument();
    expect(screen.getByText("RPG")).toBeInTheDocument();
    expect(screen.getByText("招募中")).toBeInTheDocument();
  });

  test("本人可按全部、公开帖和私密帖分类查询", async () => {
    mockUseUserPlayedThreads.mockReturnValue({
      data: { pages: [] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
    });
    const user = userEvent.setup();

    render(<UserPlayedThreads userId="u1" isSelf />, { wrapper: createWrapper() });
    expect(screen.getByRole("button", { name: "全部" })).toHaveAttribute("aria-pressed", "true");
    expect(mockUseUserPlayedThreads).toHaveBeenLastCalledWith("u1", undefined);

    await user.click(screen.getByRole("button", { name: "私密帖" }));
    expect(mockUseUserPlayedThreads).toHaveBeenLastCalledWith("u1", "PRIVATE");

    await user.click(screen.getByRole("button", { name: "公开帖" }));
    expect(mockUseUserPlayedThreads).toHaveBeenLastCalledWith("u1", "PUBLIC");
  });

  test("查看他人主页时不展示私密分类入口", () => {
    mockUseUserPlayedThreads.mockReturnValue({
      data: { pages: [] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
    });

    render(<UserPlayedThreads userId="u1" isSelf={false} />, { wrapper: createWrapper() });

    expect(screen.queryByRole("button", { name: "私密帖" })).not.toBeInTheDocument();
    expect(mockUseUserPlayedThreads).toHaveBeenLastCalledWith("u1", undefined);
  });

  test("私密帖条目显示友好的私密标识", () => {
    mockUseUserPlayedThreads.mockReturnValue({
      data: { pages: [{ data: [{ ...sampleThread, visibility: "PRIVATE" }], meta: { cursor: null, hasMore: false } }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
    });

    render(<UserPlayedThreads userId="u1" isSelf />, { wrapper: createWrapper() });

    expect(within(screen.getByRole("listitem")).getByText("私密帖")).toBeInTheDocument();
  });
});
