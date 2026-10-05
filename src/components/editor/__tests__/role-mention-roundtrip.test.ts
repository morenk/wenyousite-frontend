import { CrepeBuilder } from "@milkdown/crepe/builder";
import { editorViewCtx, editorViewOptionsCtx } from "@milkdown/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import { afterAll, expect, test } from "vitest";
import { createEditorLinkMarkView } from "@/components/shared/internal-reference-editor-dom";
import { markEditorMentionAnchors } from "@/lib/mention";
import { createReaderClipboardPayload } from "@/lib/site-clipboard";
import { editorMentionCaretPlugin } from "../editor-mention-caret";
import { activeMentionQuery, userMentionTransaction } from "../editor-mention-transactions";
import { editorMarkdownPastePlugin } from "../markdown-literal-paste";
import { configureEditorMarkdownSerializer, prepareEditorMarkdown, serializeEditorMarkdown } from "../milkdown-markdown-codec";

afterAll(async () => { await new Promise((resolve) => setTimeout(resolve, 3100)); });
test("实际Milkdown同名角色在粗斜体引用、复制、纯文本投影和站内HTML粘贴中保源", async () => {
  const a = "/users/u1?rpIdentityId=c00000000000000000000000a";
  const b = "/users/u1?rpIdentityId=c00000000000000000000000b";
  const source = "> ***[@同名](" + a + ")*** [@同名](" + b + ") [@账号](/users/u1?identityMode=ACCOUNT)";
  const root = document.createElement("div"); document.body.append(root);
  const crepe = new CrepeBuilder({ root, defaultValue: prepareEditorMarkdown(source) });
  crepe.editor.config(configureEditorMarkdownSerializer).config((ctx) => ctx.update(editorViewOptionsCtx, (options) => ({
    ...options, markViews: { ...options.markViews, link: (mark) => createEditorLinkMarkView(mark) },
  }))).use(editorMarkdownPastePlugin);
  try {
    await crepe.create();
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const initial = serializeEditorMarkdown(ctx, view.state.doc, { markdownContractVersion: 6 });
      expect(initial).toContain("***[@同名](" + a + ")***"); expect(initial).toContain(b); expect(initial).toContain("ACCOUNT");
      expect(view.state.doc.firstChild?.type.name).toBe("blockquote");
      const before = view.state.doc.toJSON();
      markEditorMentionAnchors(view.dom, [a, b].map((sourceHref) => ({
        userId: "u1", label: "同名", sourceHref, displayName: "账号", identityId: null,
      })));
      expect(view.state.doc.toJSON()).toEqual(before);
      const slice = view.state.doc.slice(0, view.state.doc.content.size);
      const plain = view.someProp("clipboardTextSerializer")!(slice, view);
      expect(plain).not.toContain("同名"); expect(plain).toContain("@账号");
      const html = view.someProp("clipboardSerializer")!.serializeFragment(slice.content);
      expect(html.querySelector('a[href="' + a + '"]')?.textContent).toBe("@同名");
      expect(html.querySelector('a[href="' + b + '"]')?.textContent).toBe("@同名");

      const reader = document.createElement("div");
      reader.innerHTML = '<p><a href="/users/u1" data-wenyou-mention-source-href="' + b + '" data-wenyou-mention-source-label="@同名"><strong><em>@账号</em></strong></a></p>';
      const copied = createReaderClipboardPayload(reader);
      expect(copied.text).toBe("@账号"); expect(copied.html).toContain("<strong><em>@同名</em></strong>");
      view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));
      const event = new Event("paste", { cancelable: true }) as ClipboardEvent;
      Object.defineProperty(event, "clipboardData", { value: { files: [], types: ["text/html", "text/plain"],
        getData: (type: string) => type === "text/html" ? copied.html : type === "text/plain" ? copied.text : "" } });
      expect(view.someProp("handleDOMEvents", (events) => events.paste?.(view, event))).toBe(true);
      const saved = serializeEditorMarkdown(ctx, view.state.doc, { markdownContractVersion: 6 });
      expect(saved.split(b)).toHaveLength(3);
      expect(saved).toContain(a);
      expect(saved).not.toContain("[@账号](" + b);
    });
  } finally { await crepe.destroy(); root.remove(); }
});

