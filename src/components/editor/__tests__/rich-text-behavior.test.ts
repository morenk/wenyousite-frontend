import { summarizeReader } from "@/test/rich-text/reader";
import { configureEditorStableTrailing } from "@/components/editor/editor-stability";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { CrepeBuilder } from "@milkdown/crepe/builder";
import { imageBlock } from "@milkdown/crepe/feature/image-block";
import { editorViewCtx, parserCtx, serializerCtx } from "@milkdown/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import { closeHistory, redo, undo } from "@milkdown/kit/prose/history";
import { afterAll, expect, test, vi } from "vitest";
import { configureEditorMarkdownSerializer, createEditorMarkdownBridge, editorAttentionBoundaryParser,
  editorSoftBreakParser, prepareEditorMarkdown, EditorMarkdownCodecError } from "../milkdown-markdown-codec";
import { configureEditorAlignmentParser, configureEditorAlignmentSchemas } from "../editor-alignment";
import { createDiceInlineEditorPlugins } from "../dice-inline-plugin";
import { createStickerInlineEditorPlugins } from "../sticker-inline-plugin";
import { editorMarkdownPastePlugin } from "../markdown-literal-paste";
import { firstDifference, resolvePosition, summarizeDocument, summarizeSelection, type SharedState } from "@/test/rich-text/semantics";

interface Operation { type: string; text?: string; outcome?: string; historyBoundary?: boolean; plainText?: string; regeneratedIds?: string[]; resolution?: string }
interface Case { id: string; family: string; initial: SharedState & { canonical: string }; steps: Array<{ id: string; operation: Operation; expected: SharedState }> }
const source = readFileSync("contracts/rich-text-behavior-v1-fixtures.json", "utf8");
const fixtures = JSON.parse(source) as { cases: Case[] };
type Stage = "decoded" | "edited" | "serialized" | "backend" | "reader" | "selection" | "save";
const observations: Array<{ caseId: string; stepId: string; stage: Stage; status: string; actual?: SharedState; reason?: string }> = [];
function observe(caseId: string, stepId: string, stage: Stage, expected: SharedState, actual: SharedState, fullActual = actual) {
  const difference = firstDifference(expected, actual);
  observations.push({ caseId, stepId, stage, status: difference ? "failed" : "passed", actual: fullActual, ...(difference ? { reason: "mismatch" } : {}) });
  expect(difference, `${caseId}/${stepId}/${stage}: ${difference ?? "equal"}`).toBeUndefined();
}

afterAll(async () => {
  writeFileSync(process.env.RICH_TEXT_RESULTS_PATH ?? "/tmp/rich-text-web-results.json", JSON.stringify({
    contract: "wenyousite-rich-text-behavior-results", version: 1,
    fixtureSha256: createHash("sha256").update(source).digest("hex"),
    sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    platform: "web", environment: "unit-editor", observations,
  }, null, 2) + "\n");
  await new Promise((resolve) => setTimeout(resolve, 3100));
});

