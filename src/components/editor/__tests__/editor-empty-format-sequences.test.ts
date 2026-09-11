import { CrepeBuilder } from "@milkdown/crepe/builder";
import { editorViewCtx, parserCtx } from "@milkdown/core";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { TextSelection } from "@milkdown/kit/prose/state";
import { afterAll, expect, test } from "vitest";
import { configureEditorAlignmentParser, configureEditorAlignmentSchemas } from "../editor-alignment";
import { applyEditorBlockFormat, type EditorBlockFormat } from "../editor-block-format";
import { withoutAutomaticTrailingParagraph } from "../editor-trailing-paragraph";
import { configureEditorMarkdownSerializer, createEditorMarkdownBridge, editorSoftBreakParser, prepareEditorMarkdown, serializeEditorMarkdown } from "../milkdown-markdown-codec";

type Row = { text: string; format: EditorBlockFormat };
const formats: EditorBlockFormat[] = ["paragraph", "h2", "h3", "quote", "bullet-list", "ordered-list"];
const sourceFor = (format: EditorBlockFormat, text: string) => ({ paragraph: "", h2: "## ", h3: "### ", quote: "> ", "bullet-list": "- ", "ordered-list": "1. " })[format] + text;
const contexts: Array<[EditorBlockFormat, EditorBlockFormat]> = [["paragraph", "paragraph"], ["quote", "ordered-list"], ["ordered-list", "quote"], ["h2", "bullet-list"]];
const scenarios = contexts.flatMap(([before, after]) => [1,2].flatMap(left => [1,2].flatMap(right => formats.flatMap(initial => formats.map(target => ({ id: `${before}-${after}-${left}-${right}-${initial}-${target}`, before, after, left, right, initial, target }))))));

function rows(doc: ProseNode): Row[] {
  const result: Row[] = [];
  const visit = (node: ProseNode, inherited: EditorBlockFormat = "paragraph") => {
    const format: EditorBlockFormat = node.type.name === "blockquote" ? "quote" : node.type.name === "bullet_list" ? "bullet-list" : node.type.name === "ordered_list" ? "ordered-list" : inherited;
    if (node.isTextblock) {
      const lines = [""];
      node.forEach(child => { if (child.type.name === "hardbreak") lines.push(""); else lines[lines.length-1] += child.textContent; });
      for (const text of lines) result.push({ text, format: node.type.name === "heading" ? node.attrs.level === 2 ? "h2" : "h3" : format });
    } else node.forEach(child => visit(child, format));
  };
  visit(withoutAutomaticTrailingParagraph(doc));
  return result;
}

afterAll(async () => { await new Promise(resolve => setTimeout(resolve, 3100)); });

test.each(scenarios)("$id 空活动行切换、续写与回车不受前后文污染", async item => {
  const gap = (n: number) => Array.from({ length: n }, () => "<br />").join("\n");
  const source = [sourceFor(item.before, "前"), gap(item.left), sourceFor(item.initial, "甲"), gap(item.right), sourceFor(item.after, "后")].join("\n\n");
  const expected: Row[] = [{ text: "前", format: item.before }, ...Array.from({ length: item.left }, (): Row => ({ text: "", format: "paragraph" })), { text: "甲", format: item.initial }, ...Array.from({ length: item.right }, (): Row => ({ text: "", format: "paragraph" })), { text: "后", format: item.after }];
  const active = item.left + 1;
  const root = document.createElement("div"); document.body.append(root);
  const errors: unknown[] = [];
  const crepe = new CrepeBuilder({ root, defaultValue: prepareEditorMarkdown(source) });
  crepe.editor.config(ctx => configureEditorAlignmentParser(ctx, { markdownContractVersion: 5 }))
    .config(ctx => configureEditorAlignmentSchemas(ctx, { markdownContractVersion: 5 }))
    .config(configureEditorMarkdownSerializer).use(editorSoftBreakParser)
    .use(createEditorMarkdownBridge({ onChange: () => {}, onError: error => errors.push(error) }));
  try {
    await crepe.create();
    crepe.editor.action(ctx => {
      const view = ctx.get(editorViewCtx);
      const verify = () => {
        expect(rows(view.state.doc)).toEqual(expected);
        expect(errors).toEqual([]);
        const saved = serializeEditorMarkdown(ctx, view.state.doc);
        expect(rows(ctx.get(parserCtx)(prepareEditorMarkdown(saved)))).toEqual(expected);
      };
      verify();
      let position = -1;
      view.state.doc.descendants((node, offset) => { if (node.text === "甲") position = offset; });
      expect(position).toBeGreaterThan(0);
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position)).delete(position, position+1));
      expected[active]!.text = ""; verify();
      applyEditorBlockFormat(ctx, item.target);
      const effective = item.initial === item.target && ["quote", "bullet-list", "ordered-list"].includes(item.target) ? "paragraph" : item.target;
      expected[active]!.format = effective; verify();
      view.dispatch(view.state.tr.insertText("乙")); expected[active]!.text = "乙"; verify();
      view.someProp("handleKeyDown", handle => handle(view, new KeyboardEvent("keydown", { key: "Enter" })));
      const nextFormat = effective === "h2" || effective === "h3" ? "paragraph" : effective;
      expected.splice(active+1, 0, { text: "", format: nextFormat }); verify();
      view.dispatch(view.state.tr.insertText("丙")); expected[active+1]!.text = "丙"; verify();
      const end = view.state.selection.from;
      view.dispatch(view.state.tr.delete(end-1, end)); expected[active+1]!.text = ""; verify();
    });
  } finally { await crepe.destroy(); root.remove(); }
});
