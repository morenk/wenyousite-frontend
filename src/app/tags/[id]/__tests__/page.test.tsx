import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockUseTag, mockUseThreads } = vi.hoisted(() => ({
  mockUseTag: vi.fn(),
  mockUseThreads: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "cms7rnyij000z7qdyg6zbge8e" }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@/api/hooks/use-tags", () => ({
  useTag: (...args: unknown[]) => mockUseTag(...args),
}));

vi.mock("@/api/hooks/use-threads", () => ({
  useThreads: (...args: unknown[]) => mockUseThreads(...args),
}));

vi.mock("@/components/thread/category-tabs", () => ({
  CategoryTabs: () => <div>分类筛选</div>,
}));

vi.mock("@/components/thread/thread-filters", () => ({
  ThreadFilters: () => <div>帖子筛选</div>,
}));

vi.mock("@/components/thread/thread-list", () => ({
  ThreadList: ({ threads }: { threads: Array<{ title: string }> }) => (
    <div>{threads.map((thread) => thread.title).join(",")}</div>
  ),
}));

import TagThreadsPage from "@/app/tags/[id]/page";

const threadsQuery = {
  data: { pages: [{ data: [{ id: "t1", title: "标签下的帖子" }] }] },
  hasNextPage: false,
  isFetchingNextPage: false,
  isLoading: false,
  error: null,
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
};

describe("标签主题帖页", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTag.mockReturnValue({
      data: { id: "cms7rnyij000z7qdyg6zbge8e", name: "无限流", color: null },
      isLoading: false,
      error: null,
    });
    mockUseThreads.mockReturnValue(threadsQuery);
  });

  test("展示标签名称并按稳定标签 ID 查询主题帖", () => {
    render(<TagThreadsPage />);

    expect(
      screen.getByRole("heading", { name: "#无限流" }),
    ).toBeInTheDocument();
    expect(screen.getByText("标签下的帖子")).toBeInTheDocument();
    expect(mockUseTag).toHaveBeenCalledWith("cms7rnyij000z7qdyg6zbge8e");
    expect(mockUseThreads).toHaveBeenCalledWith({
      tagId: "cms7rnyij000z7qdyg6zbge8e",
      category: undefined,
      sort: "recommended",
      status: undefined,
    });
  });

  test("标签不存在时显示明确空状态", () => {
    mockUseTag.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: {},
    });

    render(<TagThreadsPage />);

    expect(screen.getByText("标签不存在")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回发现" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