test.each(fixtures.cases)("$id 真实编辑事务逐步对照共享独立预期", async (item) => {
  const root = document.createElement("div"); document.body.append(root);
  let flush: (() => string | null) | null = null;
  let encodeFailure = false;
  let persisted = item.initial.canonical;
  let remoteVersion = 1;
  let editVersion = 1;
  let clipboard = "";
  const crepe = new CrepeBuilder({ root, defaultValue: prepareEditorMarkdown(item.initial.canonical, { markdownContractVersion: 5 }) });
  const dice = createDiceInlineEditorPlugins(), sticker = createStickerInlineEditorPlugins();
  crepe.addFeature(imageBlock);
  crepe.editor.config((ctx) => configureEditorAlignmentParser(ctx, { markdownContractVersion: 5 }))
    .config((ctx) => configureEditorAlignmentSchemas(ctx, { markdownContractVersion: 5 }))
    .config(configureEditorMarkdownSerializer)
        .config(configureEditorStableTrailing).use(editorAttentionBoundaryParser).use(editorSoftBreakParser)
    .use(dice.remarkDiceInline).use(dice.diceInlineSchema).use(dice.clonePastedDice)
    .use(sticker.remarkStickerInline).use(sticker.stickerInlineSchema).use(editorMarkdownPastePlugin)
    .use(createEditorMarkdownBridge({ markdownContractVersion: 5, onChange: () => {}, onReady: (next) => { flush = next; } }));
  try {
    await crepe.create();
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const serialize = ctx.get(serializerCtx);
      ctx.set(serializerCtx, (doc) => { if (encodeFailure) throw new EditorMarkdownCodecError("synthetic"); return serialize(doc); });
      if (item.initial.selection) view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc,
        resolvePosition(view.state.doc, item.initial.selection.anchor), resolvePosition(view.state.doc, item.initial.selection.focus))));
      const verify = (stepId: string, expected: SharedState, stage: "decoded" | "edited") => {
        const actual = { summary: summarizeDocument(view.state.doc), canonical: flush!(),
          ...(expected.selection ? { selection: summarizeSelection(view.state.selection) } : {}) };
        observe(item.id, stepId, stage, { summary: expected.summary }, { summary: actual.summary }, actual);
        observe(item.id, stepId, "serialized", { canonical: expected.canonical }, { canonical: actual.canonical }, actual);
        if (expected.selection) observe(item.id, stepId, "selection", { selection: expected.selection }, { selection: actual.selection }, actual);
        const readerSummary = actual.canonical === null ? null : summarizeReader(actual.canonical);
        if (readerSummary) observe(item.id, stepId, "reader", { summary: expected.summary }, { summary: readerSummary },
          { canonical: actual.canonical, summary: readerSummary });
        else observations.push({ caseId: item.id, stepId, stage: "reader", status: "not-run",
          reason: "not-applicable" });
        return actual;
      };
      verify("initial", item.initial, "decoded");
      for (const step of item.steps) {
        const operation = step.operation;
        let save: SharedState["save"];
        let unsupported = false;
        if (operation.historyBoundary) view.dispatch(closeHistory(view.state.tr));
        switch (operation.type) {
          case "enter":
            expect(view.someProp("handleKeyDown", (handler) => handler(view, new KeyboardEvent("keydown", { key: "Enter" })))).toBe(true); break;
          case "insertText": view.dispatch(view.state.tr.insertText(operation.text!)); break;
          case "backspace": {
            // 原生浏览器删除另做端到端验证；此处适配器按契约指定字素删除范围执行真实事务。
            const { $from } = view.state.selection;
            if ($from.parentOffset === 0) {
              expect(view.someProp("handleKeyDown", (handler) => handler(view, new KeyboardEvent("keydown", { key: "Backspace" })))).toBe(true);
              break;
            }
            const before = $from.parent.textBetween(0, $from.parentOffset, "", "\ufffc");
            const last = [...new Intl.Segmenter("zh", { granularity: "grapheme" }).segment(before)].at(-1);
            if (!last) throw new Error("No grapheme before caret");
            view.dispatch(view.state.tr.delete($from.pos - last.segment.length, $from.pos)); break;
          }
          case "undo": expect(undo(view.state, view.dispatch)).toBe(true); break;
          case "redo": expect(redo(view.state, view.dispatch)).toBe(true); break;
          case "copy": {
            const div = document.createElement("div");
            view.someProp("clipboardSerializer", (serializer) => {
              div.append(serializer.serializeFragment(view.state.selection.content().content));
            });
            clipboard = div.innerHTML; break;
          }
          case "paste": {
            const ids = [...(operation.regeneratedIds ?? [])];
            const random = ids.length ? vi.spyOn(crypto, "randomUUID").mockImplementation(() => ids.shift()! as `${string}-${string}-${string}-${string}-${string}`) : null;
            try {
              const event = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
              Object.defineProperty(event, "clipboardData", { value: { files: [], getData: (type: string) => type === "text/html" ? clipboard : operation.plainText ?? "" } });
              view.dom.dispatchEvent(event);
              expect(event.defaultPrevented).toBe(true);
            } finally { random?.mockRestore(); }
            break;
          }
          case "reopen": {
            const markdown = flush!(); if (markdown === null) throw new Error("Cannot reopen invalid document");
            const doc = ctx.get(parserCtx)(prepareEditorMarkdown(markdown, { markdownContractVersion: 5 }));
            view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content)); break;
          }
          case "save": case "recover": {
            encodeFailure = operation.outcome === "encode-error";
            if (operation.outcome === "conflict") remoteVersion++;
            if (operation.type === "recover" && operation.resolution === "explicit-retry-after-reload") {
              // 传输适配器先返回当前远端版本；正文仍是用户保留的本地编辑。
              const reloaded = { content: persisted, version: remoteVersion };
              editVersion = reloaded.version;
            }
            const requestMarkdown = flush!();
            // 受控传输层仅模拟给定响应，不将它冒充真实 API 校验或自动冲突覆盖。
            if (requestMarkdown !== null && editVersion === remoteVersion && (operation.type === "recover" || operation.outcome === "success")) persisted = requestMarkdown;
            save = { requestMarkdown, persistedMarkdown: persisted, dirty: requestMarkdown === null || requestMarkdown !== persisted };
            break;
          }
          case "close":
            // Web 无本机持久化快照，关闭走明确放弃确认；不能伪造移动端快照写入。
            for (const stage of ["edited", "serialized", "reader", ...(step.expected.selection ? ["selection"] : []), "save"] as Stage[]) {
              observations.push({ caseId: item.id, stepId: step.id, stage, status: "not-run", reason: "not-applicable" });
            }
            unsupported = true; break;
          default: throw new Error(`Unsupported operation ${operation.type}`);
        }
        if (operation.historyBoundary) view.dispatch(closeHistory(view.state.tr));
        if (unsupported) continue;
        const actual = verify(step.id, step.expected, "edited");
        if (step.expected.save) observe(item.id, step.id, "save", { save: step.expected.save }, { save }, { ...actual, save });
      }
    });
  } finally { await crepe.destroy(); root.remove(); }
});
