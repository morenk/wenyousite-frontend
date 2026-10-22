import { createRef } from "react";
import { MilkdownProvider } from "@milkdown/react";
import { MilkdownEditorHost } from "../milkdown-editor-host";
import type { EditorSubmissionHandle } from "../use-editor-submission";
import { afterAll, afterEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MilkdownEditor } from "../milkdown-editor-core";
import { EDITOR_TOOLBAR_STORAGE_KEY, EDITOR_TOOLBAR_CHANGE_EVENT } from "@/lib/editor-toolbar-preference";
import { useEditorToolbarPreference } from "../use-editor-toolbar-preference";

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/api/hooks/use-save-draft", () => ({ useSaveDraft: () => ({ mutateAsync: vi.fn() }) }));
vi.mock("@/api/hooks/use-stickers", () => ({
  useStickers: () => ({ data: { items: [{ id: "favorite", asset: { id: "11111111-1111-4111-8111-111111111111", url: "https://cdn.example.com/sticker.png", thumbnailUrl: "https://cdn.example.com/sticker.png", animated: false } }], recent: [], pendingImports: [], version: 1, limit: 200 }, isLoading: false, isError: false }),
  useStickerActions: () => ({ refresh: vi.fn(), remove: { isPending: false }, reorder: {}, importMedia: {} }),
}));
afterEach(() => { cleanup(); localStorage.clear(); });
afterAll(async () => { await new Promise((resolve) => setTimeout(resolve, 3100)); });
function show(primary: string[]) {
  localStorage.setItem(EDITOR_TOOLBAR_STORAGE_KEY, JSON.stringify({ version: 1, primary, more: ["heading", "sticker"] }));
  return render(<QueryClientProvider client={new QueryClient()}><MilkdownEditor defaultValue="甲乙" onUploadImage={vi.fn()} /></QueryClientProvider>);
}
async function startAtMiddle(container: HTMLElement) {
  const editor = await waitFor(() => { const node = container.querySelector<HTMLElement>(".ProseMirror")!; expect(node).toBeInTheDocument(); return node; });
  const text = editor.querySelector("p")!.firstChild!;
  const selection = window.getSelection()!;
  const range = document.createRange(); range.setStart(text, 1); range.collapse(true);
  editor.focus(); selection.removeAllRanges(); selection.addRange(range);
  fireEvent(document, new Event("selectionchange"));
  return editor;
}
for (const zone of ["primary", "more"] as const) test(`表情在${zone}只出现一次且仍在正文原光标位置插入`, async () => {
  const { container } = show(zone === "primary" ? ["sticker", "bold"] : ["bold"]);
  const editor = await startAtMiddle(container);
  const toolbar = await screen.findByRole("toolbar", { name: "正文格式工具栏" });
  await waitFor(() => expect(toolbar).toHaveAttribute("data-editor-density", "custom"));
  expect(container.querySelector('[data-slot="milkdown-editor-context-actions"] button')).toBeNull();
  if (zone === "primary") await userEvent.setup().click(within(toolbar).getByRole("button", { name: "表情包" }));
  else {
    fireEvent.pointerDown(within(toolbar).getByRole("button", { name: "更多" }));
    const more = await screen.findByRole("dialog", { name: "更多正文格式" });
    await userEvent.setup().click(within(more).getByRole("button", { name: "表情包" }));
  }
  const picker = await screen.findByRole("dialog", { name: "表情收藏" });
  await userEvent.setup().click(within(picker).getByRole("button", { name: "使用收藏表情" }));
  await waitFor(() => expect(editor.querySelector('[data-type="sticker-inline"]')).toBeInTheDocument());
  const paragraph = editor.querySelector("p")!;
  expect(paragraph.firstChild?.textContent).toBe("甲");
  expect(paragraph.lastChild?.textContent).toBe("乙");
});
test("主栏键盘顺序与DOM排序一致，移到展开的标题仍可操作", async () => {
  const { container } = show(["dice", "bold", "image"]);
  const editor = await startAtMiddle(container);
  const toolbar = await screen.findByRole("toolbar", { name: "正文格式工具栏" });
  await waitFor(() => expect(toolbar).toHaveAttribute("data-editor-density", "custom"));
  const names = within(toolbar).getAllByRole("button").map((button) => button.getAttribute("aria-label"));
  expect(names).toEqual(["骰子", "粗体", "图片", "更多"]);
  const dice = within(toolbar).getByRole("button", { name: "骰子" });
  dice.focus(); fireEvent.keyDown(dice, { key: "ArrowRight" });
  expect(within(toolbar).getByRole("button", { name: "粗体" })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: "End" });
  expect(within(toolbar).getByRole("button", { name: "更多" })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: "Enter" });
  const more = await screen.findByRole("dialog", { name: "更多正文格式" });
  await userEvent.setup().click(within(more).getByRole("button", { name: "正文样式" }));
  const heading = await screen.findByRole("dialog", { name: "正文样式" });
  await userEvent.setup().click(within(heading).getByRole("button", { name: "标题 2" }));
  await waitFor(() => expect(editor.querySelector("h2")).toHaveTextContent("甲乙"));
});
test("同页保存与跨标签页清除会更新已挂载偏好", async () => {
  function Probe() { const preference = useEditorToolbarPreference(); return <output>{preference?.primary.join() ?? "default"}</output>; }
  render(<Probe />);
  act(() => { localStorage.setItem(EDITOR_TOOLBAR_STORAGE_KEY, '{"version":1,"primary":["dice"],"more":[]}'); window.dispatchEvent(new Event(EDITOR_TOOLBAR_CHANGE_EVENT)); });
  expect(screen.getByText("dice")).toBeInTheDocument();
  act(() => { localStorage.clear(); window.dispatchEvent(new StorageEvent("storage", { key: null })); });
  expect(screen.getByText("default")).toBeInTheDocument();
});

