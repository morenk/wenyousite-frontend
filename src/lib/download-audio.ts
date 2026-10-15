import { isValidMediaAudio, type MarkdownMediaAudio } from "./markdown-audio";

const MAX_DOWNLOAD_BYTES = 30 * 1024 * 1024;
export function audioDownloadName(label: string): string {
  const base = label.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069<>:"/\\|?*]/gu, "_").trim().replace(/\.[^.]+$/u, "").replace(/[. ]+$/u, "");
  const name = Array.from(base).slice(0, 80).join("") || "音频";
  return `${/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/iu.test(name) ? "_" : ""}${name}.mp3`;
}

/** 对象存储请求不走业务 API，也不携带 Cookie/令牌；同时限制声明与实际读取大小。 */
export async function downloadAudioBlob(media: MarkdownMediaAudio, signal: AbortSignal): Promise<Blob> {
  if (!isValidMediaAudio(media) || media.size > MAX_DOWNLOAD_BYTES) throw new Error("音频文件过大");
  signal.throwIfAborted();
  const response = await fetch(media.sourceUrl, { credentials: "omit", referrerPolicy: "no-referrer", signal });
  if (!response.ok || !response.body || response.headers.get("content-type")?.split(";")[0].trim() !== "audio/mpeg") { await response.body?.cancel(); throw new Error("保存失败"); }
  const length = response.headers.get("content-length");
  if (length !== null && Number(length) !== media.size) { await response.body.cancel(); throw new Error("文件大小不符"); }
  const reader = response.body.getReader(); const parts: Uint8Array<ArrayBuffer>[] = []; let bytes = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > media.size || bytes > MAX_DOWNLOAD_BYTES) throw new Error("文件大小不符");
      parts.push(new Uint8Array(value));
    }
    signal.throwIfAborted();
    if (bytes !== media.size) throw new Error("文件不完整");
    return new Blob(parts, { type: "audio/mpeg" });
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
