/** 编辑器图片上传工具：预签名 URL → S3 直传 → 确认 → 轮询 */

import type { MediaDisplay } from "@/lib/media-display";
import { getAuthSnapshot, subscribeAuthStore } from "@/lib/auth-store";
import { assertImageCanBeProcessed } from "@/lib/image-container";
import { apiClient } from "@/api/client";
import { createImageFileFromBlob } from "@/lib/image-file";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
] as const;

type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** 统一错误响应体（后端 AllExceptionsFilter）：code 为业务错误码，42900=限流 */
interface ApiErrorBody {
  code?: number;
  message?: string;
}

/** 每用户小时上传配额超限（后端 media 配额，code=42900） */
const UPLOAD_RATE_LIMIT_CODE = 42900;

/** 配额超限时抛出的友好提示 */
const RATE_LIMIT_MESSAGE = "上传图片太频繁，请稍后再试";

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
    return "仅支持 jpg/png/gif/webp/avif 格式";
  }
  if (file.size < 1) {
    return "图片文件不能为空";
  }
  if (file.size > 10 * 1024 * 1024) {
    return "图片大小不能超过 10MB";
  }
  return null;
}

/** 头像专用校验：仅允许光栅格式（裁剪后统一 webp），排除可能携带脚本的 svg */
export function validateAvatarFile(file: File): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "头像仅支持 jpg/png/webp 格式";
  }
  if (file.size < 1) {
    return "头像文件不能为空";
  }
  if (file.size > 10 * 1024 * 1024) {
    return "图片大小不能超过 10MB";
  }
  return null;
}

/** 个人主页背景图校验；动图不进入固定 3:1 裁剪链路。 */
export function validateProfileCoverFile(file: File): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "背景图仅支持 jpg/png/webp 格式";
  }
  if (file.size < 1) {
    return "背景图文件不能为空";
  }
  if (file.size > 10 * 1024 * 1024) {
    return "图片大小不能超过 10MB";
  }
  return null;
}

export interface UploadedImage {
  display?: MediaDisplay | null;
  url: string;
  mediaId: string;
  thumbnailUrl: string | null;
  feedUrl: string | null;
  mediumUrl: string | null;
  width: number | null;
  height: number | null;
  contentType: string | null;
  animated: boolean;
}

export type MediaUploadPurpose =
  | "AVATAR"
  | "PROFILE_COVER"
  | "DIRECT_MESSAGE"
  | "MOMENT"
  | "MOMENT_COMMENT"
  | "RICH_CONTENT"
  | "STICKER_SOURCE"
  | "LEGACY";

export interface UploadReservation {
  mediaId: string;
}

/** 上传中断后携带原 mediaId，调用方可用同一文件继续而不制造重复记录。 */
export class RecoverableImageUploadError extends Error {
  constructor(message: string, readonly reservation: UploadReservation) {
    super(message);
    this.name = "RecoverableImageUploadError";
  }
}

export type UploadImageStage = "preparing" | "uploading" | "processing";

export interface UploadImageProgress {
  stage: UploadImageStage;
  /** 已发送到对象存储的字节数；准备阶段不可计算时为 null。 */
  loadedBytes: number | null;
  /** 本次对象存储直传的总字节数；准备阶段不可计算时为 null。 */
  totalBytes: number | null;
  /** 0～100 的整数进度；准备阶段不可计算时为 null。 */
  percent: number | null;
}

export interface UploadImageOptions {
  signal?: AbortSignal;
  /** 完成后传递展示描述，编辑器仍持久化来源URL。 */
  onCompleted?: (image: UploadedImage) => void;
  /** 单次对象存储直传的最长等待时间。 */
  timeoutMs?: number;
  onStage?: (stage: UploadImageStage) => void;
  /** 包含真实已上传字节数的进度回调。 */
  onProgress?: (progress: UploadImageProgress) => void;
  /** 继续一个先前中断的上传；必须仍使用同一文件。 */
  resume?: UploadReservation;
  /** 预建媒体记录后立即回传，供业务入口跨失败重试保存。 */
  onReservation?: (reservation: UploadReservation) => void;
  /** 图片异步处理最长等待时间，默认 120 秒。 */
  processingTimeoutMs?: number;
  /** 业务用途决定服务端实际生成哪些派生图。 */
  purpose?: MediaUploadPurpose;
  /** 调用方已通过 Canvas 完成裁切、方向修正和元数据移除时跳过重复编码。 */
  clientNormalized?: boolean;
}

