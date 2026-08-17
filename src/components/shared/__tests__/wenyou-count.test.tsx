import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { WenyouCount } from "@/components/shared/wenyou-count";

describe("WenyouCount", () => {
  test.each([
    [9_999, "9999"],
    [10_000, "1万"],
    [10_500, "1.1万"],
    [100_000_000, "1亿"],
  ])("格式化 %i 为 %s", (value, visible) => {
    render(<WenyouCount value={value} label="回复" />);
    const count = screen.getByText(visible);
    expect(count).toHaveAttribute("aria-label", `回复 ${new Intl.NumberFormat("zh-CN").format(value)}`);
    expect(count).toHaveAttribute("title", new Intl.NumberFormat("zh-CN").format(value));
  });
});
