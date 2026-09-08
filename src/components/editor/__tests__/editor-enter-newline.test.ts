import { CrepeBuilder } from "@milkdown/crepe/builder";
import { editorViewCtx, parserCtx } from "@milkdown/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import { afterAll, describe, expect, test } from "vitest";
import {
  configureEditorMarkdownSerializer, createEditorMarkdownBridge,
  editorSoftBreakParser, prepareEditorMarkdown, serializeEditorMarkdown,
} from "../milkdown-markdown-codec";

async function runEditor(source: string, quote: boolean, breaks: number, offset: number) {
  const root = document.createElement("div");
  document.body.append(root);
  const emitted: string[] = [];
  const crepe = new CrepeBuilder({ root, defaultValue: prepareEditorMarkdown(source) });
  crepe.editor.config(configureEditorMarkdownSerializer).use(editorSoftBreakParser)
    .use(createEditorMarkdownBridge({ onChange: (value) => emitted.push(value),
      onError: (error) => { throw error; } }));
  try {
    await crepe.create();
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const insertionOffset = offset;
      let position = -1;
      view.state.doc.descendants((node, offset) => { if (node.isText && node.text === "甲乙") position = offset + insertionOffset; });
      expect(position).toBeGreaterThan(0);
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position)));
      for (let index = 0; index < breaks; index++) {
        const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
        expect(view.someProp("handleKeyDown", (handle) => handle(view, event))).toBe(true);
      }
      const prefix = quote ? "> " : "";
      const text = "甲乙".slice(0, offset) + "\n".repeat(breaks) + "甲乙".slice(offset);
      let expected = text.split("\n").map((line) => prefix + (line || "<br />")).join("\n") + (quote ? "\n\n尾段" : "");
      if (!quote && breaks === 1 && offset === 1) expected = "甲\n\n乙";
      expect(serializeEditorMarkdown(ctx, view.state.doc)).toBe(expected);
      const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(expected));
      expect(serializeEditorMarkdown(ctx, reopened)).toBe(expected);
      expect(emitted.at(-1)).toBe(expected);
    });
  } finally {
    await crepe.destroy();
    root.remove();
  }
}

afterAll(async () => { await new Promise((resolve) => setTimeout(resolve, 3_100)); });
describe("普通回车跨端规则", () => {
  for (const quote of [false, true]) {
    for (const breaks of [1, 2, 3]) {
      for (const offset of [0, 1, 2]) {
        test(`${quote ? "引用" : "正文"} 第 ${offset} 字处连续 ${breaks} 次回车保存并重开`, async () => {
          await runEditor(quote ? "> 甲乙\n\n尾段" : "甲乙", quote, breaks, offset);
        });
      }
    }
  }
});
