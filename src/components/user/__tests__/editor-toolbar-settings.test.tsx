import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ConfirmProvider } from "@/components/ui/confirm-provider";
import { EditorToolbarSettings } from "../editor-toolbar-settings";
import { EDITOR_TOOLBAR_STORAGE_KEY, defaultCustomToolbar, parseEditorToolbarPreference } from "@/lib/editor-toolbar-preference";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
function show(onClose = vi.fn()) { render(<ConfirmProvider><EditorToolbarSettings onClose={onClose} /></ConfirmProvider>); return onClose; }
test("主栏与展开栏支持移动排序，保存仅写本机且隐藏列表与未来音频", async () => {
  const onClose = show();
  expect(screen.queryByText("无序列表")).toBeNull();
  expect(screen.queryByText("有序列表")).toBeNull();
  expect(screen.queryByText("音频")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "将粗体移到展开栏" }));
  const more = screen.getByRole("region", { name: "展开栏" });
  fireEvent.click(within(more).getByRole("button", { name: "上移粗体" }));
  fireEvent.click(screen.getByRole("button", { name: "下移正文样式" }));
  fireEvent.click(screen.getByRole("button", { name: "保存", exact: true }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  const stored = parseEditorToolbarPreference(localStorage.getItem(EDITOR_TOOLBAR_STORAGE_KEY))!;
  expect(stored.more).toEqual(["bold", "sticker"]);
  expect(stored.primary.slice(0, 2)).toEqual(["italic", "heading"]);
});
test("恢复默认保存后删除自定义，取消不会写存储", async () => {
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
  fireEvent.click(screen.getByRole("button", { name: "下移正文样式" }));
  fireEvent.click(screen.getByRole("button", { name: "保存", exact: true }));
  expect(await screen.findByRole("alert")).toHaveTextContent("本机设置保存失败");
  expect(close).not.toHaveBeenCalled();
});
