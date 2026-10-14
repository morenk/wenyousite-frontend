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
