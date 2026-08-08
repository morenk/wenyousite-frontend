import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";

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
  CategoryTabs: ({ selected, onChange }: {
    selected?: string;
    onChange: (value?: string) => void;
  }) => (
    <button type="button" onClick={() => onChange("RPG")}>
      分类:{selected ?? "全部"}
    </button>
  ),
}));

vi.mock("@/components/thread/thread-filters", () => ({
  ThreadFilters: ({ sort, status, onSortChange, onStatusChange }: {
    sort: string;
    status?: string;
    onSortChange: (value: "active") => void;
    onStatusChange: (value: "RECRUITING") => void;
  }) => (
    <div>
      <button type="button" onClick={() => onSortChange("active")}>排序:{sort}</button>
      <button type="button" onClick={() => onStatusChange("RECRUITING")}>
        状态:{status ?? "全部"}
      </button>
    </div>
  ),
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

  function renderPage({
    searchParams = "",
    onUrlUpdate,
  }: {
    searchParams?: string;
    onUrlUpdate?: (event: UrlUpdateEvent) => void;
  } = {}) {
    return render(
      <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate} hasMemory>
        <TagThreadsPage />
      </NuqsTestingAdapter>,
    );
  }

  test("展示标签名称并按稳定标签 ID 查询主题帖", () => {
    renderPage();

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

    renderPage();

    expect(screen.getByText("标签不存在")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回发现" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  test("筛选条件写入 URL 且返回时可从 URL 恢复", async () => {
    const user = userEvent.setup();
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
    renderPage({
      searchParams: "?category=NATION&sort=newest&status=CLOSED",
      onUrlUpdate,
    });

    expect(mockUseThreads).toHaveBeenLastCalledWith(expect.objectContaining({
      category: "NATION",
      sort: "newest",
      status: "CLOSED",
    }));

    await user.click(screen.getByRole("button", { name: "分类:NATION" }));
    await user.click(screen.getByRole("button", { name: "排序:newest" }));
    await user.click(screen.getByRole("button", { name: "状态:CLOSED" }));

    await waitFor(() => expect(onUrlUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      searchParams: new URLSearchParams("category=RPG&sort=active&status=RECRUITING"),
    })));
  });
});
