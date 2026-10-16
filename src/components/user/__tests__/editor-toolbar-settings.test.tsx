import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmProvider } from "@/components/ui/confirm-provider";
import { EditorToolbarSettings } from "../editor-toolbar-settings";
import { EDITOR_TOOLBAR_STORAGE_KEY, defaultCustomToolbar, parseEditorToolbarPreference } from "@/lib/editor-toolbar-preference";

const capability = vi.hoisted(() => ({ enabled: false }));
vi.mock("@/api/hooks/use-api-meta", () => ({ useApiMeta: () => ({ data: capability.enabled ? { audioUpload: { version: 1 } } : {} }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => { capability.enabled = false; cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
function show(onClose = vi.fn()) { render(<ConfirmProvider><EditorToolbarSettings onClose={onClose} /></ConfirmProvider>); return onClose; }
function tool(zone: "主栏" | "展开栏", name: string) {
  return within(screen.getByRole("toolbar", { name: `${zone}工具` })).getByRole("button", { name });
}
test("点击图标没有常驻选中态或位置按钮，更多固定且对齐保留双图标", async () => {
  show();
  expect(screen.queryByRole("button", { name: "无序列表" })).toBeNull();
  expect(screen.queryByRole("button", { name: "有序列表" })).toBeNull();
  expect(screen.queryByRole("button", { name: "音频" })).toBeNull();
  fireEvent.click(tool("主栏", "粗体"));
  expect(screen.queryByRole("group", { name: /调整.*位置/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /前移|后移|移到.*栏/ })).toBeNull();
  expect(tool("主栏", "粗体")).not.toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  expect(localStorage.getItem(EDITOR_TOOLBAR_STORAGE_KEY)).toBeNull();
  expect(screen.queryByRole("img", { name: "更多，固定位置" })).toBeNull();
  expect(screen.getByRole("button", { name: "表情包" })).toHaveTextContent("表情");
  expect(screen.queryByText(/拖动图标|拖到这里/)).toBeNull();
  expect(screen.queryByRole("heading", { name: /主栏|展开栏/ })).toBeNull();
  expect(tool("主栏", "对齐").querySelectorAll("svg")).toHaveLength(2);
  tool("主栏", "粗体").focus();
  fireEvent.keyDown(tool("主栏", "粗体"), { key: "ArrowRight" });
  expect(tool("主栏", "斜体")).toHaveFocus();
  expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
});
test("键盘拖放支持排序和跨栏，放下后才修改布局并保存本机", async () => {
  const onClose = show();
  const bold = tool("主栏", "粗体");
  fireEvent.keyDown(bold, { key: " " });
  fireEvent.keyDown(bold, { key: "ArrowDown" });
  fireEvent.keyDown(bold, { key: "Home" });
  expect(tool("主栏", "粗体")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  fireEvent.keyDown(bold, { key: " " });
  expect(tool("展开栏", "粗体")).toBeInTheDocument();
  const heading = tool("主栏", "正文样式");
  fireEvent.keyDown(heading, { key: "Enter" });
  fireEvent.keyDown(heading, { key: "ArrowRight" });
  fireEvent.keyDown(heading, { key: "Enter" });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  const stored = parseEditorToolbarPreference(localStorage.getItem(EDITOR_TOOLBAR_STORAGE_KEY))!;
  expect(stored.more).toEqual(["bold", "sticker", "audio"]);
  expect(stored.primary.slice(0, 2)).toEqual(["italic", "heading"]);
  expect([...stored.primary, ...stored.more]).not.toContain("more");
});
test("键盘可放入空栏，取消拖动保留原布局与弹窗", async () => {
  const preference = defaultCustomToolbar();
  localStorage.setItem(EDITOR_TOOLBAR_STORAGE_KEY, JSON.stringify({ ...preference, primary: [...preference.primary, ...preference.more], more: [] }));
  show();
  expect(within(screen.getByRole("toolbar", { name: "展开栏工具" })).queryAllByRole("button")).toHaveLength(0);
  expect(screen.getByRole("img", { name: "更多，固定位置" })).not.toHaveAttribute("draggable");
  const bold = tool("主栏", "粗体");
  await userEvent.setup().click(bold);
  fireEvent.keyDown(bold, { key: " " });
  fireEvent.keyDown(bold, { key: "ArrowDown" });
  fireEvent.keyDown(window, { key: "Escape" });
  expect(tool("主栏", "粗体")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  expect(screen.getByRole("dialog", { name: "编辑器工具栏" })).toBeVisible();
  fireEvent.keyDown(bold, { key: " " });
  fireEvent.keyDown(bold, { key: "ArrowDown" });
  fireEvent.keyDown(bold, { key: " " });
  await waitFor(() => expect(tool("展开栏", "粗体")).toHaveFocus());
});
test("恢复默认保存后删除自定义", async () => {
  const preference = defaultCustomToolbar();
  preference.primary.reverse();
  localStorage.setItem(EDITOR_TOOLBAR_STORAGE_KEY, JSON.stringify(preference));
  const close = show();
  fireEvent.click(screen.getByRole("button", { name: "恢复默认" }));
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(localStorage.getItem(EDITOR_TOOLBAR_STORAGE_KEY)).toBeNull();
});
test("存储失败保留配置弹窗并显示恢复提示", async () => {
  const close = show();
  // happy-dom 缓存 Storage 的绑定方法；只拒绝本次写入，避免遗留拒绝影响后续用例。
  vi.spyOn(window.localStorage, "setItem").mockImplementationOnce(() => { throw new Error("denied"); });
  const heading = tool("主栏", "正文样式");
  fireEvent.keyDown(heading, { key: " " });
  fireEvent.keyDown(heading, { key: "ArrowRight" });
  fireEvent.keyDown(heading, { key: " " });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("本机设置保存失败");
  expect(close).not.toHaveBeenCalled();
});

test("打开和关闭默认设置不转换偏好，取消拖动保留底部表情", async () => {
  const close = show();
  const bold = tool("主栏", "粗体");
  await userEvent.setup().click(bold);
  fireEvent.keyDown(bold, { key: " " });
  fireEvent.keyDown(bold, { key: "ArrowDown" });
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.getByRole("button", { name: "表情包" })).toHaveTextContent("表情");
  expect(screen.queryByRole("img", { name: "更多，固定位置" })).toBeNull();
  expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(localStorage.getItem(EDITOR_TOOLBAR_STORAGE_KEY)).toBeNull();
  expect(screen.queryByText("放弃未保存修改")).toBeNull();
});

test("有能力时音频默认展开，可拖到主栏；能力关闭后隐藏但保存排序不丢", async () => {
  capability.enabled = true;
  let close = show();
  const audio = tool("展开栏", "音频");
  expect(screen.getByRole("img", { name: "更多，固定位置" })).toBeVisible();
  fireEvent.keyDown(audio, { key: " " }); fireEvent.keyDown(audio, { key: "ArrowUp" }); fireEvent.keyDown(audio, { key: "Home" }); fireEvent.keyDown(audio, { key: " " });
  expect(tool("主栏", "音频")).toBeVisible();
  await waitFor(() => expect(screen.getByRole("button", { name: "保存" })).toBeEnabled());
  await userEvent.setup().click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(close, screen.queryByRole("alert")?.textContent ?? "no alert").toHaveBeenCalled()); cleanup();
  expect(parseEditorToolbarPreference(localStorage.getItem(EDITOR_TOOLBAR_STORAGE_KEY))!.primary[0]).toBe("audio");
  capability.enabled = false; close = show();
  expect(screen.queryByRole("button", { name: "音频" })).toBeNull();
  const bold = tool("主栏", "粗体");
  fireEvent.keyDown(bold, { key: " " }); fireEvent.keyDown(bold, { key: "ArrowDown" }); fireEvent.keyDown(bold, { key: " " });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(parseEditorToolbarPreference(localStorage.getItem(EDITOR_TOOLBAR_STORAGE_KEY))!.primary[0]).toBe("audio");
});
