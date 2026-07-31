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

interface UploadUrlResponse {
  code: number;
  message: string;
  data: {
    uploadUrl: string;
    mediaId: string;
    publicUrl: string;
  };
}

interface MediaStatusResponse {
  code: number;
  message: string;
  data: {
    id: string;
    status: "UPLOADING" | "PROCESSING" | "COMPLETED" | "FAILED";
    url: string;
  };
}

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
    return "仅支持 jpg/png/gif/webp/avif/svg 格式";
  }
  if (file.size > 10 * 1024 * 1024) {
    return "图片大小不能超过 10MB";
  }
  return null;
}

export async function uploadImage(file: File): Promise<string> {
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
  if (urlError) throw urlError;

  const urlRes = urlData as unknown as UploadUrlResponse;
  if (urlRes.code !== 0) {
    throw new Error(urlRes.message || "获取上传地址失败");
  }

  // 2. 直传 S3
  const putRes = await fetch(urlRes.data.uploadUrl, {
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
      body: { mediaId: urlRes.data.mediaId },
    },
  );
  if (doneError) throw doneError;

  const doneRes = doneData as unknown as MediaStatusResponse;
  if (doneRes.code !== 0) {
    throw new Error(doneRes.message || "文件确认失败");
  }

  // 4. 轮询处理状态
  await new Promise((resolve) => setTimeout(resolve, 500));
  for (let i = 0; i < 30; i++) {
    const { data: statusData, error: statusError } = await apiClient.GET(
      "/api/v1/media/{id}",
      {
        params: { path: { id: urlRes.data.mediaId } },
      },
    );
    if (statusError) throw statusError;

    const statusRes = statusData as unknown as MediaStatusResponse;
    if (statusRes.code !== 0) {
      throw new Error(statusRes.message || "查询图片状态失败");
    }

    if (statusRes.data.status === "COMPLETED") {
      return statusRes.data.url;
    }
    if (statusRes.data.status === "FAILED") {
      throw new Error("图片处理失败，请重新上传");
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("图片处理超时，请稍后刷新查看");
}

export function getImageUrlBySize(url: string, size: "md" | "thumb"): string {
  if (url.endsWith(".svg")) return url;
  const suffix = size === "md" ? "_md.webp" : "_thumb.webp";
  const dotIndex = url.lastIndexOf(".");
  if (dotIndex === -1) return url + suffix;
  return url.slice(0, dotIndex) + suffix;
}
