import { CrepeBuilder } from "@milkdown/crepe/builder";
import { editorViewCtx, parserCtx } from "@milkdown/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import { afterAll, expect, test } from "vitest";
import fixture from "../../../../contracts/markdown-editor-newline-v1-fixtures.json";
import { configureEditorAlignmentParser, configureEditorAlignmentSchemas, createEditorAlignmentPlugin } from "../editor-alignment";
import { configureEditorMarkdownSerializer, createEditorMarkdownBridge, editorSoftBreakParser, prepareEditorMarkdown, serializeEditorMarkdown } from "../milkdown-markdown-codec";

// Use the same schema, keyboard bridge and serializer as the live editor.
test.each(fixture.editCases)("$id saves the manual boundary and reopens without losing alignment", async (item) => {
  const root = document.createElement("div");
  document.body.append(root);
  const emitted: string[] = [];
  const crepe = new CrepeBuilder({ root, defaultValue: prepareEditorMarkdown(item.markdown) });
  crepe.editor.config(configureEditorAlignmentParser).config(configureEditorAlignmentSchemas)
    .config(configureEditorMarkdownSerializer).use(editorSoftBreakParser)
    .use(createEditorAlignmentPlugin(() => {}))
    .use(createEditorMarkdownBridge({ onChange: (value) => emitted.push(value), onError: (error) => { throw error; } }));
  try {
    await crepe.create();
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      let position = -1;
      view.state.doc.descendants((node, offset) => { if (node.text === item.operation.anchor) position = offset + item.operation.offset; });
      expect(position).toBeGreaterThan(0);
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position))
        .setStoredMarks([view.state.schema.marks.strong!.create(), view.state.schema.marks.emphasis!.create()]));
      for (let index = 0; index < item.operation.enterCount; index++) {
        expect(view.someProp("handleKeyDown", (handle) => handle(view, new KeyboardEvent("keydown", { key: "Enter" })))).toBe(true);
      }
      expect(serializeEditorMarkdown(ctx, view.state.doc)).toBe(item.serialized);
      expect(emitted.at(-1)).toBe(item.serialized);
      const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(item.serialized));
      expect(serializeEditorMarkdown(ctx, reopened)).toBe(item.serialized);
      for (const doc of [view.state.doc, reopened]) {
        const lines: string[] = [], alignments: string[] = [];
        doc.forEach((node) => { lines.push(node.textContent); alignments.push(node.attrs.textAlign || "left"); });
        expect(lines).toEqual(item.lines);
        expect(alignments).toEqual(item.lineAlignments);
      }
      // Typing after Enter keeps inline marks, but never restores prior alignment.
      view.dispatch(view.state.tr.insertText("续"));
      expect(view.state.selection.$from.parent.attrs.textAlign || "left").toBe("left");
      expect(view.state.selection.$from.nodeBefore?.marks.map((mark) => mark.type.name).sort()).toEqual(["emphasis", "strong"]);
      const continued = serializeEditorMarkdown(ctx, view.state.doc);
      expect(serializeEditorMarkdown(ctx, ctx.get(parserCtx)(prepareEditorMarkdown(continued)))).toBe(continued);
    });
  } finally { await crepe.destroy(); root.remove(); }
});

afterAll(async () => { await new Promise((resolve) => setTimeout(resolve, 3_100)); });
