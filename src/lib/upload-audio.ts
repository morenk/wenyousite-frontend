import { apiClient } from "@/api/client";
import type { components } from "@/api/types";
import { getApiErrorMessage, hasApiErrorCode } from "@/api/errors";
import { getAuthSnapshot, subscribeAuthStore } from "@/lib/auth-store";
import { isValidMediaAudio, type MarkdownMediaAudio } from "@/lib/markdown-audio";
import { putMediaFile } from "@/lib/upload-media-file";

export type AudioUploadCapability = components["schemas"]["AudioUploadCapabilityDto"];
type Media = components["schemas"]["MediaResponseDto"];
export type AudioUploadProgress = { stage: "uploading" | "processing"; percent: number | null };
type Reservation = { userId: string; mediaId: string };
const reservations = new WeakMap<File, Reservation>();
const MIME_ALIASES: Record<string, string> = {
  "video/mp4": "audio/mp4",
  "audio/mp3": "audio/mpeg", "audio/x-mp3": "audio/mpeg", "audio/x-mpeg": "audio/mpeg",
  "audio/x-m4a": "audio/mp4", "audio/m4a": "audio/mp4", "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav", "audio/vnd.wave": "audio/wav", "audio/x-flac": "audio/flac", "application/ogg": "audio/ogg",
};
const EXTENSION_MIME: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/mp4", mp4: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", flac: "audio/flac" };
export function audioFileMime(file: File): string {
  const type = file.type.toLowerCase().split(";", 1)[0];
  return MIME_ALIASES[type] ?? ((type && type !== "application/octet-stream") ? type : EXTENSION_MIME[file.name.split(".").at(-1)?.toLowerCase() ?? ""] || "");
}
export function validateAudioFile(file: File, capability: AudioUploadCapability): string | null {
  if (capability.version !== 1 || capability.outputContentType !== "audio/mpeg") return "暂不支持音频上传";
  if (!capability.contentTypes.includes(audioFileMime(file) as AudioUploadCapability["contentTypes"][number])) return "请选择 MP3、M4A、WAV、OGG 或 FLAC 音频";
  if (file.size < 1) return "音频文件不能为空";
  if (file.size > Math.min(capability.maxBytes, 30 * 1024 * 1024)) return "音频不能超过 30 MiB";
  return null;
}
function delay(milliseconds: number, signal: AbortSignal) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}
function completed(media: Media): MarkdownMediaAudio {
  const audio = { sourceUrl: media.url, mediaId: media.id, contentType: media.contentType, size: media.size, durationMs: media.durationMs };
  if (media.purpose !== "RICH_CONTENT_AUDIO" || !isValidMediaAudio(audio)) throw new Error("音频结果无效，请重试");
  return audio;
}
export class FinalAudioUploadError extends Error {}
function failed(media: Media): Error {
  return new FinalAudioUploadError(media.failureCode === "AUDIO_TOO_LONG" ? "音频不能超过 10 分钟"
    : media.failureCode === "AUDIO_INVALID" ? "无法读取音频，请重新选择文件" : "音频处理失败，请重试");
}
function verifyMedia(media: Media, mediaId: string, userId: string): Media {
  if (media.id !== mediaId || media.userId !== userId || media.purpose !== "RICH_CONTENT_AUDIO") throw new Error("音频响应不匹配，请重试");
  return media;
}
async function getMedia(mediaId: string, userId: string, signal: AbortSignal) {
  const result = await apiClient.GET("/api/v1/media/{id}", { params: { path: { id: mediaId } }, signal });
  if (!result.data) throw new Error(getApiErrorMessage(result.error, "音频状态读取失败，请重试"));
  return verifyMedia(result.data.data, mediaId, userId);
}
async function confirm(mediaId: string, userId: string, signal: AbortSignal) {
  const result = await apiClient.POST("/api/v1/media/upload-done", { body: { mediaId }, signal });
  if (!result.data) throw result.error ?? new Error("音频确认失败，请重试");
  return verifyMedia(result.data.data.media, mediaId, userId);
}

