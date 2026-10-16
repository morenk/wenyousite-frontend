import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { CrepeBuilder } from "@milkdown/crepe/builder";
import { editorViewCtx } from "@milkdown/core";
import { configureEditorMarkdownSerializer, serializeEditorMarkdown } from "@/components/editor/milkdown-markdown-codec";
import { editorMarkdownPastePlugin } from "@/components/editor/markdown-literal-paste";
import { createAudioUploadAnchor } from "@/components/editor/editor-audio-anchor";
import { MarkdownContent } from "../markdown-content";
import type { MarkdownMediaAudio } from "@/lib/markdown-audio";
import { createReaderSelectionClipboardPayload } from "@/lib/site-clipboard";
const route = vi.hoisted(() => ({ pathname: "/threads/audio" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
const fixture = JSON.parse(readFileSync("contracts/markdown-audio-v1-fixtures.json", "utf8")) as {
  cases: { id: string; markdown: string; mediaAudios: MarkdownMediaAudio[]; player: boolean; labels: string[] }[];
  invalidProjectionCases: { id: string; markdown: string; mediaAudios: MarkdownMediaAudio[] }[];
};
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function () { this.dispatchEvent(new Event("pause")); });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function () { this.dispatchEvent(new Event("playing")); return Promise.resolve(); });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
for (const item of fixture.cases) test(`音频正文共享契约 ${item.id}`, () => {
  const { container } = render(<MarkdownContent content={item.markdown} mediaAudios={item.mediaAudios} />);
  const players = container.querySelectorAll('[data-slot="audio-player"]');
  expect(players.length > 0).toBe(item.player);
  if (item.player) {
    expect(Array.from(container.querySelectorAll('[data-slot="audio-label"]'), (label) => label.textContent)).toEqual(item.labels);
    expect(container.querySelectorAll("audio[src]")).toHaveLength(0);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  }
});
for (const item of fixture.invalidProjectionCases) test(`坏音频投影降级 ${item.id}`, () => {
  const { container } = render(<MarkdownContent content={item.markdown} mediaAudios={item.mediaAudios} />);
  expect(container.querySelector("audio")).toBeNull();
  expect(container.querySelector("a")).not.toBeNull();
});
test("标签 marks 和 reader 复制都保留普通链接", () => {
  const item = fixture.cases.find((value) => value.id === "marked-label")!;
  const { container } = render(<MarkdownContent content={item.markdown} mediaAudios={item.mediaAudios} />);
  expect(container.querySelector('[data-slot="audio-label"] strong')).toHaveTextContent("雨夜");
  expect(container.querySelector('[data-slot="audio-label"] em')).toHaveTextContent("片段");
  const selection = window.getSelection()!; const range = document.createRange(); range.selectNodeContents(container.firstElementChild!); selection.removeAllRanges(); selection.addRange(range);
  const payload = createReaderSelectionClipboardPayload(container.firstElementChild as HTMLElement, selection)!;
  expect(payload.html).toContain('<strong>雨夜</strong>'); expect(payload.html).toContain('<em>片段</em>');
  expect(payload.html).toContain(item.mediaAudios[0].sourceUrl); expect(payload.html).not.toContain("input"); expect(payload.text).not.toContain("0:00");
});
test("点击才设置直连 src；只有一个播放，后台暂停且不自动恢复", async () => {
  const item = fixture.cases[0];
  const { container } = render(<MarkdownContent content={item.markdown + "\n\n" + item.markdown} mediaAudios={item.mediaAudios} />);
  const audios = Array.from(container.querySelectorAll("audio"));
  await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "播放" })[0]); });
  expect(audios[0]).toHaveAttribute("src", item.mediaAudios[0].sourceUrl); expect(audios[0]).toHaveAttribute("preload", "none"); expect(audios[1]).not.toHaveAttribute("src");
  await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "播放" })[0]); });
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  const calls = vi.mocked(HTMLMediaElement.prototype.play).mock.calls.length;
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  fireEvent(document, new Event("visibilitychange"));
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  fireEvent(document, new Event("visibilitychange"));
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(calls);
});
test("失败和父级重绘不会自动重试；用户点击才重试", async () => {
  const item = fixture.cases[0];
  const view = render(<MarkdownContent content={item.markdown} mediaAudios={item.mediaAudios} />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "播放" })); });
  fireEvent.error(view.container.querySelector("audio")!);
  view.rerender(<MarkdownContent content={item.markdown} mediaAudios={[{ ...item.mediaAudios[0] }]} />);
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "重试播放" })); });
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
});

