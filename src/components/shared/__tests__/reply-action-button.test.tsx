import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ReplyActionButton } from "@/components/shared/reply-action-button";

afterEach(cleanup);

describe("ReplyActionButton", () => {
  test("纯图标形态使用 Foundation 回复语义并由按钮提供可访问名称", () => {
    const onClick = vi.fn();
    render(<ReplyActionButton onClick={onClick} />);

    const button = screen.getByRole("button", { name: "回复" });
    const icon = button.querySelector("svg");
    expect(button).toHaveClass("size-8");
    expect(button).not.toHaveTextContent("回复");
    expect(icon).toHaveAttribute("data-icon-semantic", "action.reply");
    expect(icon).toHaveAttribute("data-icon-glyph", "reply");
    expect(icon).toHaveAttribute("aria-hidden", "true");

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  test("文字形态由可见标签提供名称并保持紧凑尺寸", () => {
    const view = render(
      <ReplyActionButton presentation="labeled" onClick={vi.fn()} />,
    );

    const button = view.getByRole("button", { name: "回复" });
    const icon = button.querySelector("svg");
    expect(button).toHaveClass("h-8");
    expect(button).not.toHaveClass("size-8");
    expect(button).toHaveTextContent("回复");
    expect(button).not.toHaveAttribute("aria-label");
    expect(icon).toHaveAttribute("data-icon-semantic", "action.reply");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});
