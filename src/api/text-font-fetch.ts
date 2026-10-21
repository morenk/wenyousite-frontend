import { threadFontNetwork } from "@/lib/thread-font-network";
import { FontMetadataError, fontMetadataHttpError } from "./hooks/text-font-recovery";
export const FONT_METADATA_BYTES = 65536;
/** apiClient 专用公开元数据传输；流式上限也覆盖错误响应，不保留身份或可写会话。 */
export function fetchTextFontMetadata(request: Request, transport: typeof fetch = (...args) => fetch(...args)) {
  return threadFontNetwork().run(FONT_METADATA_BYTES, false, request.signal, async () => {
    const controller = new AbortController();
    const abort = () => controller.abort(request.signal.reason);
    request.signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(new DOMException("Metadata timeout", "TimeoutError")), 15000);
    try {
      const headers = new Headers(request.headers); headers.delete("Authorization");
      const response = await transport(new Request(request, { headers, signal: controller.signal, credentials: "omit", redirect: "error" }));
      if (!response.body) return response;
      const length = response.headers.get("content-length");
      if (length !== null && Number(length) > FONT_METADATA_BYTES) { await response.body.cancel(); throw new FontMetadataError(false); }
      const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) {
          const next = await reader.read(); if (next.done) break;
          size += next.value.byteLength;
          if (size > FONT_METADATA_BYTES) { await reader.cancel(); throw new FontMetadataError(false); }
          chunks.push(next.value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      if (controller.signal.aborted) throw controller.signal.reason;
      // 网关可能返回 HTML 错误页；先按 HTTP 分类，避免 JSON 解析掩盖暂时故障。
      if (!response.ok) { const error = fontMetadataHttpError(response); if (error.retryable) throw error; }
      return new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch (error) { if (controller.signal.aborted) throw controller.signal.reason; throw error; }
    finally { clearTimeout(timer); request.signal.removeEventListener("abort", abort); }
  });
}
