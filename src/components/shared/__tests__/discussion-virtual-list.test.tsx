import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { DiscussionVirtualList } from "../discussion-virtual-list";
const mock = vi.hoisted(() => ({ scroll: vi.fn(), start: 0, options: {} as Record<string, unknown>, reveal: vi.fn(), refresh: vi.fn(), dispose: vi.fn() }));
vi.mock("@/lib/discussion-target-reveal", () => ({ getDiscussionReadingTop: () => 24, startDiscussionTargetReveal: (...args: unknown[]) => { mock.reveal(...args); return { refresh: mock.refresh, dispose: mock.dispose }; } }));
vi.mock("@tanstack/react-virtual", () => ({
  defaultRangeExtractor: ({ startIndex, endIndex }: { startIndex: number; endIndex: number }) => Array.from({ length: endIndex - startIndex + 1 }, (_, index) => index + startIndex),
  useWindowVirtualizer: (options: { count: number; rangeExtractor: (range: object) => number[]; getItemKey: (index: number) => string }) => {
    mock.options = options;
    return {
      itemSizeCache: new Map(),
      getVirtualItems: () => options.count ? options.rangeExtractor({ startIndex: mock.start, endIndex: Math.min(mock.start + 7, options.count - 1) }).map((index) => ({ index, key: options.getItemKey(index), start: index * 100, end: (index + 1) * 100 })) : [],
      getTotalSize: () => options.count * 100,
      getOffsetForIndex: (index: number) => [index * 100],
      scrollToOffset: mock.scroll,
      measureElement: vi.fn(),
    };
  },
}));
afterEach(() => { cleanup(); mock.scroll.mockClear(); mock.reveal.mockClear(); mock.refresh.mockClear(); vi.restoreAllMocks(); mock.start = 0; });
const numberOf = (item: { number: number }) => item.number;
const renderItem = (item: { id: string }) => <div id={`post-${item.id}`}>{item.id}</div>;
const items = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `p-${index}`, number: index + 1 }));

describe("讨论动态窗口", () => {
  test.each([100, 1200])("前置内容移除只保持真实可见条目（原top=%s）", async (top) => {
    let currentTop = top;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return new DOMRect(0, this.dataset.discussionItem || this.id.startsWith("post-") ? currentTop : 0, 500, 100);
    });
    const list = items(8); const onPosition = vi.fn();
    const { rerender } = render(<DiscussionVirtualList items={list} numberOf={numberOf} renderItem={renderItem} leadingContentKey="pin" onPosition={onPosition} />);
    await waitFor(() => expect(onPosition).toHaveBeenCalled());
    currentTop -= 150;
    rerender(<DiscussionVirtualList items={list} numberOf={numberOf} renderItem={renderItem} leadingContentKey="" onPosition={onPosition} />);
    if (top === 100) {
      expect(mock.reveal).toHaveBeenCalledWith("post-p-0", { viewportTop: 100 });
      expect(mock.refresh).toHaveBeenCalled();
    } else expect(mock.reveal).not.toHaveBeenCalled();
    expect(mock.scroll).not.toHaveBeenCalled();
  });
  test.each([false, true])("普通内容高度不吸附，显式目标优先=%s", async (explicitTarget) => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 100, 500, 100));
    const list = items(8); const onPosition = vi.fn();
    const { rerender } = render(<DiscussionVirtualList items={list} numberOf={numberOf} renderItem={renderItem} leadingContentKey="pin" onPosition={onPosition} />);
    await waitFor(() => expect(onPosition).toHaveBeenCalled());
    rerender(<DiscussionVirtualList items={list} numberOf={numberOf} renderItem={renderItem} leadingContentKey={explicitTarget ? "" : "pin"} targetId={explicitTarget ? "p-4" : undefined} onPosition={onPosition} />);
    expect(mock.reveal).not.toHaveBeenCalled();
    if (explicitTarget) expect(mock.scroll).toHaveBeenCalledWith(400);
    else expect(mock.scroll).not.toHaveBeenCalled();
  });
  test.each([1000, 5000, 10000])("%s条只挂载可见范围，不累积正文 DOM", (count) => {
    const { container } = render(<DiscussionVirtualList items={items(count)} numberOf={numberOf} renderItem={renderItem} />);
    expect(container.querySelectorAll("[data-discussion-item]")).toHaveLength(8);
    expect(mock.options.overscan).toBe(4);
  });
  test("目标和正在编辑条目保留，分页不会重复吸回目标", () => {
    const list = items(100);
    const { container, rerender } = render(<DiscussionVirtualList items={list} numberOf={numberOf} renderItem={renderItem} targetId="p-80" preserveId="p-90" />);
    expect(container.querySelector("#post-p-80")).toBeTruthy();
    expect(container.querySelector("#post-p-90")).toBeTruthy();
    expect(mock.scroll).toHaveBeenCalledWith(8000);
    mock.scroll.mockClear();
    rerender(<DiscussionVirtualList items={[...list]} numberOf={numberOf} renderItem={renderItem} targetId="p-80" preserveId="p-90" />);
    expect(mock.scroll).not.toHaveBeenCalled();
  });
  test("靠近后缘时预取一页，处理中不重复请求", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<DiscussionVirtualList items={items(8)} numberOf={numberOf} renderItem={renderItem} hasAfter onAfter={load} fetching />);
    expect(load).not.toHaveBeenCalled();
    rerender(<DiscussionVirtualList items={items(8)} numberOf={numberOf} renderItem={renderItem} hasAfter onAfter={load} />);
    await waitFor(() => expect(load).toHaveBeenCalledOnce());
  });
  test("中段不预取，靠近前缘读取前一页", async () => {
    const before = vi.fn().mockResolvedValue(undefined); const after = vi.fn();
    render(<DiscussionVirtualList items={items(100)} numberOf={numberOf} renderItem={renderItem} hasBefore hasAfter onBefore={before} onAfter={after} />);
    await waitFor(() => expect(before).toHaveBeenCalledOnce());
    expect(after).not.toHaveBeenCalled();
  });
});
