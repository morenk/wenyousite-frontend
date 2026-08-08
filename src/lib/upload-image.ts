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

interface UploadImageOptions {
  signal?: AbortSignal;
  /** 单次对象存储直传的最长等待时间。 */
  timeoutMs?: number;
  onStage?: (stage: UploadImageStage) => void;
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

async function putImageFile(
  uploadUrl: string,
  file: File,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<void> {
  throwIfUploadAborted(signal);
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("上传失败，请检查网络后重试");
  } catch (error) {
    if (signal?.aborted) throw createUploadAbortError();
    if (timedOut) throw new Error("图片上传超时，请检查网络后重试");
    if (isUploadAbortError(error)) throw createUploadAbortError();
    if (error instanceof Error && error.message === "上传失败，请检查网络后重试") {
      throw error;
    }
    throw new Error("上传失败，请检查网络后重试");
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

export async function uploadImageFile(
  file: File,
  options: UploadImageOptions = {},
): Promise<UploadedImage> {
  const validationError = validateImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const { signal, timeoutMs = DIRECT_UPLOAD_TIMEOUT_MS, onStage } = options;
  throwIfUploadAborted(signal);

  // 1. 获取预签名 URL
  try {
    onStage?.("preparing");
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

    // 2. 直传 S3。浏览器 fetch 默认没有超时，必须允许用户取消并设置上限。
    onStage?.("uploading");
    await putImageFile(upload.uploadUrl, file, signal, timeoutMs);
    throwIfUploadAborted(signal);

    // 3. 确认上传完成
    onStage?.("processing");
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
export async function uploadImage(file: File): Promise<string> {
  const result = await uploadImageFile(file);
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
