import { CrepeBuilder } from "@milkdown/crepe/builder";
import { editorViewCtx } from "@milkdown/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import { afterAll, afterEach, expect, test, vi } from "vitest";
import { configureTextColorTestEditor } from "@/test/rich-text/text-color-editor";
import { applyEditorTextColor, editorTextColorTyping } from "../editor-text-color-command";
import { editorTextColorSchema } from "../editor-text-color";
import { createEditorMarkdownBridge } from "../milkdown-markdown-codec";

async function createEditor() {
  const root = document.createElement("div");
  document.body.append(root);
  const onCompositionChange = vi.fn();
  const onChange = vi.fn();
  let flush: (() => string | null) | null = null;
  const crepe = new CrepeBuilder({ root, defaultValue: "原文" });
  crepe.editor.config(configureTextColorTestEditor)
    .use(editorTextColorSchema).use(editorTextColorTyping)
    .use(createEditorMarkdownBridge({
      onCompositionChange, onChange, textColorVersion: 1, markdownContractVersion: 6,
      onReady: (ready) => { flush = ready; },
    }));
  await crepe.create();
  const view = crepe.editor.action((ctx) => ctx.get(editorViewCtx));
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 3)));
  applyEditorTextColor(view, "#D14343");
  const composition = (type: "compositionstart" | "compositionend") => {
    view.dom.dispatchEvent(new CompositionEvent(type, { bubbles: true }));
  };
  const input = (text: string, from = view.state.selection.from, to = view.state.selection.to) => {
    const defaultTransaction = () => view.state.tr.insertText(text, from, to).setMeta("composition", 1);
    if (!view.someProp("handleTextInput", (handler) => handler(view, from, to, text, defaultTransaction))) {
      view.dispatch(defaultTransaction());
    }
  };
  return { view, composition, input, onCompositionChange, onChange, flush: () => flush?.(),
    destroy: async () => { await crepe.destroy(); root.remove(); },
  };
}

afterEach(() => vi.useRealTimers());
afterAll(async () => { await new Promise((resolve) => setTimeout(resolve, 3100)); });

test("先选色再组词不打断原生组合状态，结束后同步且继续保色", async () => {
  const editor = await createEditor();
  try {
    vi.useFakeTimers();
    editor.composition("compositionstart");
    editor.input("ni");
    // storedMarks 会让 ProseMirror 主动 clearComposition；旧实现在此失败。
    expect(editor.view.composing).toBe(true);
    expect(editor.view.state.storedMarks).toBeNull();
    await vi.advanceTimersByTimeAsync(600);
    expect(editor.flush()).toBeNull();
    expect(editor.onChange).not.toHaveBeenCalled();
    editor.input("你", 3, 5);
    expect(editor.view.composing).toBe(true);
    editor.composition("compositionend");
    await vi.advanceTimersByTimeAsync(120);
    expect(editor.onCompositionChange.mock.calls.map(([value]) => value)).toEqual([true, false]);
    expect(editor.flush()).toBe('原文<span data-wenyou-color-v1="#D14343">你</span>');
    editor.view.dispatch(editor.view.state.tr.insertText("好"));
    expect(editor.flush()).toBe('原文<span data-wenyou-color-v1="#D14343">你好</span>');
  } finally { await editor.destroy(); }
});

test("组合仍在进行时不接受改色命令", async () => {
  const editor = await createEditor();
  try {
    editor.composition("compositionstart");
    const before = editor.view.state;
    expect(applyEditorTextColor(editor.view, "#2563EB")).toBe(false);
    expect(editor.view.state).toBe(before);
    expect(editor.view.composing).toBe(true);
  } finally { await editor.destroy(); }
});

test("快速开始下一轮组词时不运行上一轮的格式恢复", async () => {
  const editor = await createEditor();
  try {
    vi.useFakeTimers();
    editor.composition("compositionstart");
    editor.input("你");
    editor.composition("compositionend");
    editor.composition("compositionstart");
    editor.input("hao");
    await vi.advanceTimersByTimeAsync(120);
    expect(editor.view.composing).toBe(true);
    expect(editor.view.state.storedMarks).toBeNull();
    expect(editor.flush()).toBeNull();
    editor.input("好", 4, 7);
    editor.composition("compositionend");
    await vi.advanceTimersByTimeAsync(120);
    expect(editor.flush()).toBe('原文<span data-wenyou-color-v1="#D14343">你好</span>');
  } finally { await editor.destroy(); }
});

test("组合结束后移动光标不恢复旧输入色，卸载取消待执行任务", async () => {
  const editor = await createEditor();
  vi.useFakeTimers();
  editor.composition("compositionstart");
  editor.input("你");
  editor.composition("compositionend");
  editor.view.dispatch(editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, 1)));
  await vi.advanceTimersByTimeAsync(120);
  expect(editor.view.state.storedMarks).toBeNull();
  editor.input("新");
  expect(editor.flush()).toBe('新原文<span data-wenyou-color-v1="#D14343">你</span>');
  applyEditorTextColor(editor.view, "#2563EB");
  editor.composition("compositionstart");
  editor.input("字");
  editor.composition("compositionend");
  const dispatch = vi.spyOn(editor.view, "dispatch");
  await editor.destroy();
  await vi.advanceTimersByTimeAsync(120);
  expect(dispatch).not.toHaveBeenCalled();
});

test("显式默认色组词只清输入范围颜色，保留原文颜色与粗体", async () => {
  const editor = await createEditor();
  try {
    vi.useFakeTimers();
    editor.input("红");
    editor.view.dispatch(editor.view.state.tr.addStoredMark(editor.view.state.schema.marks.strong!.create()));
    applyEditorTextColor(editor.view, null);
    editor.composition("compositionstart");
    editor.input("ni");
    editor.input("你", 4, 6);
    expect(editor.view.composing).toBe(true);
    editor.composition("compositionend");
    await vi.advanceTimersByTimeAsync(120);
    expect(editor.flush()).toBe('原文<span data-wenyou-color-v1="#D14343">红</span>**你**');
  } finally { await editor.destroy(); }
});
