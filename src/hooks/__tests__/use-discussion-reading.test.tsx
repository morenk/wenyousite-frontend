import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useDiscussionReading } from "../use-discussion-reading";
const info = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { info } }));
afterEach(() => { cleanup(); info.mockClear(); });
const defaults = () => ({ scope: "s1", subject: "楼层" as const, filters: { order: "OLDEST" as const }, locate: vi.fn().mockResolvedValue({ target: { id: "p2800", number: 2800 } }), onFiltersChange: vi.fn(), beforeJump: vi.fn().mockResolvedValue(true), filteredErrorCode: 40999 });

describe("讨论阅读定位", () => {
  test("跳转后返回真实ID、条目偏移与原筛选，不累计历史", async () => {
    const options = defaults();
    const { result } = renderHook(() => useDiscussionReading(options));
    act(() => result.current.onPosition({ id: "p128", number: 128, offset: -76 }));
    await act(() => result.current.jump(2800));
    expect(result.current.targetId).toBe("p2800");
    expect(result.current.current).toBe(128);
    options.locate.mockResolvedValue({ target: { id: "p128", number: 128 } });
    await act(() => result.current.returnToPrevious!());
    expect(options.locate).toHaveBeenLastCalledWith({ postId: "p128" }, { order: "OLDEST" }, expect.any(AbortSignal));
    expect(result.current.targetId).toBe("p128");
    expect(result.current.restoreOffset).toBe(-76);
    expect(result.current.returnToPrevious).toBeUndefined();
  });
  test("目标被作者筛选排除时清筛选并通知", async () => {
    const options = { ...defaults(), filters: { order: "NEWEST" as const, authorId: "author" } };
    options.locate.mockRejectedValueOnce({ code: 40999 }).mockResolvedValueOnce({ target: { id: "p28", number: 28 } });
    const { result, rerender } = renderHook(({ filters }) => useDiscussionReading({ ...options, filters }), { initialProps: { filters: options.filters as { order: "NEWEST"; authorId?: string } } });
    await act(() => result.current.jump(28));
    expect(info).toHaveBeenCalledOnce();
    expect(options.onFiltersChange).toHaveBeenCalledWith({ order: "NEWEST" });
    rerender({ filters: { order: "NEWEST" } });
    expect(result.current.targetId).toBe("p28");
  });
  test("请求错误和编辑阻止都保留原阅读位置", async () => {
    const options = { ...defaults(), filters: { order: "OLDEST" as const, authorId: "author" }, initialTarget: "p1" };
    const { result } = renderHook(() => useDiscussionReading(options));
    expect(result.current.targetId).toBe("p1");
    options.beforeJump.mockResolvedValueOnce(false);
    await act(async () => { await expect(result.current.jump(28)).rejects.toThrow("请先完成当前编辑"); });
    options.locate.mockRejectedValueOnce(new Error("离线"));
    await act(async () => { await expect(result.current.jump(28)).rejects.toThrow("离线"); });
    expect(options.onFiltersChange).not.toHaveBeenCalled();
  });
  test("切换讨论不带走另一串的返回位置", async () => {
    const options = defaults();
    const { result, rerender } = renderHook(({ scope }) => useDiscussionReading({ ...options, scope }), { initialProps: { scope: "s1" } });
    act(() => result.current.onPosition({ id: "p3", number: 3, offset: 0 }));
    rerender({ scope: "s2" });
    await act(() => result.current.jump(28));
    expect(result.current.returnToPrevious).toBeUndefined();
  });
  test("作用域切换后的旧筛选响应不能改新页面筛选或提示", async () => {
    const options = { ...defaults(), filters: { order: "OLDEST" as const, authorId: "author" } };
    let finish!: (value: { target: { id: string; number: number } }) => void;
    options.locate.mockRejectedValueOnce({ code: 40999 }).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const { result, rerender } = renderHook(({ scope }) => useDiscussionReading({ ...options, scope }), { initialProps: { scope: "s1" } });
    let pending!: Promise<void>;
    await act(async () => { pending = result.current.jump(28); await Promise.resolve(); await Promise.resolve(); });
    rerender({ scope: "s2" });
    await act(async () => { finish({ target: { id: "old", number: 28 } }); await pending; });
    expect(options.onFiltersChange).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(result.current.targetId).toBeUndefined();
  });
  test("后发跳转优先，取消信号阻止旧结果发布", async () => {
    const options = defaults(); let finish!: (value: { target: { id: string; number: number } }) => void;
    options.locate.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValueOnce({ target: { id: "new", number: 8 } });
    const { result } = renderHook(() => useDiscussionReading(options));
    let pending!: Promise<void>;
    await act(async () => { pending = result.current.jump(28); await Promise.resolve(); });
    await act(() => result.current.jump(8));
    await act(async () => { finish({ target: { id: "old", number: 28 } }); await pending; });
    expect(result.current.targetId).toBe("new");
    const controller = new AbortController(); controller.abort();
    await act(() => result.current.jump(20, controller.signal));
    expect(result.current.targetId).toBe("new");
  });

  test("返回目标被删除时保留当前阅读窗口和可重试返回点", async () => {
    const options = defaults();
    const { result } = renderHook(() => useDiscussionReading(options));
    act(() => result.current.onPosition({ id: "p128", number: 128, offset: -76 }));
    await act(() => result.current.jump(2800));
    options.locate.mockRejectedValueOnce({ code: 40403, message: "内容不可访问" });
    await act(async () => { await expect(result.current.returnToPrevious!()).rejects.toMatchObject({ code: 40403 }); });
    expect(result.current.targetId).toBe("p2800");
    expect(result.current.returnToPrevious).toBeDefined();
    expect(options.onFiltersChange).not.toHaveBeenCalled();
  });

  test("打开新定位面板会取消返回，旧响应不能切换窗口", async () => {
    const options = defaults();
    const { result } = renderHook(() => useDiscussionReading(options));
    act(() => result.current.onPosition({ id: "p128", number: 128, offset: -76 }));
    await act(() => result.current.jump(2800));
    let finish!: (value: { target: { id: string; number: number } }) => void;
    options.locate.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    let pending!: Promise<void>;
    await act(async () => { pending = result.current.returnToPrevious!(); await Promise.resolve(); });
    act(() => result.current.cancelPending());
    expect(options.locate.mock.calls.at(-1)?.[2].aborted).toBe(true);
    await act(async () => { finish({ target: { id: "p128", number: 128 } }); await pending; });
    expect(result.current.targetId).toBe("p2800");
    expect(result.current.returnToPrevious).toBeDefined();
    expect(options.onFiltersChange).not.toHaveBeenCalled();
  });

  test("返回点在打开面板时固定，不受弹层期间的滚动记录影响", async () => {
    const options = defaults();
    const { result } = renderHook(() => useDiscussionReading(options));
    act(() => result.current.onPosition({ id: "p3", number: 3, offset: 0 }));
    act(() => result.current.cancelPending());
    act(() => result.current.onPosition({ id: "p1", number: 1, offset: 80 }));
    await act(() => result.current.jump(2800));
    options.locate.mockResolvedValue({ target: { id: "p3", number: 3 } });
    await act(() => result.current.returnToPrevious!());
    expect(options.locate).toHaveBeenLastCalledWith({ postId: "p3" }, { order: "OLDEST" }, expect.any(AbortSignal));
  });

  test("打开面板时真实可见条目优先于尚未更新的滚动记录", async () => {
    const options = defaults();
    const { result } = renderHook(() => useDiscussionReading(options));
    act(() => result.current.onPosition({ id: "p1", number: 1, offset: 0 }));
    const node = document.createElement("div");
    node.dataset.discussionItem = "p3"; node.dataset.discussionNumber = "3";
    node.getBoundingClientRect = () => new DOMRect(0, 24, 400, 100);
    document.body.append(node);
    try {
      act(() => result.current.cancelPending());
      await act(() => result.current.jump(2800));
      options.locate.mockResolvedValue({ target: { id: "p3", number: 3 } });
      await act(() => result.current.returnToPrevious!());
      expect(options.locate).toHaveBeenLastCalledWith({ postId: "p3" }, { order: "OLDEST" }, expect.any(AbortSignal));
    } finally { node.remove(); }
  });

});
