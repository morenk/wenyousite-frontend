import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  EditorMoreMenu,
  type EditorMoreMenuItem,
} from "@/components/editor/editor-more-menu";

const ITEMS: EditorMoreMenuItem[] = [
  { id: "link", label: "链接", group: "inline" },
  { id: "quote", label: "引用", group: "paragraph" },
  { id: "alignment", label: "段落对齐", group: "paragraph" },
  { id: "dice", label: "骰子", group: "tools" },
];

function createAnchor() {
  const anchor = document.createElement("button");
  anchor.dataset.editorTool = "more";
  anchor.dataset.editorMoreTestAnchor = "true";
  document.body.appendChild(anchor);
  const measure = vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
    x: 280,
    y: 120,
    top: 120,
    right: 320,
    bottom: 152,
    left: 280,
    width: 40,
    height: 32,
    toJSON: () => ({}),
  });
  return { anchor, measure };
}

afterEach(() => {
  cleanup();
  document.querySelectorAll("[data-editor-more-test-anchor]").forEach((anchor) => anchor.remove());
});

describe("EditorMoreMenu", () => {
  test("按语义分组、自动聚焦并支持方向键与选择", async () => {
    const onSelect = vi.fn();
    const { anchor, measure } = createAnchor();
    render(
      <EditorMoreMenu
        anchor={anchor}
        items={ITEMS}
        alignment="left"
        onSelect={onSelect}
        onSelectAlignment={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const menu = screen.getByRole("menu", { name: "更多正文格式" });
    expect(document.querySelector("[data-editor-more-positioner]")).toHaveStyle({
      position: "fixed",
    });
    await waitFor(() => expect(measure).toHaveBeenCalled());
    expect(within(menu).getByRole("group", { name: "文字格式" })).toBeInTheDocument();
    expect(within(menu).getByRole("group", { name: "段落格式" })).toBeInTheDocument();
    expect(within(menu).getByRole("group", { name: "编辑工具" })).toBeInTheDocument();
    expect(within(menu).queryByText("链接")).toBeNull();
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "链接" })).toHaveFocus());

    const user = userEvent.setup();
    await user.hover(screen.getByRole("menuitem", { name: "链接" }));
    expect(await screen.findByText("链接")).toBeVisible();
    await user.unhover(screen.getByRole("menuitem", { name: "链接" }));
    await userEvent.setup().keyboard("{ArrowDown}{End}{Home}");
    expect(screen.getByRole("menuitem", { name: "链接" })).toHaveFocus();
    await userEvent.setup().click(screen.getByRole("menuitem", { name: "引用" }));
    expect(onSelect).toHaveBeenCalledWith("quote", expect.any(Object));
  });

  test("段落区用三枚纯图标显式选择对齐并标记当前项", async () => {
    const onSelectAlignment = vi.fn();
    const { anchor } = createAnchor();
    render(
      <EditorMoreMenu
        anchor={anchor}
        items={ITEMS}
        alignment="center"
        onSelect={vi.fn()}
        onSelectAlignment={onSelectAlignment}
        onClose={vi.fn()}
      />,
    );

    const paragraph = screen.getByRole("group", { name: "段落格式" });
    const alignment = within(paragraph).getByRole("group", { name: "段落对齐" });
    expect(within(alignment).getByRole("menuitemradio", { name: "左对齐" }))
      .toHaveAttribute("aria-checked", "false");
    expect(within(alignment).getByRole("menuitemradio", { name: "居中对齐" }))
      .toHaveAttribute("aria-checked", "true");
    expect(within(alignment).getByRole("menuitemradio", { name: "右对齐" }))
      .toHaveAttribute("aria-checked", "false");
    expect(within(alignment).queryByText(/对齐/u)).toBeNull();

    await userEvent.setup().click(
      within(alignment).getByRole("menuitemradio", { name: "右对齐" }),
    );
    expect(onSelectAlignment).toHaveBeenCalledWith("right");
  });

  test("菜单内与锚点操作不关闭，菜单外指针请求关闭", async () => {
    const onClose = vi.fn();
    const { anchor } = createAnchor();
    const outside = document.createElement("button");
    outside.dataset.editorMoreTestAnchor = "true";
    document.body.appendChild(outside);
    render(
      <EditorMoreMenu
        anchor={anchor}
        items={ITEMS}
        alignment="left"
        onSelect={vi.fn()}
        onSelectAlignment={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.pointerDown(screen.getByRole("menuitem", { name: "链接" }));
    await userEvent.setup().click(anchor);
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.setup().click(outside);
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("Escape 请求关闭菜单", () => {
    const onClose = vi.fn();
    const { anchor } = createAnchor();
    render(
      <EditorMoreMenu
        anchor={anchor}
        items={ITEMS}
        alignment="left"
        onSelect={vi.fn()}
        onSelectAlignment={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("关闭状态不创建浮层", () => {
    render(
      <EditorMoreMenu
        anchor={null}
        items={ITEMS}
        alignment="left"
        onSelect={vi.fn()}
        onSelectAlignment={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole("menu")).toBeNull();
  });
});