test.each(["星*号", "*白鸦*", "反`号`", "&amp;"])("实际插入昵称%s的canonical源不转义目标标签", async (nickname) => {
  const href = "/users/u1?rpIdentityId=c00000000000000000000000a";
  const root = document.createElement("div"); document.body.append(root);
  const canonical = "[@"+ nickname + "](" + href + ")";
  const crepe = new CrepeBuilder({ root, defaultValue: canonical });
  crepe.editor.config(configureEditorMarkdownSerializer);
  try {
    await crepe.create();
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      expect(view.state.doc.textContent).toBe("@" + nickname);
      expect(serializeEditorMarkdown(ctx, view.state.doc, { markdownContractVersion: 6 })).toBe(canonical);
      const text = view.state.schema.text("@" + nickname, [view.state.schema.marks.link!.create({ href, title: null })]);
      view.dispatch(view.state.tr.replaceWith(1, view.state.doc.firstChild!.nodeSize - 1, text));
      const saved = serializeEditorMarkdown(ctx, view.state.doc, { markdownContractVersion: 6 });
      expect(saved).toBe("[@" + nickname + "](" + href + ")");
      const before = view.state.doc.toJSON();
      expect(() => serializeEditorMarkdown(ctx, view.state.doc, { markdownContractVersion: 5 })).toThrow("正文已保留");
      expect(view.state.doc.toJSON()).toEqual(before);
    });
  } finally { await crepe.destroy(); root.remove(); }
});


test("实际连续选择A/B/ACCOUNT不重开旧查询或覆盖前一目标", async () => {
  const root = document.createElement("div"); document.body.append(root);
  const crepe = new CrepeBuilder({ root, defaultValue: "" });
  crepe.editor.config(configureEditorMarkdownSerializer);
  const targets = [
    { name: "同名", href: "/users/u1?rpIdentityId=c00000000000000000000000a" },
    { name: "同名", href: "/users/u1?rpIdentityId=c00000000000000000000000b" },
    { name: "账号", href: "/users/u1?identityMode=ACCOUNT" },
  ];
  try {
    await crepe.create();
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      for (const target of targets) {
        view.dispatch(view.state.tr.insertText("@"));
        const range = activeMentionQuery(view.state);
        expect(range?.query).toBe("");
        view.dispatch(userMentionTransaction(view.state, range!, target.name, target.href)!);
        expect(activeMentionQuery(view.state)).toBeNull();
        expect(view.state.storedMarks).toEqual([]);
        expect(view.state.selection.$from.nodeBefore?.marks).toEqual([]);
      }
      expect(view.state.doc.textContent).toBe("@同名 @同名 @账号 ");
      const result = serializeEditorMarkdown(ctx, view.state.doc, { markdownContractVersion: 6 });
      for (const target of targets) expect(result).toContain("[@" + target.name + "](" + target.href + ")");
      expect(view.dom.querySelectorAll("a")).toHaveLength(3);
    });
  } finally { await crepe.destroy(); root.remove(); }
});


test("段尾原子提及的光标装饰不进入正文，输入与组合输入不继承角色链接", async () => {
  const href = "/users/u1?rpIdentityId=c00000000000000000000000a";
  const canonical = "[@同名](" + href + ")";
  const root = document.createElement("div"); document.body.append(root);
  const crepe = new CrepeBuilder({ root, defaultValue: canonical });
  crepe.editor.config(configureEditorMarkdownSerializer).use(editorMentionCaretPlugin);
  try {
    await crepe.create();
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const before = view.state.doc.toJSON();
      expect(view.dom.querySelector("[data-editor-mention-caret]")).toBeInTheDocument();
      expect(serializeEditorMarkdown(ctx, view.state.doc, { markdownContractVersion: 6 })).toBe(canonical);
      view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));
      expect(view.state.doc.toJSON()).toEqual(before);
      expect(view.state.storedMarks).toEqual([]);
      const end = view.state.selection.from;
      expect(view.someProp("handleTextInput", (handler) => handler(view, end, end, " 后续", () => view.state.tr))).toBe(true);
      expect(serializeEditorMarkdown(ctx, view.state.doc, { markdownContractVersion: 6 })).toBe(canonical + " 后续");
      expect(view.state.doc.firstChild?.lastChild?.marks).toEqual([]);
      expect(view.dom.querySelector("[data-editor-mention-caret]")).not.toBeInTheDocument();
      // 原生组合输入使用上述预先清理的storedMarks，不改写已有源标签。
      view.dispatch(view.state.tr.insertText("中文"));
      expect(serializeEditorMarkdown(ctx, view.state.doc, { markdownContractVersion: 6 })).toBe(canonical + " 后续中文");
    });
  } finally { await crepe.destroy(); root.remove(); }
});
