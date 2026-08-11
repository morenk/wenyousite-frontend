import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

afterEach(() => cleanup());

describe("EditorMoreMenu", () => {
  test("按语义分组、自动聚焦并支持方向键与选择", async () => {
    const onSelect = vi.fn();
    render(
      <EditorMoreMenu
        position={{ top: 48, left: 24 }}
        items={ITEMS}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    );

    const menu = screen.getByRole("menu", { name: "更多正文格式" });
    expect(menu).toHaveStyle({ top: "48px", left: "24px" });
    expect(within(menu).getByText("文字")).toBeInTheDocument();
    expect(within(menu).getByText("段落")).toBeInTheDocument();
    expect(within(menu).getByText("创作")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "链接" })).toHaveFocus();

    await userEvent.setup().keyboard("{ArrowDown}{End}{Home}");
    expect(screen.getByRole("menuitem", { name: "链接" })).toHaveFocus();
    await userEvent.setup().click(screen.getByRole("menuitem", { name: "引用" }));
    expect(onSelect).toHaveBeenCalledWith("quote", expect.any(Object));
  });

  test("Escape 与菜单外指针都会请求关闭，菜单内操作不会", () => {
    const onClose = vi.fn();
    const trigger = document.createElement("button");
    trigger.dataset.editorTool = "more";
    document.body.appendChild(trigger);
    render(
      <EditorMoreMenu
        position={{ top: 48, left: 24 }}
        items={ITEMS}
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.pointerDown(screen.getByRole("menuitem", { name: "链接" }));
    fireEvent.pointerDown(trigger);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(2);
    trigger.remove();
  });

  test("关闭状态不创建浮层", () => {
    render(
      <EditorMoreMenu
        position={null}
        items={ITEMS}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole("menu")).toBeNull();
  });
});
