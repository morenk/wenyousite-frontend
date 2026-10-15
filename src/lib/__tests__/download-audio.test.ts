import { afterEach, expect, test, vi } from "vitest";
import { audioDownloadName, downloadAudioBlob } from "../download-audio";
const media = { sourceUrl: "https://bucket.example/audio.mp3", mediaId: "audio", contentType: "audio/mpeg" as const, size: 3, durationMs: 1000 };
afterEach(() => vi.unstubAllGlobals());
test("下载直桶无凭证，逐段完整读取", async () => {
 const fetcher = vi.fn().mockResolvedValue(new Response(new Uint8Array([1,2,3]), { headers: { "content-type": "audio/mpeg", "content-length": "3" } })); vi.stubGlobal("fetch", fetcher);
 const signal = new AbortController().signal; const blob = await downloadAudioBlob(media, signal);
 expect(blob.size).toBe(3); expect(fetcher).toHaveBeenCalledWith(media.sourceUrl, { credentials: "omit", referrerPolicy: "no-referrer", signal });
});
for (const size of [2, 4]) test(`无 length 时实际字节 ${size} 不符拒绝保存`, async () => {
 vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array(size), { headers: { "content-type": "audio/mpeg" } })));
 await expect(downloadAudioBlob(media, new AbortController().signal)).rejects.toThrow();
});
test("硬上限先拒绝且取消不生成文件", async () => {
 const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
 await expect(downloadAudioBlob({ ...media, size: 30 * 1024 * 1024 + 1 }, new AbortController().signal)).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
 const controller = new AbortController();controller.abort(); fetcher.mockRejectedValue(new DOMException("取消", "AbortError"));
 await expect(downloadAudioBlob(media, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
});
test("下载名来自标签且扩展名与播放副本一致", () => {
 expect(audioDownloadName("雨[夜] #1.wav")).toBe("雨[夜] #1.mp3");
 expect(audioDownloadName("../../CON.wav")).toBe(".._.._CON.mp3");
 expect(audioDownloadName("CON.wav")).toBe("_CON.mp3"); expect(audioDownloadName("")).toBe("音频.mp3");
});

for (const headers of [{ "content-type": "text/html" }, { "content-type": "audio/mpeg", "content-length": "999" }]) test("响应头不符立即取消响应流", async () => {
 const cancel = vi.fn(); const body = new ReadableStream({ cancel });
 vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { headers })));
 await expect(downloadAudioBlob(media, new AbortController().signal)).rejects.toThrow(); expect(cancel).toHaveBeenCalledTimes(1);
});
