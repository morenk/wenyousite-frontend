import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CrepeBuilder } from "@milkdown/crepe/builder";
import { imageBlock } from "@milkdown/crepe/feature/image-block";
import { editorViewCtx, parserCtx } from "@milkdown/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { afterAll, describe, expect, test } from "vitest";
import {
  configureEditorMarkdownSerializer,
  createEditorMarkdownBridge,
  editorAttentionBoundaryParser,
  editorSoftBreakParser,
  prepareEditorMarkdown,
  serializeEditorMarkdown,
} from "@/components/editor/milkdown-markdown-codec";
import {
  configureEditorAlignmentParser,
  configureEditorAlignmentSchemas,
} from "@/components/editor/editor-alignment";
import { findUnsupportedMarkdownFormats } from "@/lib/markdown";

interface EditCase {
  id: string;
  markdown: string;
  operation: {
    anchor: string;
    offset: number;
    text: string;
    marks: Record<string, true | string>;
  };
  serialized: string;
  visibleText: string;
}

const fixture = JSON.parse(readFileSync(resolve(
  process.cwd(), "contracts/markdown-editor-roundtrip-v7-fixtures.json",
), "utf8")) as { editCases: EditCase[]; inlineInsertTexts: string[] };

function anchorIn(doc: ProseNode, anchor: string) {
  const matches: Array<{ node: ProseNode; position: number }> = [];
  doc.descendants((node, position) => {
    if (node.isText && node.text?.includes(anchor)) {
      matches.push({ node, position: position + node.text.indexOf(anchor) });
    }
  });
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

async function withEditor(markdown: string, run: (crepe: CrepeBuilder, emitted: string[]) => void) {
  const root = document.createElement("div");
  document.body.append(root);
  const emitted: string[] = [];
  const crepe = new CrepeBuilder({
    root,
    defaultValue: prepareEditorMarkdown(markdown, { markdownContractVersion: 5 }),
  });
  crepe.addFeature(imageBlock);
  crepe.editor
    .config((ctx) => configureEditorAlignmentParser(ctx, { markdownContractVersion: 5 }))
    .config((ctx) => configureEditorAlignmentSchemas(ctx, { markdownContractVersion: 5 }))
    .config(configureEditorMarkdownSerializer)
    .use(editorAttentionBoundaryParser)
    .use(editorSoftBreakParser)
    .use(createEditorMarkdownBridge({
      markdownContractVersion: 5,
      onChange: (value) => emitted.push(value),
      onError: (error) => { throw error; },
    }));
  try {
    await crepe.create();
    run(crepe, emitted);
  } finally {
    await crepe.destroy();
    root.remove();
  }
}

afterAll(async () => {
  // Milkdown ctx 在销毁后仍会完成内部定时器。
  await new Promise((resolve) => setTimeout(resolve, 3_100));
});

describe("共享 v7 编辑操作契约", () => {
  test.each(fixture.editCases)("$id 实际事务后文字、样式和重开均稳定", async (item) => {
    await withEditor(item.markdown, (crepe, emitted) => crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const anchor = anchorIn(view.state.doc, item.operation.anchor);
      const position = anchor.position + item.operation.offset;
      view.dispatch(view.state.tr
        .setSelection(TextSelection.create(view.state.doc, position))
        .setStoredMarks(anchor.node.marks)
        .insertText(item.operation.text));

      expect(emitted.at(-1)).toBe(item.serialized);
      expect(view.state.doc.textContent).toBe(item.visibleText);
      const reopened = ctx.get(parserCtx)(item.serialized);
      expect(reopened.eq(view.state.doc)).toBe(true);
      expect(serializeEditorMarkdown(ctx, reopened)).toBe(item.serialized);
      expect(findUnsupportedMarkdownFormats(item.serialized)).toEqual([]);

      // 删除刚输入的文字后必须恢复原语义，不能因 operation 分片改变输出。
      view.dispatch(view.state.tr.delete(position, position + item.operation.text.length));
      expect(emitted.at(-1)).toBe(item.markdown);
    }));
  });

  test.each(fixture.editCases.filter((item) => item.operation.offset === 1))(
    "$id 标点、空白、Emoji 和反引号不改变文本或样式",
    async (item) => {
      await withEditor(item.markdown, (crepe) => crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const original = view.state.doc;
        const anchor = anchorIn(original, item.operation.anchor);
        const position = anchor.position + 1;
        for (const value of fixture.inlineInsertTexts) {
          view.dispatch(view.state.tr
            .setSelection(TextSelection.create(view.state.doc, position))
            .setStoredMarks(anchor.node.marks)
            .insertText(value));
          const markdown = serializeEditorMarkdown(ctx, view.state.doc);
          const reopened = ctx.get(parserCtx)(markdown);
          expect(reopened.textContent, value).toBe(`甲${value}乙`);
          expect(reopened.eq(view.state.doc), value).toBe(true);
          expect(serializeEditorMarkdown(ctx, reopened), value).toBe(markdown);
          expect(findUnsupportedMarkdownFormats(markdown), value).toEqual([]);
          view.dispatch(view.state.tr.delete(position, position + value.length));
          expect(view.state.doc.eq(original)).toBe(true);
        }
      }));
    },
  );

  test("引用内编辑粗体只写出一个连续粗体区间", async () => {
    await withEditor("> **甲乙**\n\n尾段", (crepe, emitted) => crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const anchor = anchorIn(view.state.doc, "甲乙");
      view.dispatch(view.state.tr
        .setSelection(TextSelection.create(view.state.doc, anchor.position + 1))
        .setStoredMarks(anchor.node.marks)
        .insertText("新"));
      expect(emitted.at(-1)).toBe("> **甲新乙**\n\n尾段");
      expect(ctx.get(parserCtx)(emitted.at(-1)!).eq(view.state.doc)).toBe(true);
    }));
  });

  test("协议空段紧邻对齐标题和图片经真实解析保留结构", async () => {
    const source = "前文\n<br />\n[wenyousite-align-v1-center]: #\n## 居中标题\n<br />\n[wenyousite-align-v1-right]: #\n![图片](https://cdn.example.com/a.png)\n\n尾段";
    await withEditor(source, (crepe) => crepe.editor.action((ctx) => {
      const doc = ctx.get(editorViewCtx).state.doc;
      expect(doc.textContent).toContain("居中标题");
      const markdown = serializeEditorMarkdown(ctx, doc);
      expect(findUnsupportedMarkdownFormats(markdown)).toEqual([]);
      expect(markdown.match(/<br \/>/g)).toHaveLength(2);
      expect(markdown).toContain("[wenyousite-align-v1-center]: #\n## 居中标题");
      expect(markdown).toMatch(/\[wenyousite-align-v1-right\]: #\n!\[[^\]]*\]\(https:\/\/cdn\.example\.com\/a\.png\)/);
      expect(serializeEditorMarkdown(ctx, ctx.get(parserCtx)(prepareEditorMarkdown(markdown)))).toBe(markdown);
    }));
  });
});


