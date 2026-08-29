/** 将浏览器图片编码结果转换为 MIME、扩展名与实际字节一致的 File。 */

const IMAGE_FILE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type EncodedImageMimeType = keyof typeof IMAGE_FILE_EXTENSIONS;

function normalizeMimeType(type: string): string {
  return type.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

/**
 * Canvas 在不支持请求的编码格式时可以回退为 PNG。必须保留 Blob 实际返回的
 * MIME，而不能按请求格式强制标记，否则服务端会正确拒绝 MIME 与字节不一致的文件。
 */
export function createImageFileFromBlob(
  blob: Blob,
  filename: string,
  lastModified = Date.now(),
): File {
  const mimeType = normalizeMimeType(blob.type);
  const extension = IMAGE_FILE_EXTENSIONS[mimeType as EncodedImageMimeType];
  if (!extension || blob.size < 1) {
    throw new Error("图片编码失败，请更新浏览器或更换图片后重试");
  }

  const stem = filename.replace(/\.[^.]*$/u, "") || "image";
  return new File([blob], `${stem}.${extension}`, {
    type: mimeType,
    lastModified,
  });
}
