import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { EditorHeadingMenu } from "../editor-heading-menu";
let anchor: HTMLButtonElement;
afterEach(() => { cleanup(); anchor?.remove(); });
function show(level?: 0 | 2 | 3) {
  anchor = document.createElement("button"); document.body.appendChild(anchor);
  const onSelect = vi.fn(), onClose = vi.fn();
  render(<EditorHeadingMenu anchor={anchor} level={level} onSelect={onSelect} onClose={onClose} />);
  return { onSelect, onClose };
}
test.each([0, 2, 3] as const)("段落分段显示当前 %s；初始只聚焦面板，Tab 后聚焦按钮", async level => {
  const { onSelect } = show(level);
  const menu = screen.getByRole("dialog", { name: "正文样式" });
  const group = within(menu).getByRole("group", { name: "段落样式" });
  expect(within(group).getByRole("button", { pressed: true })).toHaveAccessibleName(level ? `标题 ${level}` : "正文");
  await waitFor(() => expect(menu).toHaveFocus());
  await userEvent.tab();
  expect(screen.getByRole("button", { name: "正文" })).toHaveFocus();
  await userEvent.click(screen.getByRole("button", { name: "标题 3" }));
  expect(onSelect).toHaveBeenCalledExactlyOnceWith(3);
});
test("混合层级不预选；Escape 关闭并将焦点交回入口", () => {
  const { onClose } = show();
  expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledOnce();
  expect(anchor).toHaveFocus();
});
