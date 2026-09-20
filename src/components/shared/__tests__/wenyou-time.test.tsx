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
    [new Date(2026, 7, 17, 11, 59, 31), "刚刚"],
    [new Date(2026, 7, 17, 11, 30, 0), "30 分钟前"],
    [new Date(2026, 7, 17, 8, 0, 0), "4 小时前"],
    [new Date(2026, 7, 15, 12, 0, 0), "2 天前"],
    [new Date(2026, 7, 14, 12, 0, 0), "08-14 12:00"],
    [new Date(2025, 11, 31, 23, 0, 0), "2025-12-31 23:00"],
  ])("按 Foundation 边界格式化 %s", (value, label) => {
    render(<WenyouTime value={value} reference={reference} />);

    const time = screen.getByText(label);
    expect(time).toHaveAttribute("title", expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/u));
    expect(time).toHaveClass("font-utility", "tabular-nums");
  });

  test("精确模式直接展示本地时刻，保留原始 datetime 且不向 DOM 透传 mode", () => {
    const value = new Date(2026, 7, 17, 11, 59, 31).toISOString();
    render(<WenyouTime mode="exact" value={value} reference={reference} />);

    const time = screen.getByText("2026-08-17 11:59");
    expect(time).toHaveAttribute("title", "2026-08-17 11:59");
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