const DIRECT_UPLOAD_TIMEOUT_MS = 120_000;
const PROCESSING_TIMEOUT_MS = 120_000;
const MEDIA_OBJECT_MISSING_CODE = 40419;
const CONFIRM_RETRY_DELAYS_MS = [0, 400, 1_000] as const;
let activeReservations = new WeakMap<File, Map<string, UploadReservation>>();
const reservationScopes = new WeakMap<UploadReservation, string>();
let uploadSessionUserId = getAuthSnapshot().user?.id ?? null;
let uploadSessionEpoch = 0;
subscribeAuthStore(() => {
  const userId = getAuthSnapshot().user?.id ?? null;
  if (userId === uploadSessionUserId) return;
  uploadSessionUserId = userId;
  uploadSessionEpoch++;
  activeReservations = new WeakMap();
  interruptedReservations.clear();
});
function setActiveReservation(file: File, scope: string, reservation: UploadReservation) {
  const reservations = activeReservations.get(file) ?? new Map<string, UploadReservation>();
  reservations.set(scope, reservation);
  activeReservations.set(file, reservations);
}
const interruptedReservations = new Map<string, UploadReservation>();
const MAX_INTERRUPTED_RESERVATIONS = 100;
const MAX_NORMALIZED_EDGE = 2560;
const NORMALIZED_WEBP_QUALITY = 0.85;
const preparedFiles = new WeakMap<File, Promise<File>>();

class MediaObjectMissingError extends Error {}
class MediaStatusRequestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

function normalizedFilenameStem(filename: string) {
  return filename.replace(/\.[^.]*$/, "") || "image";
}

async function canvasToPreferredImageBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("图片压缩失败，请重新选择")),
      "image/webp",
      NORMALIZED_WEBP_QUALITY,
    );
  });
}

/** GIF 保留原件；其他静态图在离开浏览器前统一去元数据并限制像素。 */
export async function normalizeImageForUpload(file: File): Promise<File> {
  const existing = preparedFiles.get(file);
  if (existing) return existing;

  const prepared = (async () => {
    const container = await assertImageCanBeProcessed(file);
    if (container.kind === "gif" || typeof createImageBitmap !== "function") return file;
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new Error("无法读取图片，请换一张后重试");
    }
    try {
      const scale = Math.min(1, MAX_NORMALIZED_EDGE / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("当前浏览器无法处理图片");
      context.drawImage(bitmap, 0, 0, width, height);
      const blob = await canvasToPreferredImageBlob(canvas);
      return createImageFileFromBlob(blob, normalizedFilenameStem(file.name), file.lastModified);
    } finally {
      bitmap.close();
    }
  })();
  preparedFiles.set(file, prepared);
  try {
    return await prepared;
  } catch (error) {
    preparedFiles.delete(file);
    throw error;
  }
}

const fileDigests = new WeakMap<File, Promise<string>>();
/** 有界文件内容摘要允许重选同一文件续查，不能仅凭同名/大小/时间误认资产。 */
export async function getImageUploadKey(file: File, purpose: MediaUploadPurpose = "LEGACY"): Promise<string> {
  const epoch = uploadSessionEpoch;
  let digest = fileDigests.get(file);
  if (!digest) {
    digest = file.arrayBuffer().then((bytes) => crypto.subtle.digest("SHA-256", bytes))
      .then((bytes) => Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join(""));
    fileDigests.set(file, digest);
  }
  const hash = await digest;
  if (epoch !== uploadSessionEpoch) throw createUploadAbortError();
  return `${epoch}:${purpose}:${file.type}:${hash}`;
}

