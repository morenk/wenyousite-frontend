import { CrepeBuilder } from "@milkdown/crepe/builder";
import { imageBlock } from "@milkdown/crepe/feature/image-block";
import { editorViewCtx, parserCtx } from "@milkdown/core";
import { afterAll, expect, test } from "vitest";
import { configureEditorAlignmentParser, configureEditorAlignmentSchemas } from "../editor-alignment";
import {
  configureEditorMarkdownSerializer, createEditorMarkdownBridge,
  editorSoftBreakParser, prepareEditorMarkdown, serializeEditorMarkdown,
} from "../milkdown-markdown-codec";

const targets = ["目标正文", "## 目标标题", "### 目标标题", "![图片](https://example.com/boundary.png)"];
const cases = (["center", "right"] as const).flatMap((alignment) => targets.flatMap((target) =>
  ["无空行", "已有空行对照"].map((boundary) => ({
    alignment, target, boundary,
    markdown: `经历：${boundary === "无空行" ? "\n" : "\n\n"}[wenyousite-align-v1-${alignment}]: #\n${target}`,
  })),
));

test.each(cases)("$alignment $target $boundary 真实事务保存并多轮重开保持边界", async (item) => {
  const root = document.createElement("div");
  document.body.append(root);
  const emitted: string[] = [];
  const crepe = new CrepeBuilder({ root, defaultValue: prepareEditorMarkdown(item.markdown) });
  crepe.addFeature(imageBlock);
  crepe.editor
    .config((ctx) => configureEditorAlignmentParser(ctx, { markdownContractVersion: 5 }))
    .config((ctx) => configureEditorAlignmentSchemas(ctx, { markdownContractVersion: 5 }))
    .config(configureEditorMarkdownSerializer)
    .use(editorSoftBreakParser)
    .use(createEditorMarkdownBridge({
      markdownContractVersion: 5,
      onChange: (value) => emitted.push(value),
      onError: (error) => { throw error; },
    }));
  try {
    await crepe.create();
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      expect(view.state.doc.childCount).toBe(2);
      expect(view.state.doc.child(0).textContent).toBe("经历：");
      expect(view.state.doc.child(1).attrs.textAlign).toBe(item.alignment);
      expect(root.textContent).not.toContain("wenyousite-align");
      // 通过真实 ProseMirror 事务编辑前文，验证同步保存没有重新吞并后块。
      view.dispatch(view.state.tr.insertText("续", 2));
      expect(view.state.doc.child(0).textContent).toBe("经续历：");
      const stored = serializeEditorMarkdown(ctx, view.state.doc);
      expect(emitted.at(-1)).toBe(stored);
      const savedDocument = view.state.doc;
      for (let round = 0; round < 3; round++) {
        const reopened = ctx.get(parserCtx)(prepareEditorMarkdown(serializeEditorMarkdown(ctx, view.state.doc)));
        // 回填真实视图后，Milkdown 为标题恢复派生 DOM id，再比较完整文档。
        view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, reopened.content));
        expect(view.state.doc.eq(savedDocument)).toBe(true);
        expect(serializeEditorMarkdown(ctx, view.state.doc)).toBe(stored);
      }
    });
  } finally {
    await crepe.destroy();
    root.remove();
  }
});

afterAll(async () => { await new Promise((resolve) => setTimeout(resolve, 3_100)); });
