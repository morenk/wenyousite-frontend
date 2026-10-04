
import { afterEach, expect, test } from "vitest";
import { Schema } from "@milkdown/kit/prose/model";
import { EditorState } from "@milkdown/kit/prose/state";
import { EditorView } from "@milkdown/kit/prose/view";
import { createEditorLinkMarkView } from "@/components/shared/internal-reference-editor-dom";
import { markEditorMentionAnchors } from "@/lib/mention";
const schema = new Schema({
  nodes: { doc: { content: "paragraph+" }, paragraph: { content: "text*", toDOM: () => ["p", 0] }, text: { inline: true } },
  marks: { link: { attrs: { href: {} }, toDOM: (mark) => ["a", { href: mark.attrs.href }, 0] } },
});
let view: EditorView | undefined;
afterEach(() => { view?.destroy(); document.body.innerHTML = ""; });
test("编辑态只改变显示属性，24emoji原标签、稳定href、文档JSON和编辑后序列化文本均不变", async () => {
  const label = "🌙".repeat(24);
  const host = document.createElement("div"); document.body.append(host);
  const doc = schema.node("doc", null, [schema.node("paragraph", null, schema.text("@" + label, [schema.mark("link", { href: "/users/u1" })]))]);
  const state = EditorState.create({ schema, doc });
  view = new EditorView(host, { state, markViews: { link: (mark) => createEditorLinkMarkView(mark) } });
  const before = view.state.doc.toJSON();
  markEditorMentionAnchors(host, [{ userId: "u1", label, displayName: "小明", identityId: null }]);
  const anchor = host.querySelector("a")!;
  expect(anchor).toHaveAttribute("data-mention-display", "@小明");
  expect(anchor).toHaveAccessibleName("@小明");
  expect(anchor.querySelector("[data-editor-mention-source]")).toHaveTextContent("@" + label);
  expect(view.state.doc.toJSON()).toEqual(before);
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(view.state.doc.toJSON()).toEqual(before);
  view.dispatch(view.state.tr.insertText(" 后续正文", view.state.doc.content.size - 1));
  expect(view.state.doc.textContent).toBe("@" + label + " 后续正文");
  expect(view.state.doc.firstChild?.firstChild?.marks[0]?.attrs.href).toBe("/users/u1");
  markEditorMentionAnchors(host, [{ userId: "u1", label, displayName: label, identityId: "rp1" }]);
  expect(anchor).not.toHaveAttribute("data-mention-display");
  expect(view.state.doc.textContent).toBe("@" + label + " 后续正文");
});
