import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AudioPlayer } from "../audio-player";
const download = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ usePathname: () => "/threads/audio" }));
vi.mock("@/lib/download-audio", async (original) => ({ ...await original<typeof import("@/lib/download-audio")>(), downloadAudioBlob: download }));
const media = { sourceUrl: "https://bucket.example/audio.mp3", mediaId: "a", contentType: "audio/mpeg" as const, size: 3, durationMs: 1000 };
beforeEach(() => {
 download.mockReset(); vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {}); vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
 vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test"); vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {}); vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
function pending() { download.mockImplementation((_media, signal: AbortSignal) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }))); }
test("点击才保存，不设置播放src；label生成MP3文件名并可失败后重试", async () => {
 const view = render(<AudioPlayer media={media}><strong>雨夜.wav</strong></AudioPlayer>); expect(download).not.toHaveBeenCalled();
 download.mockRejectedValueOnce(new Error("network"));
 await act(async () => fireEvent.click(screen.getByRole("button", { name: "保存到本地" })));
 expect(screen.getByRole("alert")).toHaveTextContent("保存失败"); expect(view.container.querySelector("audio")).not.toHaveAttribute("src");
 download.mockResolvedValueOnce(new Blob(["abc"]));
 let filename = ""; vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(function () { filename = this.download; });
 await act(async () => fireEvent.click(screen.getByRole("button", { name: "保存到本地" })));
 expect(filename).toBe("雨夜.mp3"); expect(screen.queryByRole("alert")).toBeNull();
 view.unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
});
test("挂起下载可用同按钮取消，状态归位且可重新发起；卸载中止", async () => {
 pending(); const view = render(<AudioPlayer media={media}>音频</AudioPlayer>);
 fireEvent.click(screen.getByRole("button", { name: "保存到本地" })); expect(screen.getByRole("button", { name: "取消保存" })).toHaveAttribute("aria-busy", "true");
 await act(async () => fireEvent.click(screen.getByRole("button", { name: "取消保存" })));
 expect(download.mock.calls[0][1].aborted).toBe(true); expect(screen.queryByRole("alert")).toBeNull();
 fireEvent.click(screen.getByRole("button", { name: "保存到本地" })); expect(download).toHaveBeenCalledTimes(2);
 view.unmount(); expect(download.mock.calls[1][1].aborted).toBe(true);
});
test("超时解除busy，显示显式重试", async () => {
 download.mockRejectedValueOnce(new DOMException("保存超时", "TimeoutError")); render(<AudioPlayer media={media}>音频</AudioPlayer>);
 await act(async () => fireEvent.click(screen.getByRole("button", { name: "保存到本地" })));
 expect(download.mock.calls[0][1].aborted).toBe(false); expect(screen.getByRole("button", { name: "保存到本地" })).toHaveAttribute("aria-busy", "false"); expect(screen.getByRole("alert")).toHaveTextContent("保存失败");
});

test("编辑态不提供保存入口，阅读态默认保留，切换不加载音源", () => {
 const view = render(<AudioPlayer media={media} showDownload={false}>录音.wav</AudioPlayer>);
 expect(screen.getByRole("button", { name: "播放" })).toBeInTheDocument();
 expect(screen.queryByRole("button", { name: "保存到本地" })).toBeNull();
 expect(view.container.querySelector('[data-slot="audio-player"]')).toHaveAttribute("data-download", "false");
 view.rerender(<AudioPlayer media={media}>录音.wav</AudioPlayer>);
 expect(screen.getByRole("button", { name: "保存到本地" })).toBeInTheDocument();
 expect(download).not.toHaveBeenCalled(); expect(view.container.querySelector("audio")).not.toHaveAttribute("src");
});
