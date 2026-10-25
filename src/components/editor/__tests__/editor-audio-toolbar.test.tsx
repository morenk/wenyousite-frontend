import { createRef } from "react";
import { MilkdownProvider } from "@milkdown/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, expect, test, vi } from "vitest";
import { MilkdownEditorHost } from "../milkdown-editor-host";
import type { EditorSubmissionHandle } from "../use-editor-submission";
import { EDITOR_TOOLBAR_STORAGE_KEY, EDITOR_TOOLBAR_TOOLS } from "@/lib/editor-toolbar-preference";

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/api/hooks/use-api-meta", () => ({ useApiMeta: () => ({ data: { audioUpload: { version: 1 } } }) }));
vi.mock("@/lib/audio-draft", () => ({ loadAudioDraft: vi.fn().mockResolvedValue(null), loadAudioProjections: vi.fn().mockResolvedValue([]) }));
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
afterAll(async () => { await new Promise((resolve) => setTimeout(resolve, 3100)); });

function show(userId: string | undefined = "audio-user") {
  const ref = createRef<EditorSubmissionHandle>();
  const result = render(<QueryClientProvider client={new QueryClient()}><MilkdownProvider><MilkdownEditorHost
    initialValue="甲乙" ariaLabel="正文" minHeight={180} maxHeight={300} editorRef={ref}
    audioUserId={userId} audioDraftKey="reply:audio-toolbar" markdownContractVersion={5}
  /></MilkdownProvider></QueryClientProvider>);
  return { ...result, ref };
}

for (const custom of [false, true]) test(`${custom ? "自定义" : "默认"}音频直达支持鼠标、Enter 和空格，取消选择不改正文与选区`, async () => {
  if (custom) localStorage.setItem(EDITOR_TOOLBAR_STORAGE_KEY, JSON.stringify({ version: 1, primary: EDITOR_TOOLBAR_TOOLS.filter((id) => id !== "audio"), more: ["audio"] }));
  const saved = localStorage.getItem(EDITOR_TOOLBAR_STORAGE_KEY);
  const { container, ref } = show();
  const toolbar = await screen.findByRole("toolbar", { name: "正文格式工具栏" });
  const audio = await within(toolbar).findByRole("button", { name: "音频" });
  await waitFor(() => expect(ref.current?.hasPendingUpload?.()).toBe(false));
  expect(audio).toHaveAttribute("tabindex", "0");
  expect(audio).toHaveAttribute("title", "音频");
  expect(within(toolbar).queryByRole("button", { name: "更多" })).toBeNull();
  const chooseFile = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) {
    expect(this.type).toBe("file");
    expect(this.accept).toContain("audio/mpeg");
  });
  const editor = container.querySelector<HTMLElement>(".ProseMirror")!;
  for (const action of ["pointer", "Enter", " "]) {
    editor.focus();
    const text = editor.querySelector("p")!.firstChild!;
    const selection = window.getSelection()!;
    const range = document.createRange(); range.setStart(text, 1); range.collapse(true);
    selection.removeAllRanges(); selection.addRange(range);
    fireEvent(document, new Event("selectionchange"));
    if (action === "pointer") fireEvent.pointerDown(audio);
    else { audio.focus(); fireEvent.keyDown(audio, { key: action }); }
    expect(selection.anchorNode).toBe(text);
    expect(selection.anchorOffset).toBe(1);
    expect(ref.current?.flush()).toBe("甲乙");
  }
  expect(chooseFile).toHaveBeenCalledTimes(3);
  expect(localStorage.getItem(EDITOR_TOOLBAR_STORAGE_KEY)).toBe(saved);
});

test("没有音频用户上下文时不暴露直达入口", async () => {
  // 空字符串与未登录一样，不具备稳定的音频上传目标。
  show("");
  const toolbar = await screen.findByRole("toolbar", { name: "正文格式工具栏" });
  await waitFor(() => expect(toolbar).toHaveAttribute("data-editor-audio-enabled", "false"));
  expect(within(toolbar).queryByRole("button", { name: "音频" })).toBeNull();
  expect(within(toolbar).queryByRole("button", { name: "更多" })).toBeNull();
});

for (const custom of [false, true]) test(`${custom ? "自定义" : "默认"}窄栏打开更多后拉宽，关闭失效托盘并恢复音频直达`, async () => {
  if (custom) localStorage.setItem(EDITOR_TOOLBAR_STORAGE_KEY, JSON.stringify({ version: 1, primary: EDITOR_TOOLBAR_TOOLS.filter((id) => id !== "audio"), more: ["audio"] }));
  show();
  const toolbar = await screen.findByRole("toolbar", { name: "正文格式工具栏" });
  await within(toolbar).findByRole("button", { name: "音频" });
  let width = 200;
  Object.defineProperty(toolbar, "clientWidth", { configurable: true, get: () => width });
  Object.defineProperty(toolbar, "scrollWidth", { configurable: true, get: () => Array.from(toolbar.querySelectorAll("[data-editor-tool]")).filter((item) => !item.closest("[hidden]")).length * 40 });
  fireEvent(window, new Event("resize"));
  const more = await within(toolbar).findByRole("button", { name: "更多" });
  fireEvent.pointerDown(more);
  const menu = await screen.findByRole("dialog", { name: "更多正文格式" });
  expect(within(menu).getAllByRole("button", { name: "音频" })).toHaveLength(1);
  expect(within(toolbar).queryByRole("button", { name: "音频" })).toBeNull();
  width = 2000;
  fireEvent(window, new Event("resize"));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "更多正文格式" })).toBeNull());
  expect(within(toolbar).getByRole("button", { name: "音频" })).toBeVisible();
  expect(within(toolbar).queryByRole("button", { name: "更多" })).toBeNull();
});
