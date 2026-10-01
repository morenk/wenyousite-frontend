import { CrepeBuilder } from "@milkdown/crepe/builder";
import { editorViewCtx, serializerCtx } from "@milkdown/core";
import { afterAll, expect, test, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  configureEditorMarkdownSerializer,
  createEditorMarkdownBridge,
  serializeEditorMarkdown,
} from "../src/components/editor/milkdown-markdown-codec";

const percentile = (values: number[]) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1] ?? 0;
const samples: object[] = [];
afterAll(async () => {
  const output = process.env.EDITOR_BENCHMARK_OUTPUT;
  if (output) {
    mkdirSync(output, { recursive: true, mode: 0o700 });
    writeFileSync(join(output, "encoding.json"), JSON.stringify({
      note: "Node/happy-dom 微基准；定时器受控、performance.now 为真实时钟。完整编码耗时含协议验证；输入批次额外统计 serializerCtx 调用次数和累计耗时。不可当成浏览器输入延迟。",
      samples,
    }, null, 2), { mode: 0o600 });
  }
  await new Promise((resolve) => setTimeout(resolve, 3_100));
});

for (const size of [200, 2_000, 9_000]) {
  test("编码与输入合并 " + size + " 字，三轮", async () => {
    for (let round = 0; round < 3; round++) {
      const root = document.createElement("div");
      document.body.append(root);
      const onChange = vi.fn();
      let flush: (() => string | null) | null = null;
      const crepe = new CrepeBuilder({ root, defaultValue: "文字样本".repeat(Math.ceil(size / 4)).slice(0, size) });
      crepe.editor.config(configureEditorMarkdownSerializer).use(createEditorMarkdownBridge({
        onChange,
        onReady: (value) => { flush = value; },
        onError: (error) => { throw error; },
      }));
      await crepe.create();
      try {
        const view = crepe.editor.action((ctx) => ctx.get(editorViewCtx));
        const encoderDurations: number[] = [];
        // 热身排除首次模块加载；测量相同文档的完整编码成本。
        for (let count = 0; count < 35; count++) {
          const start = performance.now();
          const markdown = crepe.editor.action((ctx) => serializeEditorMarkdown(ctx, view.state.doc));
          const duration = performance.now() - start;
          expect(markdown).toContain("文字样本");
          if (count >= 5) encoderDurations.push(duration);
        }
        const serializerDurations: number[] = [];
        crepe.editor.action((ctx) => {
          const original = ctx.get(serializerCtx);
          ctx.set(serializerCtx, (doc) => {
            const started = performance.now();
            try { return original(doc); }
            finally { serializerDurations.push(performance.now() - started); }
          });
        });
        onChange.mockClear();
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        for (const char of "abcdefghijklmnopqrstuvwxyz".repeat(3)) {
          view.dom.dispatchEvent(new KeyboardEvent("keydown", { key: char, bubbles: true }));
          view.dispatch(view.state.tr.insertText(char, view.state.doc.content.size - 1));
          await vi.advanceTimersByTimeAsync(20);
        }
        await vi.advanceTimersByTimeAsync(800);
        const latest = (flush as unknown as () => string | null)();
        expect(latest).toContain("abcdefghijklmnopqrstuvwxyz".repeat(3));
        expect(view.state.doc.textContent).toHaveLength(size + 78);
        samples.push({
          size, round, edits: 78, elapsedInputMs: 1_560,
          encodingP95Ms: percentile(encoderDurations),
          serializerCalls: serializerDurations.length,
          serializerP95Ms: percentile(serializerDurations),
          serializerTotalMs: serializerDurations.reduce((sum, value) => sum + value, 0),
          snapshots: onChange.mock.calls.length,
        });
      } finally {
        vi.useRealTimers();
        await crepe.destroy();
        root.remove();
      }
    }
  });
}
