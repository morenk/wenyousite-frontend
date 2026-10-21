import type { ThreadFontAssetCache } from "./thread-font-cache";
import { FontDownloadScheduler } from "./thread-font-scheduler";
export interface FontAssetDescriptor { path: string; sha256: string; bytes: number }
export class FontResourceError extends Error {
  constructor(message: string, readonly retryAt?: number) { super(message); }
}
interface InFlight { promise: Promise<ArrayBuffer>; abort: AbortController; users: number }
interface Failure { attempts: number; error: FontResourceError }
/** 一个已校验目录代次内的传输：共享进行中请求，settle 后不保留二进制 Promise。 */
export class FontAssetLoader {
  private pending = new Map<string, InFlight>();
  private failures = new Map<string, Failure>();
  private disposed = false;
  readonly stats = { requests: 0, downloadBytes: 0, cacheHits: 0, bufferedBytes: 0, peakBufferedBytes: 0 };
  constructor(private readonly options: {
    base: string; transport: typeof fetch; cache: ThreadFontAssetCache; scheduler: FontDownloadScheduler;
    timeoutMs: number; cacheBytes: number; retryBaseMs: number; retryMaxMs: number;
    verify: (bytes: ArrayBuffer, descriptor: FontAssetDescriptor) => Promise<boolean>;
    protectedHashes: () => ReadonlySet<string>; random?: () => number;
  }) {}
  get snapshot() { return { inFlight: this.pending.size, failures: this.failures.size, ...this.stats }; }
  quarantine(hash: string, reason: string) { this.failures.set(hash, { attempts: 1, error: new FontResourceError(reason) }); }
  dispose() { this.disposed = true; for (const task of this.pending.values()) task.abort.abort(); this.failures.clear(); }
  get(descriptor: FontAssetDescriptor, signal: AbortSignal, original = false): Promise<ArrayBuffer> {
    if (this.disposed || signal.aborted) return Promise.reject(new DOMException("Demand released", "AbortError"));
    const failed = this.failures.get(descriptor.sha256);
    if (failed && (failed.error.retryAt === undefined || failed.error.retryAt > performance.now())) return Promise.reject(failed.error);
    let current = this.pending.get(descriptor.sha256);
    if (current?.abort.signal.aborted) current = undefined;
    if (!current) {
      const abort = new AbortController();
      current = { abort, users: 0, promise: Promise.resolve(new ArrayBuffer(0)) };
      const entry = current;
      current.promise = this.read(descriptor, abort.signal, original).then(bytes => {
        this.failures.delete(descriptor.sha256); return bytes;
      }).catch(error => {
        if (abort.signal.aborted || this.disposed) throw new DOMException("Demand released", "AbortError");
        const attempts = (failed?.attempts ?? 0) + 1;
        const ceiling = Math.min(this.options.retryMaxMs, this.options.retryBaseMs * 2 ** Math.min(attempts - 1, 20));
        const retryAt = performance.now() + Math.floor((ceiling + 1) * Math.min(0.999999999, (this.options.random ?? Math.random)()));
        const failure = error instanceof FontResourceError && error.retryAt === undefined ? error
          : new FontResourceError("network", Math.max(retryAt, error instanceof FontResourceError ? error.retryAt ?? 0 : 0));
        this.failures.set(descriptor.sha256, { attempts, error: failure }); throw failure;
      }).finally(() => { if (this.pending.get(descriptor.sha256) === entry) this.pending.delete(descriptor.sha256); });
      this.pending.set(descriptor.sha256, current);
    }
    const entry = current; entry.users++;
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: unknown, bytes?: ArrayBuffer) => {
        if (settled) return; settled = true; signal.removeEventListener("abort", abort);
        if (--entry.users === 0) entry.abort.abort();
        if (error) reject(error); else resolve(bytes!);
      };
      const abort = () => finish(new DOMException("Demand released", "AbortError"));
      signal.addEventListener("abort", abort, { once: true });
      entry.promise.then(bytes => finish(undefined, bytes), error => finish(error));
    });
  }
  private async read(descriptor: FontAssetDescriptor, signal: AbortSignal, original: boolean) {
    const { cache, verify, scheduler } = this.options;
    const check = () => { if (signal.aborted) throw new DOMException("Demand released", "AbortError"); };
    let cached = await cache.get(descriptor.sha256); check();
    if (cached) {
      if (await verify(cached, descriptor)) { check(); this.stats.cacheHits++; return cached; }
      await cache.delete(descriptor.sha256); cached = null; check();
    }
    return scheduler.run(descriptor.bytes, original, signal, async () => {
      check(); this.stats.requests++;
      const controller = new AbortController();
      const abort = () => controller.abort(); signal.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(abort, this.options.timeoutMs);
      let buffered = 0;
      const hold = (bytes: number) => { buffered += bytes; this.stats.bufferedBytes += bytes; this.stats.peakBufferedBytes = Math.max(this.stats.peakBufferedBytes, this.stats.bufferedBytes); };
      try {
        const response = await this.options.transport(new URL(descriptor.path, this.options.base), { credentials: "omit", redirect: "error", signal: controller.signal, cache: "no-store" });
        if (!response.ok || !response.body) {
          await response.body?.cancel();
          if ([408, 429, 500, 502, 503, 504].includes(response.status)) {
            const retry = response.headers.get("retry-after");
            if (retry) {
              const at = /^\d+$/u.test(retry) ? performance.now() + Number(retry) * 1000 : performance.now() + Math.max(0, Date.parse(retry) - Date.now());
              if (Number.isFinite(at) && at > performance.now()) throw new FontResourceError("network", at);
            }
            throw new Error("temporary-http");
          }
          throw new FontResourceError("asset-http");
        }
        const mime = original ? "font/ttf" : descriptor.path.endsWith(".woff2") ? "font/woff2" : descriptor.path.endsWith(".json") ? "application/json" : "text/plain";
        if (response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== mime) { await response.body.cancel(); throw new FontResourceError("asset-mime"); }
        const length = response.headers.get("content-length");
        if (length !== null && Number(length) !== descriptor.bytes) { await response.body.cancel(); throw new FontResourceError("asset-length"); }
        const reader = response.body.getReader(), chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            check(); const next = await reader.read(); if (next.done) break;
            size += next.value.byteLength; this.stats.downloadBytes += next.value.byteLength;
            if (size > descriptor.bytes) { await reader.cancel(); throw new FontResourceError("asset-length"); }
            chunks.push(next.value); hold(next.value.byteLength);
          }
        } finally { reader.releaseLock(); }
        const result = new Uint8Array(size); hold(size); let offset = 0;
        for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
        chunks.length = 0; hold(-size);
        if (!await verify(result.buffer, descriptor)) throw new FontResourceError("asset-integrity");
        check(); await cache.put(descriptor.sha256, result.buffer, this.options.cacheBytes, this.options.protectedHashes()); check();
        return result.buffer;
      } finally { hold(-buffered); clearTimeout(timer); signal.removeEventListener("abort", abort); }
    });
  }
}
