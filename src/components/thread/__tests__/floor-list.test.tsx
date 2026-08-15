import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FloorDisplayData, PostData } from "@/api/hooks/use-floors";
import { FloorList } from "@/components/thread/floor-list";

const { mockUseInfiniteScroll } = vi.hoisted(() => ({
  mockUseInfiniteScroll: vi.fn(),
}));

vi.mock("@/hooks/use-infinite-scroll", () => ({
  useInfiniteScroll: (...args: unknown[]) => mockUseInfiniteScroll(...args),
}));

vi.mock("@/components/thread/floor-card", () => ({
  FloorCard: ({ floor, focused }: {
    floor: { id: string };
    focused: boolean;
  }) => (
    <div data-testid="floor" data-focused={focused}>
      {floor.id}
    </div>
  ),
}));

const floors = [{ id: "p1" }, { id: "p2" }] as PostData[];

function renderList(overrides: Partial<React.ComponentProps<typeof FloorList>> = {}) {
  const props: React.ComponentProps<typeof FloorList> = {
    floors,
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    error: null,
    onLoadMore: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
  return { ...render(<FloorList {...props} />), props };
}

beforeEach(() => {
  mockUseInfiniteScroll.mockReturnValue(vi.fn());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FloorList", () => {
  test("加载、错误和空态互斥显示", async () => {
    const user = userEvent.setup();
    const loading = renderList({ isLoading: true });
    expect(loading.container.querySelector(".animate-spin")).toBeInTheDocument();
    loading.unmount();

    const error = renderList({ floors: [], error: new Error("network") });
    expect(screen.getByText("加载失败")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重试" }));
    expect(error.props.onRetry).toHaveBeenCalledOnce();
    error.unmount();

    renderList({ floors: [] });
    expect(screen.getByText("暂无回复")).toBeInTheDocument();
  });

  test("缺失于分页结果的聚焦楼层会置顶且高亮", () => {
    const focused = { id: "focused" } as FloorDisplayData;
    renderList({ focusedFloor: focused });

    const cards = screen.getAllByTestId("floor");
    expect(cards.map((card) => card.textContent)).toEqual(["focused", "p1", "p2"]);
    expect(cards[0]).toHaveAttribute("data-focused", "true");
  });

  test("聚焦楼层已在列表中时不重复插入", () => {
    renderList({ focusedFloor: floors[1] as FloorDisplayData });

    expect(screen.getAllByTestId("floor").map((card) => card.textContent)).toEqual(["p1", "p2"]);
    expect(screen.getAllByTestId("floor")[1]).toHaveAttribute("data-focused", "true");
  });

  test("把分页状态和加载回调交给无限滚动 hook", () => {
    const onLoadMore = vi.fn();
    renderList({ hasNextPage: true, isFetchingNextPage: true, onLoadMore });

    expect(mockUseInfiniteScroll).toHaveBeenCalledWith({
      hasNextPage: true,
      isFetchingNextPage: true,
      onLoadMore,
    });
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    fireEvent.scroll(window);
  });

  test("最后一页不渲染多余的结束占位", () => {
    const { container } = renderList();
    expect(screen.queryByText("没有更多了")).toBeNull();
    expect(container.querySelector('[data-slot="floor-list-sentinel"]')).toBeNull();
  });
});
