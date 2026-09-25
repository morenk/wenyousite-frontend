import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  onStable: undefined as (() => void) | undefined,
  dispose: vi.fn(),
  startReveal: vi.fn(),
}));

vi.mock("@/lib/discussion-target-reveal", () => ({
  startDiscussionTargetReveal: (
    targetId: string,
    options: { onStable?: () => void; holdUntilStable?: boolean },
  ) => {
    mocks.onStable = options.onStable;
    mocks.startReveal(targetId, options);
    return { schedule: vi.fn(), dispose: mocks.dispose };
  },
}));

import { DiscussionTargetMask } from "@/components/thread/discussion-target-mask";

function renderMask(overrides: Partial<React.ComponentProps<typeof DiscussionTargetMask>> = {}) {
  const props: React.ComponentProps<typeof DiscussionTargetMask> = {
    targetId: "target-2",
    subject: "楼层",
    loadedIds: ["floor-1"],
    hasNextPage: true,
    isLoading: false,
    isFetchingNextPage: false,
    error: null,
    onLoadMore: vi.fn(),
    onRetry: vi.fn(),
    onBack: vi.fn(),
    children: <div>真实完整列表</div>,
    ...overrides,
  };
  return { ...render(<DiscussionTargetMask {...props} />), props };
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.onStable = undefined;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("DiscussionTargetMask", () => {
  test("遮罩后逐页查找真实目标，稳定回调前不揭开列表", async () => {
    const view = renderMask();

    expect(screen.getByRole("status", { name: "正在定位目标楼层" })).toBeInTheDocument();
    expect(screen.getByText("真实完整列表").parentElement).toHaveClass("invisible");
    expect(screen.getByText("真实完整列表").parentElement).toHaveAttribute("inert");
    expect(view.props.onLoadMore).toHaveBeenCalledOnce();

    view.rerender(
      <DiscussionTargetMask
        {...view.props}
        loadedIds={["floor-1", "target-2"]}
        hasNextPage={false}
      />,
    );

    expect(mocks.startReveal).toHaveBeenCalledWith(
      "post-target-2",
      expect.objectContaining({ holdUntilStable: true }),
    );
    expect(screen.getByText("真实完整列表").parentElement).toHaveClass("invisible");

    act(() => mocks.onStable?.());
    expect(screen.queryByTestId("discussion-target-mask")).toBeNull();
    expect(screen.getByText("真实完整列表").parentElement).not.toHaveClass("invisible");
  });

  test("揭开后播报定位完成，并在不二次滚动的前提下聚焦真实卡片开头", () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    renderMask({
      loadedIds: ["target-2"],
      hasNextPage: false,
      children: <div id="post-target-2" tabIndex={-1}>真实目标卡片</div>,
    });

    act(() => mocks.onStable?.());
    act(() => vi.advanceTimersByTime(20));

    expect(screen.getByRole("status")).toHaveTextContent("目标楼层已定位");
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(screen.getByText("真实目标卡片"));
  });

  test("分页回调变化或重复渲染时同一页只有一个在途请求", async () => {
    let resolvePage: (() => void) | undefined;
    const firstLoad = vi.fn(() => new Promise<void>((resolve) => {
      resolvePage = resolve;
    }));
    const secondLoad = vi.fn(() => new Promise<void>(() => {}));
    const view = renderMask({ onLoadMore: firstLoad });
    expect(firstLoad).toHaveBeenCalledOnce();

    view.rerender(
      <DiscussionTargetMask {...view.props} onLoadMore={secondLoad} />,
    );
    expect(firstLoad).toHaveBeenCalledOnce();
    expect(secondLoad).not.toHaveBeenCalled();

    await act(async () => resolvePage?.());
    expect(firstLoad).toHaveBeenCalledOnce();
    expect(secondLoad).toHaveBeenCalledOnce();
  });

  test("缓存已含目标时仍等待重新校验和错误恢复，不提前稳定揭开", () => {
    const view = renderMask({
      loadedIds: ["target-2"],
      hasNextPage: false,
      validationPending: true,
    });
    expect(mocks.startReveal).not.toHaveBeenCalled();

    view.rerender(
      <DiscussionTargetMask
        {...view.props}
        loadedIds={["target-2"]}
        hasNextPage={false}
        validationPending={false}
        error={new Error("重新校验失败")}
      />,
    );
    expect(mocks.startReveal).not.toHaveBeenCalled();
    expect(screen.getByText("未能定位目标楼层")).toBeInTheDocument();

    view.rerender(
      <DiscussionTargetMask
        {...view.props}
        loadedIds={["target-2"]}
        hasNextPage={false}
        validationPending={false}
        error={null}
      />,
    );
    expect(mocks.startReveal).toHaveBeenCalledOnce();
  });

  test("遮罩期间阻止用户滚动，五秒慢提示不因进入稳定阶段重置", () => {
    const view = renderMask();
    act(() => vi.advanceTimersByTime(4_900));

    view.rerender(
      <DiscussionTargetMask
        {...view.props}
        loadedIds={["floor-1", "target-2"]}
        hasNextPage={false}
      />,
    );
    const wheel = new WheelEvent("wheel", { cancelable: true });
    window.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);

    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByText("仍在定位，较早的讨论可能需要继续加载。")).toBeInTheDocument();
    const backButton = screen.getByRole("button", { name: "返回上一页" });
    const firstSkeleton = view.container.querySelector('[data-slot="skeleton"]');
    expect(backButton).toBeInTheDocument();
    expect(
      backButton.compareDocumentPosition(firstSkeleton!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("遍历结束仍未找到目标时保留不透明失败态并可重试或返回", async () => {
    const view = renderMask({ hasNextPage: false });

    expect(screen.getByText("未能定位目标楼层")).toBeInTheDocument();
    expect(screen.getByText("真实完整列表").parentElement).toHaveClass("invisible");

    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    await act(async () => Promise.resolve());
    expect(view.props.onRetry).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "返回上一页" }));
    expect(view.props.onBack).toHaveBeenCalledOnce();
  });

  test("没有精确目标时直接呈现普通列表且不启动定位", () => {
    renderMask({ targetId: undefined });

    expect(screen.queryByTestId("discussion-target-mask")).toBeNull();
    expect(screen.getByText("真实完整列表")).toBeVisible();
    expect(mocks.startReveal).not.toHaveBeenCalled();
  });
});
