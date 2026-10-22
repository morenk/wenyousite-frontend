import runtimePolicy from "../../contracts/thread-font-runtime-policy-v2.json";
import { FontTransferTimeout, type FontTransferTimeoutPolicy } from "@/lib/thread-font-transfer-timeout";
import { threadFontNetwork } from "@/lib/thread-font-network";
import { FontMetadataError, fontMetadataHttpError } from "./hooks/text-font-recovery";
export const FONT_METADATA_BYTES = 65536;
const metadataTimeout: FontTransferTimeoutPolicy = { mode: "progress", firstByteMs: runtimePolicy.web.network.timeoutMs, idleMs: runtimePolicy.web.network.timeoutMs, maxDurationMs: runtimePolicy.web.network.maxTransferMs };
/** apiClient 专用公开元数据传输；流式上限也覆盖错误响应，不保留身份或可写会话。 */
export function fetchTextFontMetadata(request: Request, transport: typeof fetch = (...args) => fetch(...args), timeoutPolicy: FontTransferTimeoutPolicy = metadataTimeout) {
  return threadFontNetwork().run(FONT_METADATA_BYTES, false, request.signal, async () => {
    const timeout = new FontTransferTimeout(timeoutPolicy, request.signal);
    try {
      const headers = new Headers(request.headers); headers.delete("Authorization");
      const response = await transport(new Request(request, { headers, signal: timeout.signal, credentials: "omit", redirect: "error" }));
      timeout.check();
      // HTTP 分类在响应头到达时确定；错误正文不能靠持续数据拖延拒绝。
      if (response.status === 304) return response;
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 404 && new URL(request.url).pathname.endsWith("/meta/text-fonts/runtime-policy")) return new Response(null, { status: 404, headers: response.headers });
        throw fontMetadataHttpError(response);
      }
      if (!response.body) return response;
      const length = response.headers.get("content-length");
      if (length !== null && Number(length) > FONT_METADATA_BYTES) { await response.body.cancel(); throw new FontMetadataError(false); }
      const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      const cancel = () => { void reader.cancel().catch(() => {}); };
      timeout.signal.addEventListener("abort", cancel, { once: true });
      try {
        while (true) {
          timeout.check(); const next = await reader.read(); timeout.check(); if (next.done) break;
          size += next.value.byteLength;
          if (size > FONT_METADATA_BYTES) { await reader.cancel(); throw new FontMetadataError(false); }
          timeout.bytesReceived(next.value.byteLength);
          chunks.push(next.value);
        }
      } finally {
        timeout.signal.removeEventListener("abort", cancel);
        if (timeout.signal.aborted) await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      timeout.complete();
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      timeout.check();
      return new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch (error) { timeout.check(); throw error; }
    finally { timeout.complete(); }
  });
}
