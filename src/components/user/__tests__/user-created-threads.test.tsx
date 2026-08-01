/** UserCreatedThreads 组件测试：加载/空/列表渲染 */

import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockUseUserCreatedThreads } = vi.hoisted(() => ({
  mockUseUserCreatedThreads: vi.fn(),
}));

vi.mock("@/api/hooks/use-user-created-threads", () => ({
  useUserCreatedThreads: () => mockUseUserCreatedThreads(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { UserCreatedThreads } from "@/components/user/user-created-threads";

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
  title: "我创建的帖",
  ownerId: "u1",
  category: "RPG",
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: true,
  pinned: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  owner: { id: "u1", username: "testuser", avatar: null },
  defaultSubthread: { id: "s1", title: "我创建的帖" },
  topicTags: [],
  _count: { members: 1, players: 1, posts: 2 },
  preview: "预览",
};

describe("UserCreatedThreads", () => {
  test("加载中显示加载提示", () => {
    mockUseUserCreatedThreads.mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: true,
      isError: false,
      error: undefined,
    });
    render(<UserCreatedThreads userId="u1" />, { wrapper: createWrapper() });
    expect(screen.getByText("加载中…")).toBeInTheDocument();
  });

  test("空列表显示空状态", () => {
    mockUseUserCreatedThreads.mockReturnValue({
      data: { pages: [] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: undefined,
    });
    render(<UserCreatedThreads userId="u1" />, { wrapper: createWrapper() });
    expect(screen.getByText("还没有创建过帖子")).toBeInTheDocument();
  });

  test("渲染创建的帖子", () => {
    mockUseUserCreatedThreads.mockReturnValue({
      data: { pages: [{ data: [sampleThread], meta: { cursor: null, hasMore: false } }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: undefined,
    });
    render(<UserCreatedThreads userId="u1" />, { wrapper: createWrapper() });
    expect(screen.getByRole("link", { name: /我创建的帖/ })).toBeInTheDocument();
    expect(screen.getByText("RPG")).toBeInTheDocument();
    expect(screen.getByText("招募中")).toBeInTheDocument();
  });
});
