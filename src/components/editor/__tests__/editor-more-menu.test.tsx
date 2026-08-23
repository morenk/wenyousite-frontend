import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  EditorMoreMenu,
  type EditorMoreMenuItem,
} from "@/components/editor/editor-more-menu";

const ITEMS: EditorMoreMenuItem[] = [
  { id: "link", label: "链接", group: "文字" },
  { id: "quote", label: "引用", group: "段落" },
  { id: "dice", label: "骰子", group: "创作" },
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
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    );

    const menu = screen.getByRole("menu", { name: "更多正文格式" });
    expect(document.querySelector("[data-editor-more-positioner]")).toHaveStyle({
      position: "fixed",
    });
    await waitFor(() => expect(measure).toHaveBeenCalled());
    expect(within(menu).getByText("文字")).toBeInTheDocument();
    expect(within(menu).getByText("段落")).toBeInTheDocument();
    expect(within(menu).getByText("创作")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "链接" })).toHaveFocus());

    await userEvent.setup().keyboard("{ArrowDown}{End}{Home}");
    expect(screen.getByRole("menuitem", { name: "链接" })).toHaveFocus();
    await userEvent.setup().click(screen.getByRole("menuitem", { name: "引用" }));
    expect(onSelect).toHaveBeenCalledWith("quote", expect.any(Object));
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
        onSelect={vi.fn()}
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
        onSelect={vi.fn()}
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
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole("menu")).toBeNull();
  });
});