test("图片链接与外部HTTP投影不升级播放器", () => {
  const item = fixture.cases[0];
  const view = render(<MarkdownContent content={`[![封面](https://bucket.example/cover.png)](${item.mediaAudios[0].sourceUrl})`} mediaAudios={item.mediaAudios} />);
  expect(view.container.querySelector("audio")).toBeNull();
  view.rerender(<MarkdownContent content="[音频](http://external.example/audio.mp3)" mediaAudios={[{ ...item.mediaAudios[0], sourceUrl: "http://external.example/audio.mp3" }]} />);
  expect(view.container.querySelector("audio")).toBeNull();
});
test("改变来源/路径重置播放器状态，metadata前不能seek", async () => {
  const item = fixture.cases[0];
  const view = render(<MarkdownContent content={item.markdown} mediaAudios={item.mediaAudios} />);
  expect(screen.getByRole("slider", { name: "播放进度" })).toBeDisabled();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "播放" })); });
  expect(screen.getByRole("slider", { name: "播放进度" })).toBeDisabled();
  const oldAudio = view.container.querySelector("audio")!;
  fireEvent.error(oldAudio);
  route.pathname = "/threads/other";
  view.rerender(<MarkdownContent content={item.markdown} mediaAudios={item.mediaAudios} />);
  expect(view.container.querySelector("audio")).not.toBe(oldAudio);
  expect(view.container.querySelector("audio")).not.toHaveAttribute("src");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("button", { name: "播放" })).toBeInTheDocument();
  expect(screen.getByRole("slider")).toHaveValue("0");
  route.pathname = "/threads/audio";
});

test("后台解除src停止缓冲，用户点击并收到metadata后才恢复进度", async () => {
  const item = fixture.cases[0];
  const { container } = render(<MarkdownContent content={item.markdown} mediaAudios={item.mediaAudios} />);
  const audio = container.querySelector("audio")!;
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "播放" })); });
  audio.currentTime = 0.5; fireEvent.timeUpdate(audio);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  fireEvent(document, new Event("visibilitychange"));
  expect(audio).not.toHaveAttribute("src"); expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  fireEvent(document, new Event("visibilitychange"));
  expect(audio).not.toHaveAttribute("src"); expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  audio.currentTime = 0;
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "播放" })); });
  expect(audio).toHaveAttribute("src", item.mediaAudios[0].sourceUrl); expect(screen.getByRole("slider")).toBeDisabled();
  Object.defineProperty(audio, "readyState", { configurable: true, value: 1 }); fireEvent.loadedMetadata(audio);
  expect(audio.currentTime).toBe(0.5); expect(screen.getByRole("slider")).not.toBeDisabled();
});


test("上传原文件名序列化后的服务端正文与投影可直接阅读，缺失投影先降级而不猜URL", async () => {
 const media = fixture.cases[0].mediaAudios[0];
 const root = document.createElement("div"); document.body.append(root);
 const anchor = createAudioUploadAnchor();
 const editor = new CrepeBuilder({ root, defaultValue: "" });
 editor.editor.config(configureEditorMarkdownSerializer).use(anchor.plugin);
 await editor.create();
 let content = "";
 try {
  editor.editor.action((ctx) => {
   const view = ctx.get(editorViewCtx); anchor.start(view);
   expect(anchor.insert(view, media.sourceUrl, "雨[夜] *片段*.wav")).toBe(true);
   content = serializeEditorMarkdown(ctx, view.state.doc, { markdownContractVersion: 5 });
  });
 } finally { await editor.destroy(); root.remove(); }
 // API消费端按返回字段透传，不用本机上传缓存替代服务端媒体投影。
 const response = JSON.parse(JSON.stringify({ content, mediaAudios: [media] }));
 const view = render(<MarkdownContent content={response.content} />);
 expect(view.container.querySelector("audio")).toBeNull();
 expect(screen.getByRole("link", { name: "雨[夜] *片段*.wav" })).toHaveAttribute("href", media.sourceUrl);
 view.rerender(<MarkdownContent content={response.content} mediaAudios={response.mediaAudios} />);
 expect(view.container.querySelector('[data-slot="audio-label"]')).toHaveTextContent("雨[夜] *片段*.wav");
 expect(view.container.querySelector("audio")).not.toHaveAttribute("src");
 expect(screen.getByRole("button", { name: "保存到本地" })).toBeInTheDocument();
});

