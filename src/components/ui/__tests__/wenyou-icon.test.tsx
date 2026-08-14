import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WenyouIcon } from "@/components/ui/wenyou-icon";

describe("WenyouIcon", () => {
  it("按产品语义渲染固定图形并默认隐藏装饰语义", () => {
    const { container } = render(<WenyouIcon id="editor.content-drafts" />);
    const icon = container.querySelector("svg");
    expect(icon).toHaveAttribute("data-icon-semantic", "editor.content-drafts");
    expect(icon).toHaveAttribute("data-icon-glyph", "file-clock");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("允许独立状态图标提供可访问名称", () => {
    render(<WenyouIcon id="status.error" label="加载失败" />);
    expect(screen.getByRole("img", { name: "加载失败" })).toHaveAttribute(
      "data-icon-glyph",
      "circle-alert",
    );
  });
});
