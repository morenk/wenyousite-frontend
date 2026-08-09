/** 编辑器图片上传工具：预签名 URL → S3 直传 → 确认 → 轮询 */

import { apiClient } from "@/api/client";

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

interface UploadedImage {
  url: string;
  mediaId: string;
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
  /** 单次对象存储直传的最长等待时间。 */
  timeoutMs?: number;
  onStage?: (stage: UploadImageStage) => void;
  /** 包含真实已上传字节数的进度回调。 */
  onProgress?: (progress: UploadImageProgress) => void;
}

const DIRECT_UPLOAD_TIMEOUT_MS = 120_000;

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

export async function uploadImageFile(
  file: File,
  options: UploadImageOptions = {},
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
  } = options;
  throwIfUploadAborted(signal);

  const reportStage = (stage: UploadImageStage) => {
    onStage?.(stage);
    if (stage === "preparing") {
      onProgress?.({ stage, loadedBytes: null, totalBytes: null, percent: null });
    } else if (stage === "processing") {
      onProgress?.({ stage, loadedBytes: file.size, totalBytes: file.size, percent: 100 });
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

  // 1. 获取预签名 URL
  try {
    reportStage("preparing");
    const { data: urlData, error: urlError } = await apiClient.POST(
      "/api/v1/media/upload-url",
      {
        body: {
          filename: file.name,
          contentType: file.type as AllowedMimeType,
          size: file.size,
        },
        signal,
      },
    );
    if (urlError) {
      const err = urlError as ApiErrorBody;
      if (err.code === UPLOAD_RATE_LIMIT_CODE) {
        throw new Error(RATE_LIMIT_MESSAGE);
      }
      throw new Error(err.message || "获取上传地址失败");
    }

    if (!urlData) throw new Error("获取上传地址失败");
    const upload = urlData.data;

    // 2. 直传 S3。XHR 提供真实上传字节进度，并保留超时与主动取消能力。
    onStage?.("uploading");
    await putImageFile(upload.uploadUrl, file, signal, timeoutMs, reportUploadProgress);
    throwIfUploadAborted(signal);

    // 3. 确认上传完成
    reportStage("processing");
    const { data: doneData, error: doneError } = await apiClient.POST(
      "/api/v1/media/upload-done",
      {
        body: { mediaId: upload.mediaId },
        signal,
      },
    );
    if (doneError) throw doneError;

    if (!doneData) throw new Error("文件确认失败");

    // 4. 轮询处理状态
    await abortableDelay(500, signal);
    for (let i = 0; i < 30; i++) {
      const { data: statusData, error: statusError } = await apiClient.GET(
        "/api/v1/media/{id}",
        {
          params: { path: { id: upload.mediaId } },
          signal,
        },
      );
      if (statusError) throw statusError;

      if (!statusData) throw new Error("查询图片状态失败");
      const media = statusData.data;

      if (media.status === "COMPLETED") {
        return { url: media.url, mediaId: upload.mediaId };
      }
      if (media.status === "FAILED") {
        throw new Error("图片处理失败，请重新上传");
      }

      await abortableDelay(1000, signal);
    }

    throw new Error("图片处理超时，请稍后重试");
  } catch (error) {
    if (signal?.aborted || isUploadAbortError(error)) throw createUploadAbortError();
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

export function getImageUrlBySize(
  url: string,
  size: "feed" | "md" | "thumb",
): string {
  if (url.endsWith(".svg")) return url;
  const suffix = `_${size}.webp`;
  const dotIndex = url.lastIndexOf(".");
  if (dotIndex === -1) return url + suffix;
  return url.slice(0, dotIndex) + suffix;
}
