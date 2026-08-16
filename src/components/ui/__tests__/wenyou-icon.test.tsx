import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WenyouIcon } from "@/components/ui/wenyou-icon";

describe("WenyouIcon", () => {
  it("按产品语义渲染固定图形并默认隐藏装饰语义", () => {
    const { container } = render(<WenyouIcon id="editor.content-drafts" />);
    const icon = container.querySelector("svg");
    expect(icon).toHaveAttribute("data-icon-semantic", "editor.content-drafts");
    expect(icon).toHaveAttribute("data-icon-glyph", "file-clock");
    expect(icon).toHaveAttribute("data-icon-variant", "outline");
    expect(icon).toHaveAttribute("fill", "none");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("使用 Foundation 实心变体但不更换语义图形", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { container } = render(<WenyouIcon id="action.subscribe" variant="filled" />);
      const icon = container.querySelector("svg");
      expect(icon).toHaveAttribute("data-icon-semantic", "action.subscribe");
      expect(icon).toHaveAttribute("data-icon-glyph", "bell");
      expect(icon).toHaveAttribute("data-icon-variant", "filled");
      expect(icon).toHaveAttribute("fill", "currentColor");
      expect(consoleError).not.toHaveBeenCalledWith(
        expect.stringContaining("Each child in a list should have a unique \"key\" prop"),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("允许独立状态图标提供可访问名称", () => {
    render(<WenyouIcon id="status.error" label="加载失败" />);
    expect(screen.getByRole("img", { name: "加载失败" })).toHaveAttribute(
      "data-icon-glyph",
      "circle-alert",
    );
  });
});