test("默认主栏正文样式使用锚点弹层，Escape 恢复触发焦点且不改正文", async () => {
  const { container } = render(<QueryClientProvider client={new QueryClient()}><MilkdownEditor defaultValue="甲乙" /></QueryClientProvider>);
  const editor = await startAtMiddle(container);
  const trigger = await screen.findByRole("button", { name: "切换正文样式" });
  await userEvent.setup().click(trigger);
  const menu = await screen.findByRole("dialog", { name: "正文样式" });
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(within(menu).getAllByRole("button").map((item) => item.textContent)).toEqual(["正文", "H2", "H3"]);
  expect(container.contains(menu)).toBe(false);
  await userEvent.setup().keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "正文样式" })).toBeNull());
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(editor.querySelector("p")).toHaveTextContent("甲乙");
  await userEvent.setup().keyboard("{Enter}");
  const reopened = await screen.findByRole("dialog", { name: "正文样式" });
  await userEvent.setup().click(within(reopened).getByRole("button", { name: "标题 2" }));
  await waitFor(() => expect(editor.querySelector("h2")).toHaveTextContent("甲乙"));
  expect(editor).toHaveFocus();
});


test("标题菜单只修改原选中段落，颜色、粗体和对齐可恢复为正文", async () => {
  const ref = createRef<EditorSubmissionHandle>();
  const { container } = render(<QueryClientProvider client={new QueryClient()}><MilkdownProvider><MilkdownEditorHost
    initialValue={'第一段\n\n[wenyousite-align-v1-center]: #\n<span data-wenyou-color-v1="#3366FF">**彩色🙂中文**</span>'}
    markdownContractVersion={5} textColorVersion={1} editorRef={ref} ariaLabel="正文" minHeight={180} maxHeight={300}
  /></MilkdownProvider></QueryClientProvider>);
  const editor = await waitFor(() => {
    const node = container.querySelector<HTMLElement>(".ProseMirror")!;
    expect(node?.querySelectorAll("p")).toHaveLength(2);
    return node;
  });
  const target = editor.querySelectorAll("p")[1]!;
  editor.focus();
  const range = document.createRange(); range.selectNodeContents(target);
  const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
  fireEvent(document, new Event("selectionchange"));
  const trigger = await screen.findByRole("button", { name: "切换正文样式" });
  await userEvent.setup().click(trigger);
  await userEvent.setup().click(within(await screen.findByRole("dialog", { name: "正文样式" })).getByRole("button", { name: "标题 2" }));
  await waitFor(() => expect(editor.querySelector("h2 strong")).toHaveTextContent("彩色🙂中文"));
  expect(editor.querySelector("h2")).toHaveAttribute("data-wenyou-align", "center");
  expect(editor.querySelector("h2 [data-wenyou-color-v1]")).toHaveAttribute("data-wenyou-color-v1", "#3366FF");
  expect(editor.querySelector("p")).toHaveTextContent("第一段");
  await userEvent.setup().click(trigger);
  await userEvent.setup().click(within(await screen.findByRole("dialog", { name: "正文样式" })).getByRole("button", { name: "正文" }));
  await waitFor(() => expect(editor.querySelector("h2")).toBeNull());
  expect(editor.querySelectorAll("p")[1]).toHaveAttribute("data-wenyou-align", "center");
  expect(ref.current?.flush()).toContain('<span data-wenyou-color-v1="#3366FF">');
  expect(ref.current?.flush()).toContain("**彩色🙂中文**");
});

