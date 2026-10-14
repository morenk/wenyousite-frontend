import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmProvider } from "@/components/ui/confirm-provider";
import { EditorToolbarSettings } from "../editor-toolbar-settings";
import { EDITOR_TOOLBAR_STORAGE_KEY, defaultCustomToolbar, parseEditorToolbarPreference } from "@/lib/editor-toolbar-preference";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
function show(onClose = vi.fn()) { render(<ConfirmProvider><EditorToolbarSettings onClose={onClose} /></ConfirmProvider>); return onClose; }
function tool(zone: "主栏" | "展开栏", name: string) {
  return within(screen.getByRole("toolbar", { name: `${zone}工具` })).getByRole("button", { name, exact: true });
}
test("点选与键盘浏览不改布局或存储，更多固定且对齐保留双图标", async () => {
  show();
  expect(screen.queryByRole("button", { name: "无序列表" })).toBeNull();
  expect(screen.queryByRole("button", { name: "有序列表" })).toBeNull();
  expect(screen.queryByRole("button", { name: "音频" })).toBeNull();
  fireEvent.click(tool("主栏", "粗体"));
  expect(screen.getByRole("group", { name: "调整粗体位置" })).toBeVisible();
  expect(screen.getByRole("button", { name: "保存", exact: true })).toBeDisabled();
  expect(localStorage.getItem(EDITOR_TOOLBAR_STORAGE_KEY)).toBeNull();
  expect(screen.getByRole("img", { name: "更多，固定位置" })).not.toHaveAttribute("draggable");
  expect(tool("主栏", "对齐").querySelectorAll("svg")).toHaveLength(2);
  const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
  tool("主栏", "粗体").focus();
  fireEvent.keyDown(tool("主栏", "粗体"), { key: "ArrowRight" });
  expect(tool("主栏", "斜体")).toHaveFocus();
  expect(screen.getByRole("button", { name: "保存", exact: true })).toBeDisabled();
  expect(scroll).toHaveBeenCalled();
});
test("点选后的连续位置操作支持排序和跨栏，保存仅写本机", async () => {
  const onClose = show();
  fireEvent.click(tool("主栏", "粗体"));
  fireEvent.click(screen.getByRole("button", { name: "将粗体移到展开栏" }));
  expect(tool("展开栏", "粗体")).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "前移粗体" }));
  expect(screen.getByText("粗体已移到展开栏第 1 项")).toHaveAttribute("role", "status");
  fireEvent.click(tool("主栏", "正文样式"));
  fireEvent.click(screen.getByRole("button", { name: "后移正文样式" }));
  fireEvent.click(screen.getByRole("button", { name: "保存", exact: true }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  const stored = parseEditorToolbarPreference(localStorage.getItem(EDITOR_TOOLBAR_STORAGE_KEY))!;
  expect(stored.more).toEqual(["bold", "sticker"]);
  expect(stored.primary.slice(0, 2)).toEqual(["italic", "heading"]);
  expect([...stored.primary, ...stored.more]).not.toContain("more");
});
test("空栏保留落点，键盘操作可跨栏并保留选中工具", async () => {
  const preference = defaultCustomToolbar();
  localStorage.setItem(EDITOR_TOOLBAR_STORAGE_KEY, JSON.stringify({ ...preference, primary: [...preference.primary, ...preference.more], more: [] }));
  show();
  expect(within(screen.getByRole("region", { name: "展开栏" })).getByText("拖到这里")).toBeVisible();
  const user = userEvent.setup();
  await user.click(tool("主栏", "粗体"));
  await user.keyboard("{Enter}");
  screen.getByRole("button", { name: "将粗体移到展开栏" }).focus();
  await user.keyboard("{Enter}");
  expect(tool("展开栏", "粗体")).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "将粗体移到主栏" })).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(tool("主栏", "粗体")).toHaveAttribute("aria-pressed", "true");
});
test("恢复默认保存后删除自定义", async () => {
  const preference = defaultCustomToolbar();
  preference.primary.reverse();
  localStorage.setItem(EDITOR_TOOLBAR_STORAGE_KEY, JSON.stringify(preference));
  const close = show();
  fireEvent.click(screen.getByRole("button", { name: "恢复默认" }));
  fireEvent.click(screen.getByRole("button", { name: "保存", exact: true }));
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(localStorage.getItem(EDITOR_TOOLBAR_STORAGE_KEY)).toBeNull();
});
test("存储失败保留配置弹窗并显示恢复提示", async () => {
  const close = show();
  vi.spyOn(window.localStorage, "setItem").mockImplementation(() => { throw new Error("denied"); });
  fireEvent.click(screen.getByRole("button", { name: "后移正文样式" }));
  fireEvent.click(screen.getByRole("button", { name: "保存", exact: true }));
  expect(await screen.findByRole("alert")).toHaveTextContent("本机设置保存失败");
  expect(close).not.toHaveBeenCalled();
});
