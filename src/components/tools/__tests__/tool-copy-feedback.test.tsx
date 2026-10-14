import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import * as clipboard from "@/lib/tools/clipboard";
import { TOOL_COPY_FEEDBACK_MS, useToolCopy } from "../tool-copy-feedback";
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
test("复制成功短促显示，连续复制重新计时，卸载清理计时器", async () => {
  vi.useFakeTimers();
  vi.spyOn(clipboard, "copyToolText").mockResolvedValue(true);
  const { result, unmount } = renderHook(useToolCopy);
  await act(() => result.current.copy("first"));
  expect(result.current.message).toBe("已复制");
  act(() => vi.advanceTimersByTime(1400));
  await act(() => result.current.copy("second"));
  act(() => vi.advanceTimersByTime(1400));
  expect(result.current.message).toBe("已复制");
  act(() => vi.advanceTimersByTime(100));
  expect(result.current.message).toBe("");
  await act(() => result.current.copy("third"));
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
test("失败提示不会被旧成功计时器关闭，异常同样显示失败", async () => {
  vi.useFakeTimers();
  const copy = vi.spyOn(clipboard, "copyToolText").mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockRejectedValueOnce(new Error("denied"));
  const { result } = renderHook(useToolCopy);
  await act(() => result.current.copy("first"));
  await act(() => result.current.copy("second"));
  act(() => vi.advanceTimersByTime(TOOL_COPY_FEEDBACK_MS * 2));
  expect(result.current.message).toContain("复制未成功");
  await act(() => result.current.copy("third"));
  expect(copy).toHaveBeenCalledTimes(3);
  expect(result.current.message).toContain("复制未成功");
});
test("较旧或卸载后完成的复制不会覆盖当前反馈", async () => {
  vi.useFakeTimers();
  let resolveOld!: (value: boolean) => void;
  let resolveUnmounted!: (value: boolean) => void;
  vi.spyOn(clipboard, "copyToolText")
    .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
    .mockResolvedValueOnce(false)
    .mockImplementationOnce(() => new Promise((resolve) => { resolveUnmounted = resolve; }));
  const { result, unmount } = renderHook(useToolCopy);
  let old!: Promise<void>;
  act(() => { old = result.current.copy("old"); });
  await act(() => result.current.copy("new"));
  await act(async () => { resolveOld(true); await old; });
  expect(result.current.message).toContain("复制未成功");
  let last!: Promise<void>;
  act(() => { last = result.current.copy("last"); });
  unmount();
  await act(async () => { resolveUnmounted(true); await last; });
  expect(vi.getTimerCount()).toBe(0);
});