function rememberInterrupted(uploadKey: string, reservation: UploadReservation) {
  interruptedReservations.delete(uploadKey);
  interruptedReservations.set(uploadKey, reservation);
  while (interruptedReservations.size > MAX_INTERRUPTED_RESERVATIONS) {
    const oldest = interruptedReservations.keys().next().value;
    if (!oldest) break;
    interruptedReservations.delete(oldest);
  }
}

function createUploadAbortError(): DOMException {
  return new DOMException("图片上传已取消", "AbortError");
}

export function isUploadAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function throwIfUploadAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createUploadAbortError();
}

function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfUploadAborted(signal);
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timeout);
      reject(createUploadAbortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function putImageFile(
  uploadUrl: string,
  file: File,
  signal: AbortSignal | undefined,
  timeoutMs: number,
  onProgress?: (loadedBytes: number, totalBytes: number) => void,
): Promise<void> {
  throwIfUploadAborted(signal);
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    let settled = false;

    const abortRequest = () => request.abort();
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abortRequest);
      callback();
    };

    request.upload.addEventListener("progress", (event) => {
      const totalBytes = event.lengthComputable && event.total > 0 ? event.total : file.size;
      onProgress?.(Math.min(event.loaded, totalBytes), totalBytes);
    });
    request.addEventListener("load", () => {
      if (request.status < 200 || request.status >= 300) {
        finish(() => reject(new Error("上传失败，请检查网络后重试")));
        return;
      }
      onProgress?.(file.size, file.size);
      finish(resolve);
    });
    request.addEventListener("error", () => {
      finish(() => reject(new Error("上传失败，请检查网络后重试")));
    });
    request.addEventListener("timeout", () => {
      finish(() => reject(new Error("图片上传超时，请检查网络后重试")));
    });
    request.addEventListener("abort", () => {
      finish(() => reject(createUploadAbortError()));
    });
    signal?.addEventListener("abort", abortRequest, { once: true });

    try {
      request.open("PUT", uploadUrl);
      request.setRequestHeader("Content-Type", file.type);
      request.timeout = timeoutMs;
      onProgress?.(0, file.size);
      request.send(file);
    } catch {
      finish(() => reject(new Error("上传失败，请检查网络后重试")));
    }
  });
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as ApiErrorBody).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function toUploadedImage(media: {
  display?: MediaDisplay | null;
  id: string;
  url: string;
  thumbnailUrl: string | null;
  feedUrl: string | null;
  mediumUrl: string | null;
  width: number | null;
  height: number | null;
  contentType: string | null;
  animated: boolean;
}): UploadedImage {
  return {
    mediaId: media.id,
    display: media.display,
    url: media.url,
    thumbnailUrl: media.thumbnailUrl,
    feedUrl: media.feedUrl,
    mediumUrl: media.mediumUrl,
    width: media.width,
    height: media.height,
    contentType: media.contentType,
    animated: media.animated,
  };
}

async function confirmMedia(mediaId: string, signal?: AbortSignal) {
  for (let attempt = 0; attempt < CONFIRM_RETRY_DELAYS_MS.length; attempt++) {
    throwIfUploadAborted(signal);
    const delay = CONFIRM_RETRY_DELAYS_MS[attempt];
    if (delay > 0) await abortableDelay(delay, signal);

    let result;
    try {
      result = await apiClient.POST("/api/v1/media/upload-done", {
        body: { mediaId },
        signal,
      });
    } catch (error) {
      if (attempt < CONFIRM_RETRY_DELAYS_MS.length - 1) continue;
      throw new Error(apiErrorMessage(error, "文件确认失败，请重试"));
    }

    if (result.data) return result.data.data.media;
    const error = result.error as ApiErrorBody | undefined;
    if (error?.code === MEDIA_OBJECT_MISSING_CODE) throw new MediaObjectMissingError();

    const retryable = !result.response || result.response.status >= 500;
    if (retryable && attempt < CONFIRM_RETRY_DELAYS_MS.length - 1) continue;
    throw new Error(apiErrorMessage(error, "文件确认失败，请重试"));
  }
  throw new Error("文件确认失败，请重试");
}

