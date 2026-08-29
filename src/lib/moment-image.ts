/** 动态图片预处理：浏览器端缩放并优先转为 WebP，原始文件不会上传。 */

import { validateImageFile } from "@/lib/upload-image";
import { createImageFileFromBlob } from "@/lib/image-file";

export const MOMENT_IMAGE_MAX_EDGE = 1920;
export const MOMENT_IMAGE_WEBP_QUALITY = 0.82;
export const MOMENT_FEED_MIN_ASPECT_RATIO = 3 / 4;

interface CompressMomentImageOptions {
  signal?: AbortSignal;
}

function abortError(): DOMException {
  return new DOMException("图片处理已取消", "AbortError");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

export function validateMomentImageFile(file: File): string | null {
  const error = validateImageFile(file);
  if (error) return error;
  if (file.type === "image/gif") return "动态暂不支持动图，请上传静态图片";
  return null;
}

export function getMomentImageDimensions(width: number, height: number): {
  width: number;
  height: number;
} {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error("无法读取图片尺寸");
  }
  const scale = Math.min(1, MOMENT_IMAGE_MAX_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * 信息流保留横图、方图的真实比例；只有过长竖图收束到 3:4，避免单卡独占一列。
 */
export function getMomentFeedAspectRatio(
  width: number | null | undefined,
  height: number | null | undefined,
): number {
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height)) {
    return MOMENT_FEED_MIN_ASPECT_RATIO;
  }
  return Math.max(MOMENT_FEED_MIN_ASPECT_RATIO, width / height);
}

function canvasToPreferredImageBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size < 1) {
          reject(new Error("图片压缩失败，请更换图片后重试"));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      MOMENT_IMAGE_WEBP_QUALITY,
    );
  });
}

/**
 * 将动态图片限制在 1920px 长边并优先编码为 WebP。
 * 浏览器不支持 Canvas WebP 编码时保留其 PNG 回退格式，服务端仍会标准化为 WebP。
 * 返回的新 File 是唯一会交给上传链路的文件，原图只留在本地草稿中。
 */
export async function compressMomentImage(
  file: File,
  { signal }: CompressMomentImageOptions = {},
): Promise<File> {
  const validationError = validateMomentImageFile(file);
  if (validationError) throw new Error(validationError);
  throwIfAborted(signal);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("无法读取图片，请更换图片后重试");
  }

  try {
    throwIfAborted(signal);
    const dimensions = getMomentImageDimensions(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器不支持图片压缩");
    context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);

    const blob = await canvasToPreferredImageBlob(canvas);
    throwIfAborted(signal);
    const basename = file.name.replace(/\.[^.]+$/u, "") || "moment-image";
    return createImageFileFromBlob(blob, basename);
  } finally {
    bitmap.close();
  }
}
