import { renderHook } from "@testing-library/react";
import { CrepeBuilder } from "@milkdown/crepe/builder";
import { imageBlock } from "@milkdown/crepe/feature/image-block";
import { editorViewCtx } from "@milkdown/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import { afterAll, expect, test } from "vitest";
import { useEditorMediaDisplay } from "../use-editor-media-display";

const source = "https://cdn.example.com/source.gif";
const second = "https://cdn.example.com/second.gif";
const display = { url: "https://cdn.example.com/full.webp", contentType: "image/webp" as const, width: 20, height: 20, bytes: 100, animated: true, frameCount: 2, durationMs: 200, loopCount: 0 };

async function createEditor() {
  const projection = renderHook(() => useEditorMediaDisplay([{ sourceUrl: source, display }], { current: null }, true));
  const api = projection.result.current;
  const root = document.createElement("div");
  document.body.append(root);
  const crepe = new CrepeBuilder({ root, defaultValue: `正文\n\n![图一](${source})\n\n![图二](${second})` });
  crepe.addFeature(imageBlock, { proxyDomURL: api.resolve });
  crepe.editor.use(api.plugin);
  await crepe.create();
  const view = crepe.editor.action((ctx) => ctx.get(editorViewCtx));
  const media = () => {
    const values: Array<{ position: number; source: string; display: string | null }> = [];
    view.state.doc.descendants((node, position) => {
      if (node.type.name !== "image-block") return;
      values.push({ position, source: node.attrs.src, display: (view.nodeDOM(position) as HTMLElement).getAttribute("data-display-url") });
    });
    return values;
  };
  return { api, view, media, destroy: async () => { await crepe.destroy(); root.remove(); projection.unmount(); } };
}

afterAll(async () => { await new Promise((resolve) => setTimeout(resolve, 3100)); });

test("选区/局部文字变化保留媒体映射，空StepMap属性变化刷新来源", async () => {
  const editor = await createEditor();
  try {
    expect(editor.media().map((item) => item.display)).toEqual([display.url, second]);
    editor.view.dispatch(editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, 2)));
    expect(editor.media().map((item) => item.display)).toEqual([display.url, second]);
    editor.view.dispatch(editor.view.state.tr.insertText("续", 1));
    const first = editor.media()[0]!;
    editor.view.dispatch(editor.view.state.tr.setNodeAttribute(first.position, "src", second));
    expect(editor.media().map((item) => item.display)).toEqual([second, second]);
  } finally { await editor.destroy(); }
});

test("多step删除和插入后装饰位置正确，展示更新不改变模型来源", async () => {
  const editor = await createEditor();
  try {
    const first = editor.media()[0]!;
    const original = editor.view.state.doc.nodeAt(first.position)!;
    const transaction = editor.view.state.tr.delete(first.position, first.position + original.nodeSize);
    transaction.insert(0, original);
    editor.view.dispatch(transaction);
    expect(editor.media().map(({ source, display: url }) => [source, url])).toEqual([[source, display.url], [second, second]]);
    const previousDoc = editor.view.state.doc;
    editor.api.update([{ sourceUrl: source, display: { ...display, url: display.url + "?v=2" } }]);
    editor.view.dispatch(editor.view.state.tr.setMeta("media-display", true));
    expect(editor.view.state.doc).toBe(previousDoc);
    expect(editor.media().map((item) => item.display)).toEqual([display.url + "?v=2", second]);
  } finally { await editor.destroy(); }
});
