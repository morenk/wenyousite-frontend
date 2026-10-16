import { readFileSync } from "node:fs";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { CrepeBuilder } from "@milkdown/crepe/builder";
import { editorViewCtx } from "@milkdown/core";
import { NodeSelection, TextSelection } from "@milkdown/kit/prose/state";
import { undo, redo } from "@milkdown/kit/prose/history";
import { DOMSerializer } from "@milkdown/kit/prose/model";
import type { MarkdownMediaAudio } from "@/lib/markdown-audio";
import { configureEditorMarkdownSerializer, editorAttentionBoundaryParser, editorBoundaryTextSchema, editorSoftBreakParser, prepareEditorMarkdown, serializeEditorMarkdown } from "../milkdown-markdown-codec";
import { configureEditorAlignmentParser, configureEditorAlignmentSchemas } from "../editor-alignment";
import { editorMarkdownPastePlugin } from "../markdown-literal-paste";
import { createEditorAudioProjection, useEditorAudioView } from "../editor-audio-view";
const storage = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/audio-draft", () => ({ loadAudioProjections: storage.load, saveAudioProjection: storage.save }));
const fixture = JSON.parse(readFileSync("contracts/markdown-audio-v1-fixtures.json", "utf8")) as {
 cases: { id: string; markdown: string; mediaAudios: MarkdownMediaAudio[]; player: boolean; labels: string[] }[];
 invalidProjectionCases: { id: string; markdown: string; projection: MarkdownMediaAudio }[];
};
const media = fixture.cases[0].mediaAudios[0];
async function editor(markdown: string, mappings = [media]) {
 const root = document.createElement("div"); document.body.append(root);
 const audio = createEditorAudioProjection(mappings);
 const crepe = new CrepeBuilder({ root, defaultValue: prepareEditorMarkdown(markdown, { markdownContractVersion: 5 }) });
 crepe.editor.config((ctx) => configureEditorAlignmentParser(ctx, { markdownContractVersion: 5 }))
  .config((ctx) => configureEditorAlignmentSchemas(ctx, { markdownContractVersion: 5 })).config(configureEditorMarkdownSerializer)
  .use(editorAttentionBoundaryParser).use(editorSoftBreakParser).use(editorBoundaryTextSchema).use(audio.plugin).use(editorMarkdownPastePlugin);
 await crepe.create();
 const view = crepe.editor.action((ctx) => ctx.get(editorViewCtx));
 return { audio, root, view, crepe, markdown: () => crepe.editor.action((ctx) => serializeEditorMarkdown(ctx, view.state.doc, { markdownContractVersion: 5 })),
  destroy: async () => { await crepe.destroy(); root.remove(); } };
}
function key(e: Awaited<ReturnType<typeof editor>>, name: string, shiftKey = false) {
 const event = new KeyboardEvent("keydown", { key: name, shiftKey });
 return e.view.someProp("handleKeyDown", (handler) => handler(e.view, event));
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); storage.load.mockReset(); storage.save.mockReset(); });
for (const item of fixture.cases) test(`可信编辑投影 ${item.id}`, async () => {
 const e = await editor(item.markdown, item.mediaAudios);
 try {
  expect(e.audio.getMounts()).toHaveLength(item.player ? item.labels.length : 0);
  expect(e.root.querySelectorAll("[data-editor-audio]")).toHaveLength(item.player ? item.labels.length : 0);
  if (!["list", "escaped"].includes(item.id)) expect(e.markdown()).toBe(item.markdown);
 } finally { await e.destroy(); }
});
for (const item of fixture.invalidProjectionCases) test(`非法投影不挂播放器 ${item.id}`, async () => {
 const e = await editor(item.markdown, [item.projection]);
 try { expect(e.audio.getMounts()).toHaveLength(0); expect(e.markdown()).toBe(item.markdown); } finally { await e.destroy(); }
});
test("普通段落不挂播放器；相同投影不重复 dispatch，撤销/投影降级不改 Markdown", async () => {
 const e = await editor(`前文\n\n${fixture.cases[14].markdown}\n\n后文`);
 try {
  const dispatch = vi.spyOn(e.view, "dispatch"); const original = e.markdown();
  e.audio.update([{ ...media }]); e.audio.completed({ ...media }); e.audio.completed({ ...media });
  expect(dispatch).not.toHaveBeenCalled(); expect(e.audio.getMounts()).toHaveLength(1);
  const audioPos = e.view.state.doc.firstChild!.nodeSize;
  e.view.dispatch(e.view.state.tr.setSelection(NodeSelection.create(e.view.state.doc, audioPos)));
  expect(key(e, "Delete")).toBe(true); expect(e.audio.getMounts()).toHaveLength(0);
  expect(undo(e.view.state, e.view.dispatch)).toBe(true); expect(e.markdown()).toBe(original); expect(e.audio.getMounts()).toHaveLength(1);
  expect(redo(e.view.state, e.view.dispatch)).toBe(true); expect(e.audio.getMounts()).toHaveLength(0);
  undo(e.view.state, e.view.dispatch); const doc = e.view.state.doc;
  e.audio.reset(); expect(e.audio.getMounts()).toHaveLength(0); expect(e.view.state.doc).toBe(doc); expect(e.markdown()).toBe(original);
 } finally { await e.destroy(); }
});
test("卡片前后输入及 Shift 选择；鼠标选中；只读不修改", async () => {
 const e = await editor(fixture.cases[0].markdown);
 try {
  for (const eventName of ["handleClickOn", "handleDoubleClickOn", "handleTripleClickOn"] as const) {
   e.view.someProp(eventName, (handler) => handler(e.view, 0, e.view.state.doc.firstChild!, 0, new MouseEvent("click"), true));
   expect(e.view.state.selection).toBeInstanceOf(NodeSelection);
  }
  expect(e.view.state.selection).toBeInstanceOf(NodeSelection);
  const original = e.view.state.doc;
  key(e, "ArrowLeft", true); expect(e.view.state.doc).toBe(original);
  e.view.dispatch(e.view.state.tr.setSelection(NodeSelection.create(e.view.state.doc, 0)));
  key(e, "ArrowLeft"); e.view.dispatch(e.view.state.tr.insertText("前"));
  expect(e.markdown()).toBe(`前\n\n${fixture.cases[0].markdown}`);
  const pos = e.view.state.doc.firstChild!.nodeSize;
  e.view.dispatch(e.view.state.tr.setSelection(NodeSelection.create(e.view.state.doc, pos)));
  key(e, "ArrowRight"); e.view.dispatch(e.view.state.tr.insertText("后"));
  expect(e.markdown()).toBe(`前\n\n${fixture.cases[0].markdown}\n\n后`);
  e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, pos + 1)));
  expect(e.view.state.selection).toBeInstanceOf(NodeSelection);
  e.crepe.setReadonly(true); const readonlyDoc = e.view.state.doc; expect(e.view.editable).toBe(false); e.view.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true })); expect(e.view.state.doc).toBe(readonlyDoc);
 } finally { await e.destroy(); }
});
test("移入引用卸载；复制序列化保留 link 和 marks 而无播放器控件", async () => {
 const e = await editor(fixture.cases[14].markdown);
 try {
  const dom = DOMSerializer.fromSchema(e.view.state.schema).serializeFragment(e.view.state.doc.content);
  const copy = document.createElement("div"); copy.append(dom);
  expect(copy.querySelector("a")?.href).toBe(media.sourceUrl); expect(copy.querySelector("strong")).toHaveTextContent("雨夜");
  expect(copy.querySelector("button,audio,input")).toBeNull();
  const node = e.view.state.doc.firstChild!;
  e.view.dispatch(e.view.state.tr.replaceWith(0, e.view.state.doc.content.size, e.view.state.schema.nodes.blockquote.create(null, node)));
  expect(e.audio.getMounts()).toHaveLength(0); expect(e.markdown()).toBe(`> ${fixture.cases[14].markdown}`);
  undo(e.view.state, e.view.dispatch); expect(e.audio.getMounts()).toHaveLength(1);
 } finally { await e.destroy(); }
});
test("同作用域回调稳定，账号/目标切换清映射，旧完成回调失效", async () => {
 storage.load.mockResolvedValue([]); storage.save.mockResolvedValue(undefined);
 const hook = renderHook(({ user, target, mappings }) => useEditorAudioView(mappings, user, target), { initialProps: { user: "u1", target: undefined as string | undefined, mappings: [] as MarkdownMediaAudio[] } });
 const completed = hook.result.current.completed;
 await act(async () => { await completed(media); });
 hook.rerender({ user: "u1", target: undefined, mappings: [] });
 expect(hook.result.current.completed).toBe(completed); expect(hook.result.current.api.snapshot()).toEqual([media]);
 hook.rerender({ user: "u2", target: undefined, mappings: [] });
 expect(hook.result.current.api.snapshot()).toEqual([]);
 await expect(completed(media)).rejects.toMatchObject({ name: "AbortError" });
 hook.rerender({ user: "u2", target: "reply:1", mappings: [] });
 await waitFor(() => expect(storage.load).toHaveBeenCalledWith(JSON.stringify(["u2", "reply:1"]), "u2"));
 await act(async () => { await hook.result.current.completed(media); });
 const old = hook.result.current.completed;
 hook.rerender({ user: "u2", target: "reply:2", mappings: [] });
 expect(hook.result.current.api.snapshot()).toEqual([]); await expect(old(media)).rejects.toMatchObject({ name: "AbortError" });
});

