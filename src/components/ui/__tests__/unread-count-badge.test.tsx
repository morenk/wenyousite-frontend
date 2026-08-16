import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { UnreadCountBadge } from "@/components/ui/unread-count-badge";

afterEach(cleanup);

describe("UnreadCountBadge", () => {
  test("零值隐藏，普通计数保留数字", () => {
    const { rerender } = render(<UnreadCountBadge count={0} />);
    expect(document.querySelector('[data-slot="unread-count"]')).toBeNull();

    rerender(<UnreadCountBadge count={8} />);
    expect(screen.getByText("8")).toHaveAccessibleName("8 条未读");
  });

  test("超过上限按 Foundation 规则显示 99+", () => {
    render(<UnreadCountBadge count={105} />);
    expect(screen.getByText("99+")).toHaveAccessibleName("99+ 条未读");
  });
});