for (const source of ["## 甲", "### 甲", "- 甲", "1. 甲"]) {
  test(`${source} 行末 Enter 保持标题和列表常规行为`, async () => {
    await withEditor(source, (crepe) => crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const position = anchorIn(view.state.doc, "甲").position + 1;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position)));
      expect(view.someProp("handleKeyDown", (handle) => handle(view, new KeyboardEvent("keydown", { key: "Enter" })))).toBe(true);
      expect(view.state.selection.$from.parent.type.name).toBe("paragraph");
      expect(view.state.selection.$from.depth).toBe(source.startsWith("#") ? 1 : 3);
      if (!source.startsWith("#")) {
        expect(view.someProp("handleKeyDown", (handle) => handle(view, new KeyboardEvent("keydown", { key: "Enter" })))).toBe(true);
        expect(view.state.selection.$from.depth).toBe(1);
      }
    }));
  });
}
for (const prefix of ["", "> "]) {
  test(`${prefix || "正文"} Enter 后继续输入保留粗体`, async () => {
    await withEditor(`${prefix}**甲**${prefix ? "\n\n尾段" : ""}`, (crepe) => crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const position = anchorIn(view.state.doc, "甲").position + 1;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position)));
      view.someProp("handleKeyDown", (handle) => handle(view, new KeyboardEvent("keydown", { key: "Enter" })));
      view.dispatch(view.state.tr.insertText("乙"));
      expect(serializeEditorMarkdown(ctx, view.state.doc)).toBe(`${prefix}**甲**${prefix ? "\n" : "\n\n"}${prefix}**乙**${prefix ? "\n\n尾段" : ""}`);
    }));
  });
}
for (const alignment of ["center", "right"]) {
  test(`${alignment} 连续 Enter 保留空白行且新段左对齐`, async () => {
    await withEditor(`[wenyousite-align-v1-${alignment}]: #\n甲`, (crepe) => crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const position = anchorIn(view.state.doc, "甲").position + 1;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position)));
      for (let i = 0; i < 3; i++) view.someProp("handleKeyDown", (handle) => handle(view, new KeyboardEvent("keydown", { key: "Enter" })));
      view.dispatch(view.state.tr.insertText("乙"));
      const expected = `[wenyousite-align-v1-${alignment}]: #\n甲\n<br />\n<br />\n乙`;
      expect(serializeEditorMarkdown(ctx, view.state.doc)).toBe(expected);
      const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(expected));
      expect(serializeEditorMarkdown(ctx, reopened)).toBe(expected);
    }));
  });
}


test("空白草稿连续 Enter 仍能保存与重开", async () => {
  await withEditor("", (crepe) => crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)));
    for (let count = 1; count <= 3; count++) {
      expect(view.someProp("handleKeyDown", (handle) => handle(view, new KeyboardEvent("keydown", { key: "Enter" })))).toBe(true);
      const expected = Array.from({ length: count + 1 }, () => "<br />").join("\n");
      expect(serializeEditorMarkdown(ctx, view.state.doc)).toBe(expected);
      const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(expected));
      expect(serializeEditorMarkdown(ctx, reopened)).toBe(expected);
    }
  }));
});
