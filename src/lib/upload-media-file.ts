/** 仅向预签名对象存储 URL 直传，不携带 API 认证头。 */
export function putMediaFile(
  uploadUrl: string,
  file: File,
  signal: AbortSignal | undefined,
  timeoutMs: number,
  onProgress?: (loadedBytes: number, totalBytes: number) => void,
  timeoutMessage = "上传超时，请检查网络后重试",
): Promise<void> {
  signal?.throwIfAborted();
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
      finish(() => reject(new Error(timeoutMessage)));
    });
    request.addEventListener("abort", () => {
      finish(() => reject(new DOMException("上传已取消", "AbortError")));
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
