import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";

const { mockPush, mockUseAuth, mockUseThreads } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockUseAuth: vi.fn(),
  mockUseThreads: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/api/hooks/use-threads", () => ({
  useThreads: (...args: unknown[]) => mockUseThreads(...args),
}));
vi.mock("@/components/layout/page-shell", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/thread/category-tabs", () => ({
  CategoryTabs: ({ selected, onChange }: {
    selected?: string;
    onChange: (value?: string) => void;
  }) => (
    <button type="button" onClick={() => onChange("RPG")}>分类:{selected ?? "全部"}</button>
  ),
}));
vi.mock("@/components/thread/thread-filters", () => ({
  ThreadFilters: ({ sort, status, onSortChange, onStatusChange }: {
    sort: string;
    status?: string;
    onSortChange: (value: "newest") => void;
    onStatusChange: (value: "RECRUITING") => void;
  }) => (
    <div>
      <button type="button" onClick={() => onSortChange("newest")}>排序:{sort}</button>
      <button type="button" onClick={() => onStatusChange("RECRUITING")}>状态:{status ?? "全部"}</button>
    </div>
  ),
}));
vi.mock("@/components/thread/thread-list", () => ({
  ThreadList: ({ threads, onLoadMore, onRetry }: {
    threads: Array<{ id: string }>;
    onLoadMore: () => void;
    onRetry: () => void;
  }) => (
    <div>
      <span>帖子:{threads.map((thread) => thread.id).join(",")}</span>
      <button type="button" onClick={onLoadMore}>加载更多</button>
      <button type="button" onClick={onRetry}>重试列表</button>
    </div>
  ),
}));

import HomePage from "@/app/page";

const fetchNextPage = vi.fn();
const refetch = vi.fn();

function renderPage({
  searchParams = "",
  onUrlUpdate,
}: {
  searchParams?: string;
  onUrlUpdate?: (event: UrlUpdateEvent) => void;
} = {}) {
  return render(
    <NuqsTestingAdapter
      searchParams={searchParams}
      onUrlUpdate={onUrlUpdate}
      hasMemory
    >
      <HomePage />
    </NuqsTestingAdapter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: null });
  mockUseThreads.mockReturnValue({
    data: { pages: [{ data: [{ id: "t1" }] }, { data: [{ id: "t2" }] }] },
    fetchNextPage,
    hasNextPage: true,
    isFetchingNextPage: false,
    isLoading: false,
    error: null,
    refetch,
  });
});

afterEach(() => cleanup());

describe("首页", () => {
  test("访客不显示创建入口且合并分页帖子", () => {
    renderPage();

    expect(screen.queryByRole("button", { name: "创建主题帖" })).not.toBeInTheDocument();
    expect(screen.getByText("帖子:t1,t2")).toBeInTheDocument();
    expect(mockUseThreads).toHaveBeenLastCalledWith({
      category: undefined,
      sort: "recommended",
      status: undefined,
    });
  });

  test("登录用户可进入创建页", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    renderPage();

    await user.click(screen.getByRole("button", { name: "创建主题帖" }));
    expect(mockPush).toHaveBeenCalledWith("/threads/create");
  });

  test("分类、排序和状态变化同步到查询参数", async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
    renderPage({ onUrlUpdate });

    await user.click(screen.getByRole("button", { name: "分类:全部" }));
    await user.click(screen.getByRole("button", { name: "排序:recommended" }));
    await user.click(screen.getByRole("button", { name: "状态:全部" }));

    await waitFor(() => {
      expect(mockUseThreads).toHaveBeenLastCalledWith({
        category: "RPG",
        sort: "newest",
        status: "RECRUITING",
      });
    });
    expect(onUrlUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      searchParams: new URLSearchParams("category=RPG&sort=newest&status=RECRUITING"),
    }));
  });

  test("从 URL 恢复筛选条件并忽略非法值", () => {
    renderPage({ searchParams: "?category=NATION&sort=active&status=unknown" });

    expect(mockUseThreads).toHaveBeenLastCalledWith({
      category: "NATION",
      sort: "active",
      status: undefined,
    });
  });

  test("列表加载更多与重试调用查询动作", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "加载更多" }));
    await user.click(screen.getByRole("button", { name: "重试列表" }));

    expect(fetchNextPage).toHaveBeenCalledOnce();
    expect(refetch).toHaveBeenCalledOnce();
  });
});
