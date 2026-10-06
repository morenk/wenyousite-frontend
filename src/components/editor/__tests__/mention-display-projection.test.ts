
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
test.each(["/users/u1", "/users/u1?identityMode=ACCOUNT", "/users/u1?rpIdentityId=c00000000000000000000000a"])("编辑态只改变显示属性，24emoji原标签与%s稳定源不变", async (href) => {
  const label = "🌙".repeat(24);
  const host = document.createElement("div"); document.body.append(host);
  const doc = schema.node("doc", null, [schema.node("paragraph", null, schema.text("@" + label, [schema.mark("link", { href })]))]);
  const state = EditorState.create({ schema, doc });
  let markCreates = 0;
  let documentChanges = 0;
  view = new EditorView(host, { state,
    markViews: { link: (mark) => { markCreates++; return createEditorLinkMarkView(mark); } },
    dispatchTransaction: (transaction) => { if (transaction.docChanged) documentChanges++; view!.updateState(view!.state.apply(transaction)); },
  });
  const before = view.state.doc.toJSON();
  markEditorMentionAnchors(host, [{ userId: "u1", label, sourceHref: href, displayName: "小明", identityId: null }]);
  const anchor = host.querySelector("a")!;
  expect(anchor).toHaveAttribute("data-mention-display", "@小明");
  const observer = new MutationObserver(() => {});
  observer.observe(host, { attributes: true, childList: true, subtree: true });
  markEditorMentionAnchors(host, [{ userId: "u1", label, sourceHref: href, displayName: "小明", identityId: null }]);
  expect(observer.takeRecords()).toHaveLength(0);
  observer.disconnect();
  expect(anchor).toHaveAccessibleName("@小明");
  expect(anchor.querySelector("[data-editor-mention-source]")).toHaveTextContent("@" + label);
  expect(view.state.doc.toJSON()).toEqual(before);
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(view.state.doc.toJSON()).toEqual(before);
  expect(documentChanges).toBe(0);
  expect(markCreates).toBe(1);
  view.dispatch(view.state.tr.insertText(" 后续正文", view.state.doc.content.size - 1));
  expect(view.state.doc.textContent).toBe("@" + label + " 后续正文");
  expect(view.state.doc.firstChild?.firstChild?.marks[0]?.attrs.href).toBe(href);
  markEditorMentionAnchors(host, [{ userId: "u1", label, sourceHref: href, displayName: label, identityId: "rp1" }]);
  expect(anchor).not.toHaveAttribute("data-mention-display");
  expect(view.state.doc.textContent).toBe("@" + label + " 后续正文");
});


test("同源链接mark刷新不反复触发href观察器", () => {
  const mark = schema.mark("link", { href: "/users/u1?rpIdentityId=c00000000000000000000000a" });
  const markView = createEditorLinkMarkView(mark);
  const observer = new MutationObserver(() => {});
  observer.observe(markView.dom, { attributes: true });
  expect(markView.update?.(mark)).toBe(true);
  expect(observer.takeRecords()).toHaveLength(0);
  observer.disconnect();
});


test("提及mark只忽略自有显示属性，正文和href变更仍交给编辑器", () => {
  const mark = schema.mark("link", { href: "/users/u1?rpIdentityId=c00000000000000000000000a" });
  const markView = createEditorLinkMarkView(mark);
  const mutation = (attributeName: string) => ({ type: "attributes", target: markView.dom, attributeName } as unknown as MutationRecord);
  expect(markView.ignoreMutation?.(mutation("data-mention-display"))).toBe(true);
  expect(markView.ignoreMutation?.(mutation("data-wenyou-mention-source-label"))).toBe(true);
  expect(markView.ignoreMutation?.(mutation("contenteditable"))).toBe(true);
  expect(markView.ignoreMutation?.(mutation("href"))).toBe(false);
  expect(markView.ignoreMutation?.({ type: "characterData", target: markView.contentDOM } as unknown as MutationRecord)).toBe(false);
});
