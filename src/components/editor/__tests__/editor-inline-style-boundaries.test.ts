import { Schema } from "@milkdown/kit/prose/model";
import { AllSelection, EditorState, NodeSelection, TextSelection, type Transaction } from "@milkdown/kit/prose/state";
import { expect, test } from "vitest";
import { isInlineStyleActive, toggleInlineStyle } from "../editor-inline-code";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" }, paragraph: { content: "inline*", group: "block" },
    text: { group: "inline" }, hardbreak: { inline: true, group: "inline" },
    dice_inline: { inline: true, group: "inline", atom: true }, image: { inline: true, group: "inline", atom: true },
    audio: { group: "block", atom: true },
    code_block: { content: "text*", group: "block", marks: "" },
  },
  marks: { strong: {}, emphasis: {}, strike_through: {}, inlineCode: {}, link: { attrs: { href: {} } } },
});

for (const name of ["strong", "emphasis", "strike_through", "inlineCode"]) {
  test(`${name} 跨文字、空白、换行、链接和原子节点只修改允许的文字`, () => {
    const other = schema.marks[name === "strong" ? "emphasis" : "strong"]!.create();
    const link = schema.marks.link!.create({ href: "https://example.com" });
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [schema.text(" 甲", [schema.marks[name]!.create(), other]), schema.node("dice_inline"),
        schema.node("hardbreak"), schema.text("乙 ", [link, other]), schema.node("image")]),
      schema.node("audio"), schema.node("code_block", null, schema.text("不可格式化")),
    ]);
    let state = EditorState.create({ doc, selection: new AllSelection(doc) });
    const dispatch = (tr: Transaction) => { state = state.apply(tr); };
    expect(isInlineStyleActive(state, name)).toBe(false);
    expect(toggleInlineStyle(name)(state, dispatch)).toBe(true);
    expect(isInlineStyleActive(state, name)).toBe(true);
    state.doc.descendants((node, _pos, parent) => {
      if (node.isText && parent?.type.name === "paragraph") {
        expect(node.marks).toContainEqual(schema.marks[name]!.create());
        expect(node.marks).toContainEqual(other);
        if (node.text === "乙 ") expect(node.marks).toContainEqual(link);
      } else expect(node.marks).toEqual([]);
    });
    expect(toggleInlineStyle(name)(state, dispatch)).toBe(true);
    expect(isInlineStyleActive(state, name)).toBe(false);
    expect(state.doc.textContent).toBe(" 甲乙 不可格式化");
  });
  test(`${name} 仅原子节点或不可格式化文字不产生事务`, () => {
    const doc = schema.node("doc", null, [schema.node("paragraph", null, schema.node("image")), schema.node("audio"), schema.node("code_block", null, schema.text("代码"))]);
    for (const selection of [NodeSelection.create(doc, 1), NodeSelection.create(doc, 3), TextSelection.create(doc, 5, 7)]) {
      const state = EditorState.create({ doc, selection });
      expect(toggleInlineStyle(name)(state, () => { throw new Error("不应修改非文字节点"); })).toBe(false);
    }
  });
}