test("复制粘贴保留外层单链接和 label marks，不复制或创造可信元数据", async () => {
 const e = await editor(fixture.cases[14].markdown);
 try {
  const serializer = e.view.someProp("clipboardSerializer")!;
  const copy = document.createElement("div"); copy.append(serializer.serializeFragment(e.view.state.doc.content));
  expect(copy.querySelectorAll("a")).toHaveLength(1); expect(copy.querySelector("a > strong")).toHaveTextContent("雨夜");
  expect(copy.innerHTML).not.toContain("sourceLink"); expect(copy.innerHTML).not.toContain("mediaId");
  const end = e.view.state.doc.content.size; const tr = e.view.state.tr.insert(end, e.view.state.schema.nodes.paragraph.create()); e.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, end + 1)));
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: { files: [], getData: (type: string) => type === "text/html" ? copy.innerHTML : "雨夜与片段" } });
  e.view.dom.dispatchEvent(event);
  expect(e.audio.getMounts()).toHaveLength(2); expect(e.markdown()).toBe(`${fixture.cases[14].markdown}\n\n${fixture.cases[14].markdown}`);
  e.audio.reset(); expect(e.audio.getMounts()).toHaveLength(0);
 } finally { await e.destroy(); }
});

test("播放器控件手势不启动父卡片拖动，结束后恢复卡片移动", async () => {
 const e = await editor(fixture.cases[0].markdown);
 try {
  const card = e.root.querySelector<HTMLElement>("[data-editor-audio]")!; const input = document.createElement("input"); input.type = "range"; card.append(input);
  const doc = e.view.state.doc; input.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); expect(card.draggable).toBe(false);
  const drag = new Event("dragstart", { bubbles: true, cancelable: true }); input.dispatchEvent(drag); expect(drag.defaultPrevented).toBe(true);
  input.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true })); expect(card.draggable).toBe(true); expect(e.view.state.doc).toBe(doc);
 } finally { await e.destroy(); }
});

test("音频前后独占br空段在PM保持独立，投影及往返不吞空行", async () => {
 const e = await editor(`<br />\n[录音.wav](${media.sourceUrl})\n<br />`);
 try {
  expect(e.audio.getMounts()).toHaveLength(1);
  expect(e.view.state.doc.childCount).toBe(3);
  expect(e.view.state.doc.firstChild!.textContent).toBe(""); expect(e.view.state.doc.lastChild!.textContent).toBe("");
  expect(e.markdown().match(/<br \/>/g)).toHaveLength(2);
  const reopened = await editor(e.markdown());
  try { expect(reopened.audio.getMounts()).toHaveLength(1); expect(reopened.view.state.doc.childCount).toBe(3); expect(reopened.markdown()).toBe(e.markdown()); }
  finally { await reopened.destroy(); }
 } finally { await e.destroy(); }
});
