import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { readFileSync } from "node:fs";
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