async function getMedia(mediaId: string, signal?: AbortSignal) {
  const { data, error, response } = await apiClient.GET("/api/v1/media/{id}", {
    params: { path: { id: mediaId } },
    signal,
  });
  if (error) {
    throw new MediaStatusRequestError(
      apiErrorMessage(error, "查询图片状态失败"),
      response?.status,
    );
  }
  if (!data) throw new MediaStatusRequestError("查询图片状态失败");
  return data.data;
}

async function pollCompletedMedia(
  mediaId: string,
  signal: AbortSignal | undefined,
  timeoutMs: number,
) {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    const delay = Math.min(250 * 2 ** Math.min(attempt, 4), 4_000);
    await abortableDelay(delay, signal);
    attempt++;

    let media;
    try {
      media = await getMedia(mediaId, signal);
    } catch (error) {
      if (isUploadAbortError(error)) throw error;
      if (error instanceof MediaStatusRequestError && error.status && error.status < 500) {
        throw error;
      }
      // 状态查询的短暂网络/5xx 故障不应让已经入队的上传失去恢复机会。
      if (Date.now() >= deadline) throw error;
      continue;
    }
    if (media.status === "COMPLETED") return toUploadedImage(media);
    if (media.status === "FAILED") throw new Error("图片处理失败，请重新上传");
  }
  throw new Error("图片仍在处理中，请稍后重试查询；无需重新上传");
}

export async function uploadImageFile(file: File, options: UploadImageOptions = {}): Promise<UploadedImage> {
  const epoch = uploadSessionEpoch;
  const controller = new AbortController();
  const unsubscribe = subscribeAuthStore(() => {
    if (uploadSessionEpoch !== epoch) controller.abort();
  });
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  try { return await uploadImageWithinSession(file, { ...options, signal }, epoch); }
  finally { unsubscribe(); }
}

