import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

const { mockCard, mockLanes } = vi.hoisted(() => ({ mockCard: vi.fn(), mockLanes: vi.fn() }));

vi.mock("@tanstack/react-virtual", () => ({
  useWindowVirtualizer: ({ count, lanes }: { count: number; lanes: number }) => {
    mockLanes(lanes);
    return {
      getVirtualItems: () => Array.from({ length: count }, (_, index) => ({
        key: `item-${index}`,
        index,
        lane: index % lanes,
        start: index * 390,
      })),
      getTotalSize: () => count * 390,
      measureElement: vi.fn(),
    };
  },
}));
vi.mock("@/components/moment/moment-card", () => ({
  MomentCard: ({ moment }: { moment: { id: string; title: string } }) => {
    mockCard(moment.id);
    return <article>{moment.title}</article>;
  },
}));

import { MomentMasonry } from "@/components/moment/moment-masonry";

const item = (id: string) => ({ id, title: `动态 ${id}` });

describe("MomentMasonry", () => {
  beforeAll(() => {
    class ResizeObserverStub {
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  test("去重并只渲染虚拟项，接近末尾时加载下一页", async () => {
    const onLoadMore = vi.fn();
    render(
      <MomentMasonry
        moments={[item("1"), item("1"), item("2")] as never}
        hasNextPage
        onLoadMore={onLoadMore}
      />,
    );

    expect(screen.getByRole("feed", { name: "动态瀑布流" })).toBeInTheDocument();
    expect(screen.getAllByText(/动态 [12]/)).toHaveLength(2);
    expect(new Set(mockCard.mock.calls.map(([id]) => id))).toEqual(new Set(["1", "2"]));
    await waitFor(() => expect(onLoadMore).toHaveBeenCalled());
  });

  test("分别展示加载、失败、空列表和翻页状态", () => {
    const { rerender } = render(<MomentMasonry moments={[]} isLoading />);
    expect(screen.getByRole("status", { name: "正在加载动态" })).toBeInTheDocument();

    rerender(<MomentMasonry moments={[]} error={new Error("offline")} onRetry={vi.fn()} />);
    expect(screen.getByText("动态加载失败")).toBeInTheDocument();

    rerender(<MomentMasonry moments={[]} emptyTitle="暂无便笺" emptyDescription="来写一条" />);
    expect(screen.getByText("暂无便笺")).toBeInTheDocument();

    rerender(<MomentMasonry moments={[item("1")] as never} isFetchingNextPage hasNextPage />);
    expect(screen.getByRole("status")).toHaveTextContent("正在加载更多");
  });

  test("首屏加载骨架与内容都使用三列", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 648,
      height: 400,
      top: 180,
      left: 396,
      right: 1044,
      bottom: 580,
      x: 396,
      y: 180,
      toJSON: () => ({}),
    });
    const { rerender } = render(<MomentMasonry moments={[]} isLoading />);

    await waitFor(() => {
      const skeleton = screen.getByRole("status", { name: "正在加载动态" });
      expect(skeleton).toHaveClass("grid-cols-3");
      expect(skeleton.children).toHaveLength(6);
    });

    rerender(<MomentMasonry moments={[item("1"), item("2")] as never} />);

    await waitFor(() => expect(mockLanes).toHaveBeenLastCalledWith(3));
  });

  test.each([
    [600, 2],
    [520, 1],
  ])("容器宽度 %ipx 时使用 %i 列", async (width, lanes) => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width,
      height: 400,
      top: 180,
      left: 396,
      right: 396 + width,
      bottom: 580,
      x: 396,
      y: 180,
      toJSON: () => ({}),
    });

    render(<MomentMasonry moments={[item("1"), item("2")] as never} />);

    await waitFor(() => expect(mockLanes).toHaveBeenLastCalledWith(lanes));
  });

  test("资料页预览可隐藏无限列表的翻页状态区", () => {
    render(
      <MomentMasonry
        moments={[item("1"), item("2")] as never}
        showPaginationStatus={false}
      />,
    );

    expect(screen.queryByText("没有更多了")).not.toBeInTheDocument();
    expect(screen.queryByText("正在加载更多")).not.toBeInTheDocument();
  });
});