test.each(["**", "*", "~~"])("独占音频链接外层 %s 格式仍显示播放器并保留格式", (mark) => {
 const media = fixture.cases[0].mediaAudios[0];
 const { container } = render(<MarkdownContent content={`${mark}[录音.wav](${media.sourceUrl})${mark}`} mediaAudios={[media]} />);
 expect(container.querySelector('[data-slot="audio-player"]')).not.toBeNull();
 const tag = mark === "**" ? "strong" : mark === "*" ? "em" : "del";
 expect(container.querySelector(`[data-slot="audio-label"] ${tag}`)).toHaveTextContent("录音.wav");
 expect(container.querySelector("audio")).not.toHaveAttribute("src");
});
test("格式包裹的混排/多链接与缺失投影仍保留普通链接", () => {
 const media = fixture.cases[0].mediaAudios[0];
 const view = render(<MarkdownContent content={`**前文[录音](${media.sourceUrl})**`} mediaAudios={[media]} />);
 expect(view.container.querySelector("audio")).toBeNull();
 view.rerender(<MarkdownContent content={`**[一](${media.sourceUrl})[二](${media.sourceUrl})**`} mediaAudios={[media]} />);
 expect(view.container.querySelector("audio")).toBeNull(); expect(view.container.querySelectorAll("a")).toHaveLength(2);
 view.rerender(<MarkdownContent content={`**[录音](${media.sourceUrl})**`} />);
 expect(view.container.querySelector("audio")).toBeNull(); expect(view.container.querySelector("a")).not.toBeNull();
});

test("嵌套内外marks与前后段落兼容，阅读复制到编辑再阅读保留单链接", async () => {
 const media = fixture.cases[0].mediaAudios[0];
 const view = render(<MarkdownContent content={`前文\n\n***~~[**录音.wav**](${media.sourceUrl})~~***\n\n后文`} mediaAudios={[media]} />);
 const player = view.container.querySelector<HTMLElement>('[data-slot="audio-player"]')!;
 expect(player).not.toBeNull(); expect(view.container).toHaveTextContent("前文"); expect(view.container).toHaveTextContent("后文");
 for(const tag of ["strong", "em", "del"]) expect(player.querySelector(`[data-slot="audio-label"] ${tag}`)).toHaveTextContent("录音.wav");
 const selection = window.getSelection()!; const range = document.createRange(); range.selectNode(player); selection.removeAllRanges(); selection.addRange(range);
 const payload = createReaderSelectionClipboardPayload(view.container.firstElementChild as HTMLElement, selection)!;
 expect(payload.html).not.toContain("button"); expect(payload.html).not.toContain("mediaId");
 const root = document.createElement("div"); document.body.append(root);
 const editor = new CrepeBuilder({ root, defaultValue: "" }); editor.editor.config(configureEditorMarkdownSerializer).use(editorMarkdownPastePlugin); await editor.create();
 let roundtrip = "";
 try {
  editor.editor.action(ctx => {
   const pm = ctx.get(editorViewCtx);
   const event = new Event("paste", { bubbles: true, cancelable: true });
   Object.defineProperty(event, "clipboardData", { value: { files: [], getData: (type: string) => type === "text/html" ? payload.html : type === "text/plain" ? payload.text : "" } });
   pm.dom.dispatchEvent(event);
   roundtrip = serializeEditorMarkdown(ctx, pm.state.doc, { markdownContractVersion: 5 });
  });
 } finally { await editor.destroy(); root.remove(); }
 view.rerender(<MarkdownContent content={roundtrip} mediaAudios={[media]} />);
 expect(view.container.querySelectorAll('[data-slot="audio-player"]')).toHaveLength(1);
 for(const tag of ["strong", "em", "del"]) expect(view.container.querySelector(`[data-slot="audio-label"] ${tag}`)).toHaveTextContent("录音.wav");
 for(const content of [`> **[录音](${media.sourceUrl})**`, `- **[录音](${media.sourceUrl})**`, "\x60**[录音](" + media.sourceUrl + ")**\x60", `**[录音](${media.sourceUrl})** 后文`]) {
  view.rerender(<MarkdownContent content={content} mediaAudios={[media]} />); expect(view.container.querySelector("audio")).toBeNull();
 }
});

test.each(["after", "before", "both"])("独占br空段与音频 %s 相邻时保留原空段而不降级", (placement) => {
 const media = fixture.cases[0].mediaAudios[0]; const link = `**[录音.wav](${media.sourceUrl})**`;
 const before = placement !== "after" ? "<br />\n" : ""; const after = placement !== "before" ? "\n<br />" : "";
 const { container } = render(<MarkdownContent content={before + link + after} mediaAudios={[media]} />);
 expect(container.querySelectorAll('[data-slot="audio-player"]')).toHaveLength(1);
 expect(container.querySelectorAll('[data-wenyou-empty-row]')).toHaveLength(placement === "both" ? 2 : 1);
 expect(container.querySelector('[data-slot="audio-label"] br')).toBeNull();
 expect(container.querySelector("audio")).not.toHaveAttribute("src");
});