test("颜色和字体均从T菜单进入，字体直接打开分类样张面板且关闭回正文", async () => {
  const { container } = render(<QueryClientProvider client={new QueryClient()}><MilkdownProvider><MilkdownEditorHost initialValue="甲乙" markdownContractVersion={7} textColorVersion={1} textColorWriteEnabled textFontVersion={2} textFontRenderingEnabled maxHeight={400} minHeight={280} ariaLabel="正文测试" /></MilkdownProvider></QueryClientProvider>);
  const editor = await startAtMiddle(container);
  const toolbar = await screen.findByRole("toolbar", { name: "正文格式工具栏" });
  expect(within(toolbar).queryByRole("button", { name: "字体" })).toBeNull();
  expect(toolbar.querySelector('[data-editor-tool="text-color"]')).toBeNull();
  const user = userEvent.setup();
  await user.click(within(toolbar).getByRole("button", { name: "切换正文样式" }));
  const styles = await screen.findByRole("dialog", { name: "正文样式" });
  expect(within(styles).getByRole("button", { name: "红色" })).toBeVisible();
  await user.click(within(styles).getByRole("button", { name: "字体" }));
  const fonts = await screen.findByRole("dialog", { name: "字体" });
  expect(within(fonts).getAllByRole("tab").map(tab => tab.textContent)).toEqual(["中文", "日文", "英文"]);
  expect(within(fonts).queryByRole("combobox")).toBeNull();
  await user.click(within(fonts).getByRole("button", { name: "关闭字体面板" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(editor).toHaveFocus();
  expect(editor).toHaveTextContent("甲乙");
});

test("原生组合输入尚未提交时T入口保留焦点，提交后可正常打开", async () => {
  const { container } = render(<QueryClientProvider client={new QueryClient()}><MilkdownEditor defaultValue="甲乙" /></QueryClientProvider>);
  const editor = await startAtMiddle(container);
  const trigger = await screen.findByRole("button", { name: "切换正文样式" });
  fireEvent.compositionStart(editor, { data: "候选" });
  await userEvent.setup().click(trigger);
  expect(screen.queryByRole("dialog", { name: "正文样式" })).toBeNull();
  expect(editor).toHaveFocus();
  expect(editor).toHaveTextContent("甲乙");
  fireEvent.compositionEnd(editor, { data: "" });
  await userEvent.setup().click(trigger);
  expect(await screen.findByRole("dialog", { name: "正文样式" })).toBeVisible();
});