async function uploadImageWithinSession(
  file: File,
  options: UploadImageOptions,
  epoch: number,
): Promise<UploadedImage> {
  const validationError = validateImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const {
    signal,
    timeoutMs = DIRECT_UPLOAD_TIMEOUT_MS,
    onStage,
    onProgress,
    resume,
    onReservation,
    processingTimeoutMs = PROCESSING_TIMEOUT_MS,
    purpose = "LEGACY",
    clientNormalized = false,
  } = options;
  throwIfUploadAborted(signal);

  const uploadFile = clientNormalized ? file : await normalizeImageForUpload(file);
  const normalizedValidationError = validateImageFile(uploadFile);
  if (normalizedValidationError) throw new Error(normalizedValidationError);

  const reportStage = (stage: UploadImageStage) => {
    onStage?.(stage);
    if (stage === "preparing") {
      onProgress?.({ stage, loadedBytes: null, totalBytes: null, percent: null });
    } else if (stage === "processing") {
      onProgress?.({
        stage,
        loadedBytes: uploadFile.size,
        totalBytes: uploadFile.size,
        percent: 100,
      });
    }
  };
  const reportUploadProgress = (loadedBytes: number, totalBytes: number) => {
    const percent = totalBytes > 0
      ? Math.min(100, Math.max(0, Math.round((loadedBytes / totalBytes) * 100)))
      : 0;
    onProgress?.({
      stage: "uploading",
      loadedBytes,
      totalBytes,
      percent,
    });
  };

  throwIfUploadAborted(signal);
  const scope = `${epoch}:${purpose}:${clientNormalized}`;
  const uploadKey = `${await getImageUploadKey(file, purpose)}:${clientNormalized}`;
  throwIfUploadAborted(signal);
  // resume只接受本模块在同账号会话/用途发出的对象，跨会话或外部拼装的mediaId不能复用。
  let reservation = (resume && reservationScopes.get(resume) === uploadKey ? resume : undefined)
    ?? activeReservations.get(file)?.get(scope) ?? interruptedReservations.get(uploadKey);
  if (reservation) setActiveReservation(file, scope, reservation);
  const finish = (uploaded: UploadedImage) => {
    throwIfUploadAborted(signal);
    activeReservations.get(file)?.delete(scope);
    interruptedReservations.delete(uploadKey);
    options.onCompleted?.(uploaded);
    return uploaded;
  };
  try {
    reportStage("preparing");
    let mediaId: string;
    let needsDirectUpload = true;
    let uploadUrl: string | null = null;

    if (reservation) {
      const media = await getMedia(reservation.mediaId, signal);
      if (media.status === "COMPLETED") return finish(toUploadedImage(media));
      if (media.status === "PROCESSING") {
        reportStage("processing");
        return finish(await pollCompletedMedia(media.id, signal, processingTimeoutMs));
      }
      if (media.status === "UPLOADING") {
        mediaId = media.id;
        needsDirectUpload = false;
      } else {
        reservation = undefined;
        activeReservations.get(file)?.delete(scope);
        interruptedReservations.delete(uploadKey);
      }
    }

    if (!reservation) {
      const { data: urlData, error: urlError } = await apiClient.POST(
        "/api/v1/media/upload-url",
        {
          body: {
            filename: uploadFile.name,
            contentType: uploadFile.type as AllowedMimeType,
            size: uploadFile.size,
            purpose,
          },
          signal,
        },
      );
      if (urlError) {
        const error = urlError as ApiErrorBody;
        if (error.code === UPLOAD_RATE_LIMIT_CODE) throw new Error(RATE_LIMIT_MESSAGE);
        throw new Error(apiErrorMessage(error, "获取上传地址失败"));
      }
      if (!urlData) throw new Error("获取上传地址失败");

      mediaId = urlData.data.mediaId;
      uploadUrl = urlData.data.uploadUrl;
      throwIfUploadAborted(signal);
      reservation = { mediaId };
      reservationScopes.set(reservation, uploadKey);
      setActiveReservation(file, scope, reservation);
      onReservation?.(reservation);
    } else {
      mediaId = reservation.mediaId;
    }

    if (needsDirectUpload) {
      onStage?.("uploading");
      await putImageFile(uploadUrl!, uploadFile, signal, timeoutMs, reportUploadProgress);
      throwIfUploadAborted(signal);
    }

    reportStage("processing");
    let media;
    try {
      media = await confirmMedia(mediaId, signal);
    } catch (error) {
      if (!(error instanceof MediaObjectMissingError)) throw error;
      const { data: reissueData, error: reissueError } = await apiClient.POST(
        "/api/v1/media/{id}/upload-url",
        { params: { path: { id: mediaId } }, signal },
      );
      if (reissueError || !reissueData) {
        throw new Error(apiErrorMessage(reissueError, "恢复上传地址失败，请重试"));
      }
      onStage?.("uploading");
      await putImageFile(
        reissueData.data.uploadUrl,
        uploadFile,
        signal,
        timeoutMs,
        reportUploadProgress,
      );
      reportStage("processing");
      media = await confirmMedia(mediaId, signal);
    }

    if (media.status === "COMPLETED") return finish(toUploadedImage(media));
    if (media.status === "FAILED") throw new Error("图片处理失败，请重新上传");
    return finish(await pollCompletedMedia(mediaId, signal, processingTimeoutMs));
  } catch (error) {
    if (reservation && epoch === uploadSessionEpoch) {
      setActiveReservation(file, scope, reservation);
      rememberInterrupted(uploadKey, reservation);
    }
    if (signal?.aborted || isUploadAbortError(error)) throw createUploadAbortError();
    if (reservation && !(error instanceof RecoverableImageUploadError)) {
      throw new RecoverableImageUploadError(
        apiErrorMessage(error, "图片上传失败，请重试"),
        reservation,
      );
    }
    throw error;
  }
}

/** 编辑器图片上传：仅返回公开 URL */
export async function uploadImage(
  file: File,
  options: UploadImageOptions = {},
): Promise<string> {
  const result = await uploadImageFile(file, options);
  return result.url;
}

/** Markdown 仅持久化主图 URL；RICH_CONTENT/LEGACY 明确生成的中图与信息流图由此定位。 */
export function getMarkdownImageVariantUrl(
  url: string,
  size: "feed" | "md",
): string {
  if (url.endsWith(".svg")) return url;
  const suffix = `_${size}.webp`;
  const dotIndex = url.lastIndexOf(".");
  if (dotIndex === -1) return url + suffix;
  return url.slice(0, dotIndex) + suffix;
}