/** 同一文件/账号在取消或断网后继续原 mediaId；失败后仅显式重试新建。 */
export async function uploadAudio(file: File, capability: AudioUploadCapability, options: {
  signal?: AbortSignal;
  onProgress?: (progress: AudioUploadProgress) => void;
  processingTimeoutMs?: number;
  resume?: { mediaId: string };
  onReservation?: (reservation: { mediaId: string }) => Promise<void>;
} = {}): Promise<MarkdownMediaAudio> {
  const validation = validateAudioFile(file, capability);
  if (validation) throw new Error(validation);
  const userId = getAuthSnapshot().user?.id;
  if (!userId) throw new Error("请先登录");
  const controller = new AbortController();
  const abort = () => controller.abort(new DOMException("上传已取消", "AbortError"));
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const unsubscribe = subscribeAuthStore(() => { if (getAuthSnapshot().user?.id !== userId) { reservations.delete(file); abort(); } });
  const signal = controller.signal;
  try {
    signal.throwIfAborted();
    const input = file.type === audioFileMime(file) ? file : new File([file], file.name, { type: audioFileMime(file), lastModified: file.lastModified });
    let reservation = reservations.get(file) ?? (options.resume ? { userId, mediaId: options.resume.mediaId } : undefined);
    if (reservation?.userId !== userId) reservation = undefined;
    let media: Media | undefined;
    let uploadUrl: string | undefined;
    if (reservation) {
      media = await getMedia(reservation.mediaId, userId, signal);
      if (media.status === "FAILED") { reservations.delete(file); throw failed(media); }
      if (media.status === "UPLOADING") {
        try { media = await confirm(reservation.mediaId, userId, signal); }
        catch (error) {
          if (!hasApiErrorCode(error, 40419)) throw error;
          const result = await apiClient.POST("/api/v1/media/{id}/upload-url", { params: { path: { id: reservation.mediaId } }, signal });
          if (!result.data) throw result.error ?? new Error("无法继续上传，请重试");
          if (result.data.data.mediaId !== reservation.mediaId) throw new Error("音频续传响应不匹配，请重试");
          uploadUrl = result.data.data.uploadUrl;
        }
      }
    } else {
      const result = await apiClient.POST("/api/v1/media/upload-url", {
        body: { filename: file.name, contentType: input.type as AudioUploadCapability["contentTypes"][number], size: input.size, purpose: "RICH_CONTENT_AUDIO" }, signal,
      });
      if (!result.data) throw result.error ?? new Error("无法开始上传，请重试");
      if (!result.data.data.mediaId?.trim()) throw new Error("音频预约响应无效，请重试");
      reservation = { userId, mediaId: result.data.data.mediaId };
      reservations.set(file, reservation);
      await options.onReservation?.(reservation);
      uploadUrl = result.data.data.uploadUrl;
    }
    signal.throwIfAborted();
    if (uploadUrl) {
      await putMediaFile(uploadUrl, input, signal, 120_000, (loaded, total) => options.onProgress?.({ stage: "uploading", percent: Math.round(loaded / total * 100) }));
      signal.throwIfAborted();
      media = await confirm(reservation.mediaId, userId, signal);
    }
    const deadline = Date.now() + (options.processingTimeoutMs ?? 120_000);
    let attempt = 0;
    while (media?.status !== "COMPLETED") {
      signal.throwIfAborted();
      if (media?.status === "FAILED") { reservations.delete(file); throw failed(media); }
      if (Date.now() >= deadline) throw new Error("音频仍在处理中，请稍后继续");
      options.onProgress?.({ stage: "processing", percent: null });
      await delay(Math.min(500 * 2 ** attempt++, 4_000), signal);
      media = await getMedia(reservation.mediaId, userId, signal);
    }
    signal.throwIfAborted();
    const result = completed(media);
    reservations.delete(file);
    return result;
  } finally {
    unsubscribe();
    options.signal?.removeEventListener("abort", abort);
  }
}
