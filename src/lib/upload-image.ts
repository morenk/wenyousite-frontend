/** 编辑器图片上传工具：预签名 URL → S3 直传 → 确认 → 轮询 */

import { apiClient } from "@/api/client";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/svg+xml",
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
    return "仅支持 jpg/png/gif/webp/avif/svg 格式";
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
  if (file.size > 10 * 1024 * 1024) {
    return "图片大小不能超过 10MB";
  }
  return null;
}

interface UploadedImage {
  url: string;
  mediaId: string;
}

export async function uploadImageFile(file: File): Promise<UploadedImage> {
  const validationError = validateImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  // 1. 获取预签名 URL
  const { data: urlData, error: urlError } = await apiClient.POST(
    "/api/v1/media/upload-url",
    {
      body: {
        filename: file.name,
        contentType: file.type as AllowedMimeType,
        size: file.size,
      },
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

  // 2. 直传 S3
  const putRes = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error("上传失败，请检查网络后重试");
  }

  // 3. 确认上传完成
  const { data: doneData, error: doneError } = await apiClient.POST(
    "/api/v1/media/upload-done",
    {
      body: { mediaId: upload.mediaId },
    },
  );
  if (doneError) throw doneError;

  if (!doneData) throw new Error("文件确认失败");

  // 4. 轮询处理状态
  await new Promise((resolve) => setTimeout(resolve, 500));
  for (let i = 0; i < 30; i++) {
    const { data: statusData, error: statusError } = await apiClient.GET(
      "/api/v1/media/{id}",
      {
        params: { path: { id: upload.mediaId } },
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

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("图片处理超时，请稍后刷新查看");
}

/** 编辑器图片上传：仅返回公开 URL */
export async function uploadImage(file: File): Promise<string> {
  const result = await uploadImageFile(file);
  return result.url;
}

export function getImageUrlBySize(url: string, size: "md" | "thumb"): string {
  if (url.endsWith(".svg")) return url;
  const suffix = size === "md" ? "_md.webp" : "_thumb.webp";
  const dotIndex = url.lastIndexOf(".");
  if (dotIndex === -1) return url + suffix;
  return url.slice(0, dotIndex) + suffix;
}
