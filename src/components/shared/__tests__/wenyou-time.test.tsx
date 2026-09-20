import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { WenyouTime } from "@/components/shared/wenyou-time";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WenyouTime", () => {
  const reference = new Date(2026, 7, 17, 12, 0, 0);

  test.each([
    [new Date(reference.getTime() - 59_999), "刚刚"],
    [new Date(reference.getTime() - 60_000), "1 分钟前"],
    [new Date(reference.getTime() - 3_599_999), "59 分钟前"],
    [new Date(reference.getTime() - 3_600_000), "1 小时前"],
    [new Date(reference.getTime() - 86_399_999), "23 小时前"],
    [new Date(reference.getTime() - 86_400_000), "1 天前"],
    [new Date(reference.getTime() - 259_199_999), "2 天前"],
    [new Date(reference.getTime() - 259_200_000), "08-14"],
    [new Date(2025, 11, 31, 23, 0, 0), "2025-12-31"],
    [new Date(2026, 7, 18, 12, 0, 0), "08-18"],
    [new Date(2027, 0, 1, 12, 0, 0), "2027-01-01"],
  ])("普通内容按 Foundation 边界格式化 %s，悬停和读屏仅保留日期", (value, label) => {
    render(<WenyouTime value={value} reference={reference} />);

    const time = screen.getByText(label);
    expect(time).toHaveAttribute("title", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/u));
    expect(time).toHaveAccessibleName(time.getAttribute("title") ?? "");
    expect(time).toHaveClass("font-utility", "tabular-nums");
    expect(time).not.toHaveTextContent(/\d{2}:\d{2}/u);
  });

  test("日期按用户本地午夜边界显示，同时保留原始 UTC 时间戳", () => {
    const value = new Date(2026, 7, 17, 0, 15, 0).toISOString();
    render(<WenyouTime value={value} reference={new Date(2026, 7, 21, 0, 0, 0)} />);
    const time = screen.getByText("08-17");
    expect(time).toHaveAttribute("title", "2026-08-17");
    expect(time).toHaveAccessibleName("2026-08-17");
    expect(time).toHaveAttribute("datetime", value);
  });

  test("精确模式直接展示本地时刻，保留原始 datetime 且不向 DOM 透传 mode", () => {
    const value = new Date(2026, 7, 17, 11, 59, 31).toISOString();
    render(<WenyouTime mode="exact" value={value} reference={reference} />);

    const time = screen.getByText("2026-08-17 11:59");
    expect(time).toHaveAttribute("title", "2026-08-17 11:59");
    expect(time).toHaveAccessibleName("2026-08-17 11:59");
    expect(time).toHaveAttribute("datetime", value);
    expect(time).not.toHaveAttribute("mode");
  });

  test("精确模式不订阅刷新，切换模式会建立并释放共享时钟", () => {
    const setInterval = vi.spyOn(window, "setInterval");
    const clearInterval = vi.spyOn(window, "clearInterval");
    const value = new Date(Date.now() - 60_000);
    const view = render(<WenyouTime mode="exact" value={value} />);

    expect(setInterval).not.toHaveBeenCalled();
    view.rerender(<WenyouTime mode="content" value={value} />);
    expect(setInterval).toHaveBeenCalledTimes(1);
    view.rerender(<WenyouTime mode="exact" value={value} />);
    expect(clearInterval).toHaveBeenCalledTimes(1);
    view.unmount();
    setInterval.mockRestore();
    clearInterval.mockRestore();
  });

  test.each(["content", "exact"] as const)("%s 模式对无效时间保留占位且省略 datetime", (mode) => {
    render(<WenyouTime mode={mode} value="invalid" reference={reference} />);
    const time = screen.getByText("—");
    expect(time).not.toHaveAttribute("datetime");
    expect(time).toHaveAttribute("title", "—");
    expect(time).toHaveAccessibleName("—");
  });

  test("同一页面的时间节点共享一个刷新时钟", () => {
    const setInterval = vi.spyOn(window, "setInterval");
    const view = render(
      <>
        <WenyouTime value={new Date(Date.now() - 60_000)} />
        <WenyouTime value={new Date(Date.now() - 120_000)} />
      </>,
    );

    expect(setInterval).toHaveBeenCalledTimes(1);
    view.unmount();
    setInterval.mockRestore();
  });
});
