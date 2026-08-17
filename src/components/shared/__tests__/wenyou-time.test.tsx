import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { WenyouTime } from "@/components/shared/wenyou-time";

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
