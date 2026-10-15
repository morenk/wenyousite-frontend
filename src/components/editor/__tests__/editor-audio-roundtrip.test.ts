import { readFileSync } from "node:fs";
import MarkdownIt from "markdown-it";
import { afterAll, expect, test } from "vitest";
import { CrepeBuilder } from "@milkdown/crepe/builder";
import { undo } from "@milkdown/kit/prose/history";
import { editorViewCtx } from "@milkdown/core";
import { configureEditorMarkdownSerializer, editorAttentionBoundaryParser, editorBoundaryTextSchema, editorSoftBreakParser, prepareEditorMarkdown, serializeEditorMarkdown } from "../milkdown-markdown-codec";
import { configureEditorAlignmentParser, configureEditorAlignmentSchemas } from "../editor-alignment";
import { hasVisibleMarkdownContent } from "@/lib/markdown";
import { validatePublishable } from "@/lib/validations/thread-create";
import { assessEditorInput } from "@/lib/editor-content-compatibility";
import { createAudioUploadAnchor } from "../editor-audio-anchor";
const fixture = JSON.parse(readFileSync("contracts/markdown-audio-v1-fixtures.json", "utf8")) as { cases: { id: string; markdown: string }[] };
async function createEditor(markdown: string) {
  const root = document.createElement("div"); document.body.append(root);
  const anchor = createAudioUploadAnchor(); const target = document.createElement("div"); target.textContent = "音频上传中"; anchor.setTarget(target);
  const crepe = new CrepeBuilder({ root, defaultValue: prepareEditorMarkdown(markdown, { markdownContractVersion: 5 }) });
  crepe.editor.config((ctx) => configureEditorAlignmentParser(ctx, { markdownContractVersion: 5 }))
    .config((ctx) => configureEditorAlignmentSchemas(ctx, { markdownContractVersion: 5 })).config(configureEditorMarkdownSerializer)
    .use(editorAttentionBoundaryParser).use(editorSoftBreakParser).use(editorBoundaryTextSchema).use(anchor.plugin);
  await crepe.create();
  return { crepe, anchor, root, destroy: async () => { await crepe.destroy(); root.remove(); } };
}
for (const item of fixture.cases) test(`普通链接音频编辑往返 ${item.id}`, async () => {
  const editor = await createEditor(item.markdown);
  try {
    const serialized = editor.crepe.editor.action((ctx) => serializeEditorMarkdown(ctx, ctx.get(editorViewCtx).state.doc, { markdownContractVersion: 5 }));
    if (["list", "escaped"].includes(item.id)) {
      const markdown = new MarkdownIt({ linkify: true });
      // 列表符号与转义定界符可规范化，可见文本/链接与段落语义必须保留。
      expect(markdown.render(serialized)).toBe(markdown.render(item.markdown));
    } else expect(serialized).toBe(item.markdown);
  }
  finally { await editor.destroy(); }
});
test("占位不入Markdown；文档变更映射后插入顶层普通无title链接", async () => {
  const editor = await createEditor("正文");
  try {
    editor.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx); editor.anchor.start(view);
      expect(serializeEditorMarkdown(ctx, ctx.get(editorViewCtx).state.doc, { markdownContractVersion: 5 })).toBe("正文");
      view.dispatch(view.state.tr.insertText("新增", 1));
      editor.anchor.insert(view, "https://bucket.example/audio.mp3");
      expect(serializeEditorMarkdown(ctx, ctx.get(editorViewCtx).state.doc, { markdownContractVersion: 5 })).toBe("新增正文\n\n[音频](https://bucket.example/audio.mp3)");
      expect(editor.root).not.toHaveTextContent("音频上传中");
    });
  } finally { await editor.destroy(); }
});
afterAll(() => { document.body.replaceChildren(); });

test("撤销或删除上传占位锚点后完成结果不能复活正文", async () => {
 const e = await createEditor("正文");
 try {
  e.crepe.editor.action((ctx) => {
   const view = ctx.get(editorViewCtx);
   view.dispatch(view.state.tr.insertText("新增", 1)); e.anchor.start(view);
   undo(view.state, view.dispatch);
   expect(e.anchor.insert(view, "https://bucket.example/a.mp3")).toBe(false);
   e.anchor.start(view); e.anchor.remove(view);
   expect(e.anchor.insert(view, "https://bucket.example/a.mp3")).toBe(false);
  });
 } finally { await e.destroy(); }
});

test("原文件名安全编码为 label，单音频可发布且不被判空", async () => {
 const e = await createEditor("");
 let persisted = "";
 try {
  e.crepe.editor.action((ctx) => {
   const view = ctx.get(editorViewCtx); e.anchor.start(view); e.anchor.insert(view, "https://bucket.example/a.mp3", "雨[夜] *片段*.wav");
   const markdown = serializeEditorMarkdown(ctx, view.state.doc, { markdownContractVersion: 5 }); persisted = markdown;
   expect(new MarkdownIt().render(markdown)).toContain("雨[夜] *片段*.wav</a>");
   expect(hasVisibleMarkdownContent(markdown)).toBe(true); expect(assessEditorInput(markdown, 5).edit).toBe(true);
   expect(validatePublishable({ title: "音频主题", category: "test", visibility: "PUBLIC", content: markdown })).toBeNull();
  });
 } finally { await e.destroy(); }
 const reopened = await createEditor(persisted);
 try { expect(reopened.crepe.editor.action((ctx) => serializeEditorMarkdown(ctx, ctx.get(editorViewCtx).state.doc, { markdownContractVersion: 5 }))).toBe(persisted); }
 finally { await reopened.destroy(); }
});
