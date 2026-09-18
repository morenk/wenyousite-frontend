import { CrepeBuilder } from "@milkdown/crepe/builder";
import { editorViewCtx, parserCtx, serializerCtx } from "@milkdown/core";
import { undo } from "@milkdown/kit/prose/history";
import { afterAll, afterEach, expect, test, vi } from "vitest";
import { configureEditorMarkdownSerializer, createEditorMarkdownBridge } from "../milkdown-markdown-codec";

async function createEditor() {
  const root = document.createElement("div");
  document.body.append(root);
  const onChange = vi.fn();
  const onError = vi.fn();
  const onSyncErrorChange = vi.fn();
  const onReady = vi.fn();
  const crepe = new CrepeBuilder({ root, defaultValue: "**正文**".repeat(100) });
  crepe.editor.config(configureEditorMarkdownSerializer).use(createEditorMarkdownBridge({
    onChange, onError, onSyncErrorChange, onReady,
  }));
  await crepe.create();
  const view = crepe.editor.action((ctx) => ctx.get(editorViewCtx));
  const serializer = vi.fn(crepe.editor.action((ctx) => ctx.get(serializerCtx)));
  crepe.editor.action((ctx) => ctx.set(serializerCtx, serializer));
  const flush = onReady.mock.calls.at(-1)![0] as () => string | null;
  const keydown = (key: string, repeat = true) => {
    view.dom.dispatchEvent(new KeyboardEvent("keydown", { key, repeat, bubbles: true }));
  };
  const removeLast = () => {
    const end = view.state.doc.content.size - 1;
    view.dispatch(view.state.tr.delete(end - 1, end));
  };
  return {
    crepe, view, onChange, onError, onSyncErrorChange, onReady, serializer, flush, keydown, removeLast,
    destroy: async () => { await crepe.destroy(); root.remove(); },
  };
}

afterEach(() => vi.useRealTimers());
afterAll(async () => { await new Promise((resolve) => setTimeout(resolve, 3_100)); });

for (const key of ["Backspace", "Delete"]) {
  test(`${key} 长按时立即删除文字，松键只编码最后状态一次`, async () => {
    const editor = await createEditor();
    try {
      vi.useFakeTimers();
      const original = editor.view.state.doc.textContent;
      editor.keydown(key, false);
      editor.removeLast();
      expect(editor.onChange).toHaveBeenCalledTimes(1);
      editor.serializer.mockClear();
      editor.onChange.mockClear();
      for (let i = 0; i < 20; i++) {
        editor.keydown(key);
        editor.removeLast();
        await vi.advanceTimersByTimeAsync(30);
      }
      expect(editor.view.state.doc.textContent).toBe(original.slice(0, -21));
      expect(editor.serializer).not.toHaveBeenCalled();
      expect(editor.onChange).not.toHaveBeenCalled();
      editor.view.dom.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
      expect(editor.serializer).toHaveBeenCalledTimes(1);
      expect(editor.onChange).toHaveBeenCalledTimes(1);
      expect(editor.flush()).toBe(editor.onChange.mock.calls[0]![0]);
      const count = editor.serializer.mock.calls.length;
      await vi.advanceTimersByTimeAsync(150);
      expect(editor.serializer).toHaveBeenCalledTimes(count);
      expect(undo(editor.view.state, editor.view.dispatch)).toBe(true);
      expect(editor.view.state.doc.textContent).toBe(original);
    } finally { await editor.destroy(); }
  });
}

test.each(["timeout", "blur", "other-key", "composition", "save"])(
  "重复删除后 %s 同步最新正文，不遗留旧定时器",
  async (trigger) => {
    const editor = await createEditor();
    try {
      vi.useFakeTimers();
      editor.keydown("Backspace");
      editor.removeLast();
      expect(editor.onChange).not.toHaveBeenCalled();
      if (trigger === "timeout") await vi.advanceTimersByTimeAsync(120);
      if (trigger === "blur") editor.view.dom.dispatchEvent(new FocusEvent("blur"));
      if (trigger === "other-key") editor.keydown("ArrowLeft", false);
      if (trigger === "composition") editor.view.dom.dispatchEvent(new CompositionEvent("compositionstart"));
      if (trigger === "save") expect(editor.flush()).toBeTruthy();
      expect(editor.serializer).toHaveBeenCalledTimes(1);
      expect(editor.onChange).toHaveBeenCalledTimes(1);
      const markdown = editor.onChange.mock.calls[0]![0] as string;
      const reopened = editor.crepe.editor.action((ctx) => ctx.get(parserCtx)(markdown));
      expect(reopened.textContent).toBe(editor.view.state.doc.textContent);
      await vi.advanceTimersByTimeAsync(150);
      expect(editor.serializer).toHaveBeenCalledTimes(1);
    } finally { await editor.destroy(); }
  },
);

test("延后编码失败时保存返回 null，撤销恢复后清除错误", async () => {
  const editor = await createEditor();
  try {
    vi.useFakeTimers();
    editor.keydown("Backspace");
    const invalid = editor.crepe.editor.action((ctx) => ctx.get(parserCtx)("# 协议外标题"));
    editor.view.dispatch(editor.view.state.tr.replaceWith(0, editor.view.state.doc.content.size, invalid.content));
    expect(editor.onError).not.toHaveBeenCalled();
    expect(editor.flush()).toBeNull();
    expect(editor.onSyncErrorChange).toHaveBeenLastCalledWith(true);
    expect(editor.onChange).not.toHaveBeenCalled();
    editor.keydown("z", false);
    expect(undo(editor.view.state, editor.view.dispatch)).toBe(true);
    expect(editor.onSyncErrorChange).toHaveBeenLastCalledWith(false);
    expect(editor.flush()).not.toBeNull();
  } finally { await editor.destroy(); }
});

test("卸载取消重复删除的待同步任务，不通知旧表单", async () => {
  const editor = await createEditor();
  vi.useFakeTimers();
  editor.keydown("Backspace");
  editor.removeLast();
  await editor.destroy();
  await vi.advanceTimersByTimeAsync(150);
  expect(editor.serializer).not.toHaveBeenCalled();
  expect(editor.onChange).not.toHaveBeenCalled();
  expect(editor.onReady).toHaveBeenLastCalledWith(null);
});
