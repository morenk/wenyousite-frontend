import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { LevelBadge } from "@/components/shared/level-badge";

describe("LevelBadge", () => {
  test.each([
    [1, "mist"],
    [2, "peach"],
    [4, "rose"],
    [6, "coral"],
    [8, "berry"],
    [10, "berry"],
  ])("等级 %i 使用 %s 色阶", (level, tier) => {
    render(<LevelBadge level={level} />);
    const badge = screen.getByText(`Lv.${level}`);

    expect(badge).toHaveAttribute("data-level-tier", tier);
    expect(badge.getAttribute("style")).toContain(`--element-level-${tier}-surface`);
  });

  test("无效等级不渲染", () => {
    const { container } = render(<LevelBadge level={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
