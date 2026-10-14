import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Toolbox } from "../toolbox";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("theme=dark") }));
afterEach(cleanup);

test.each([false, true])("工具目录与Mobile使用相同语义图标，embedded=%s", (embedded) => {
  render(<Toolbox embedded={embedded} />);
  for (const [label, semantic, glyph] of [
    ["文字竖排", "action.sort", "arrow-down-up"],
    ["摩斯编码", "editor.inline-code", "code-2"],
    ["花体字", "editor.italic", "italic"],
    ["起名工具", "identity.member", "user-round"],
  ]) {
    const link = screen.getByRole("link", { name: label });
    const icons = link.querySelectorAll("svg");
    expect(icons[0]).toHaveAttribute("data-icon-semantic", semantic);
    expect(icons[0]).toHaveAttribute("data-icon-glyph", glyph);
    expect(icons[1]).toHaveAttribute("data-icon-semantic", "navigation.next");
    for (const icon of icons) expect(icon).toHaveAttribute("aria-hidden", "true");
  }
});

test("返回与可展开配置保留同一语义和可访问名称", () => {
  render(<Toolbox selected="vertical" embedded />);
  expect(screen.getByRole("link", { name: "全部工具" }).querySelector("svg")).toHaveAttribute("data-icon-semantic", "navigation.back");
  const summary = screen.getByText("列间设置").closest("summary")!;
  expect(summary.querySelector('[data-icon-semantic="navigation.expand"]')).toHaveClass("group-open:hidden");
  expect(summary.querySelector('[data-icon-semantic="navigation.collapse"]')).toHaveClass("hidden", "group-open:block");
});
