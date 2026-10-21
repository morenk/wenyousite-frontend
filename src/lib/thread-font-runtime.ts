import { sharedFontResidency, onFontCapacityAvailable } from "./thread-font-shared-residency";
import { installThreadFontFace } from "./thread-font-binary";
import { threadFontNetwork } from "./thread-font-network";
import { ThreadFontSession, type FontSessionPolicy, type FontSessionResult } from "./thread-font-session";
import { IndexedDbThreadFontCache, sharedThreadFontCache, type ThreadFontAssetCache } from "./thread-font-cache";
import { normalizeTextFont } from "./markdown-text-font";
import { asset, originalAsset, threadFontManifestSchema, type FontLoadResult, type ThreadFontManifest, type ThreadFontCatalog, type ThreadFontShard, type Asset, ceilings, originalBytes, systemFamily, requiredFontShards, validatedFontBase, verifyFontBytes } from "./thread-font-protocol";
export * from "./thread-font-protocol";
/** 每个文档会话一个实例；预算不会随阅读组件卸载、路由切换或缓存删除重置。 */
export class ThreadFontRuntime {
  private limits = { ...ceilings };
  private session?: ThreadFontSession;
  private generation = 0;
  private legacyHandles = new Set<() => void>();
  private legacyRequests = new Set<AbortController>();
  get snapshot() { return this.session?.snapshot; }
  watch(catalog: ThreadFontCatalog | null | undefined, policy: FontSessionPolicy | null, fontId: string, text: string, emit: (result: FontSessionResult) => void): () => void {
    if (policy) {
      if (!this.session) {
        this.generation++;
        for (const request of this.legacyRequests) request.abort();
        for (const dispose of this.legacyHandles) dispose();
        this.legacyHandles.clear(); this.requests.clear(); this.manifests.clear(); this.faces.clear(); this.installed.clear(); this.notices.clear(); this.protectedHashes.clear();
        this.session = new ThreadFontSession(this.transport, this.cache, this.install, { scheduler: threadFontNetwork(), ...(this.options.shared ? {residency:sharedFontResidency()} : {}) });
      }
      return this.session.watch(catalog, policy, fontId, text, emit);
    }
    this.session?.invalidate();
    let alive = true;
    void this.load(catalog, fontId, text).then(result => { if (alive) emit(result); }, () => { if (alive) emit({family:systemFamily,status:"fallback"}); });
    return () => { alive = false; };
  }
  invalidate() { this.session?.invalidate(); }
  wake() { this.session?.wake(); }

  private requests = new Map<string, Promise<ArrayBuffer>>();
  private manifests = new Map<string, Promise<ThreadFontManifest>>();
  private faces = new Map<string, Promise<void>>();
  private installed = new Map<string, string[]>();
  private families = new Set<string>();
  private protectedHashes = new Set<string>();
  private notices = new Map<string, ArrayBuffer>();
  private active = 0;
  private queue: (() => void)[] = [];
  private downloadReserved = 0;
  private registeredBytes = 0;
  readonly stats = { requests: 0, downloadBytes: 0, cacheHits: 0, families: 0, faces: 0, peakConcurrent: 0, fallback: 0, originalReservedBytes: 0 };
  constructor(private readonly transport: typeof fetch = (...args) => fetch(...args), private readonly cache: ThreadFontAssetCache = new IndexedDbThreadFontCache(), private readonly install: (part: ThreadFontShard, bytes: ArrayBuffer) => Promise<void | (() => void)> = installThreadFontFace, private readonly options: {shared?: boolean} = {}) {}
  private async slot<T>(run: () => Promise<T>): Promise<T> {
    if (this.active >= this.limits.maxConcurrentDownloads) await new Promise<void>((resolve) => this.queue.push(resolve));
    else this.active++;
    this.stats.peakConcurrent = Math.max(this.stats.peakConcurrent, this.active);
    try { return await run(); } finally { const next = this.queue.shift(); if (next) next(); else this.active--; }
  }
  private getAsset(base: string, descriptor: Asset, original = false): Promise<ArrayBuffer> {
    const checked = original ? originalAsset.parse(descriptor) : asset.parse(descriptor);
    if (!original && checked.bytes > this.limits.maxAssetBytes) return Promise.reject(new Error("asset-budget"));
    const key = checked.sha256, generation = this.generation;
    let task = this.requests.get(key);
    if (!task) {
      task = (async () => {
        const cached = await this.cache.get(key);
        if (cached) {
          if (await verifyFontBytes(cached, checked)) { this.stats.cacheHits++; return cached; }
          await this.cache.delete(key);
        }
        // 在任何 await 前预留整个请求，合并并发与失败也不能越过会话上限。
        if (this.stats.requests >= this.limits.maxSessionRequests || (!original && this.downloadReserved + checked.bytes > this.limits.maxWebSessionBytes)) throw new Error("download-budget");
        this.stats.requests++;
        if (!original) this.downloadReserved += checked.bytes;
        return this.slot(async () => {
          if (generation !== this.generation) throw new Error("source-replaced");
          const abort = new AbortController(), timer = setTimeout(() => abort.abort(), this.limits.downloadTimeoutMs);
          this.legacyRequests.add(abort);
          try {
            const response = await this.transport(new URL(checked.path, base), { credentials: "omit", redirect: "error", signal: abort.signal, cache: "no-store" });
            if (!response.ok || !response.body) throw new Error("download-failed");
            const expectedMime = original ? "font/ttf" : checked.path.endsWith(".woff2") ? "font/woff2" : checked.path.endsWith(".json") ? "application/json" : "text/plain";
            if (response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== expectedMime) {
              await response.body.cancel(); throw new Error("asset-mime");
            }
            const stated = response.headers.get("content-length");
            if (stated !== null && Number(stated) !== checked.bytes) { await response.body.cancel(); throw new Error("asset-length"); }
            const reader = response.body.getReader(), chunks: Uint8Array[] = [];
            let length = 0;
            try {
              while (true) {
                const next = await reader.read(); if (next.done) break;
                length += next.value.byteLength; this.stats.downloadBytes += next.value.byteLength;
                if (length > checked.bytes) { await reader.cancel(); throw new Error("asset-length"); }
                chunks.push(next.value);
              }
            } finally { reader.releaseLock(); }
            const result = new Uint8Array(length); let offset = 0;
            for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
            if (!await verifyFontBytes(result.buffer, checked)) throw new Error("asset-integrity");
            await this.cache.put(key, result.buffer, this.limits.maxPersistentCacheBytes, this.protectedHashes);
            return result.buffer;
          } finally { clearTimeout(timer); this.legacyRequests.delete(abort); }
        });
      })();
      this.requests.set(key, task);
    }
    return task;
  }
  private manifest(catalog: ThreadFontCatalog, base: string) {
    const descriptor = asset.parse(catalog.manifest);
    if (!descriptor.path.endsWith(".json")) throw new Error("manifest-path");
    let value = this.manifests.get(descriptor.sha256);
    if (!value) {
      value = this.getAsset(base, descriptor).then((bytes) => {
        const result = threadFontManifestSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
        if (result.catalogVersion !== catalog.catalogVersion) throw new Error("catalog-version");
        for (const key of Object.keys(ceilings) as (keyof typeof ceilings)[]) this.limits[key] = Math.min(this.limits[key], result.limits[key]);
        return result;
      });
      this.manifests.set(descriptor.sha256, value);
    }
    return value;
  }
  async load(catalog: ThreadFontCatalog | null | undefined, fontId: string, text: string): Promise<FontLoadResult> {
    const family = () => [...(this.installed.get(fontId) ?? []).map((name) => '"' + name + '"'), systemFamily].join(", ");
    let available = false; const generation = this.generation;
    try {
      const base = validatedFontBase(catalog?.assetBaseUrl ?? null);
      if (!catalog || catalog.fontVersion !== 1 || !normalizeTextFont(fontId) || !base || !catalog.manifest || !text || !catalog.fonts.some((font) => font.id === fontId && font.availability === "ready")) throw new Error("unavailable");
      const manifest = await this.manifest(catalog, base);
      const font = manifest.fonts.find((item) => item.id === fontId);
      if (!font || font.availability !== "ready") throw new Error("unavailable");
      available = true;
      const parts = requiredFontShards(font.shards, text);
      if (!parts.length) throw new Error("missing-glyph");
      if (!this.families.has(fontId)) {
        if (this.families.size >= this.limits.maxSessionFamilies) throw new Error("family-budget");
        this.families.add(fontId); this.stats.families = this.families.size;
      }
      for (const notice of font.notices) {
        this.protectedHashes.add(notice.sha256);
        this.notices.set(notice.sha256, await this.getAsset(base, notice));
      }
      const results = await Promise.allSettled(parts.map((part) => {
        let face = this.faces.get(part.web.sha256);
        if (!face) {
          face = (async () => {
            const original = font.deliveryMode === "original";
            if (original) {
              // 首次下载或缓存注册前预占；失败不归还，与普通资源额度不可互借。
              if (this.stats.originalReservedBytes !== 0) throw new Error("original-budget");
              this.stats.originalReservedBytes = originalBytes;
            } else {
              if (this.registeredBytes + part.web.bytes > this.limits.maxWebSessionBytes) throw new Error("registration-budget");
              this.registeredBytes += part.web.bytes;
            }
            this.protectedHashes.add(part.web.sha256);
            const bytes = await this.getAsset(base, part.web, original);
            if (generation !== this.generation) return;
            const dispose = await this.install(part, bytes);
            if (generation !== this.generation) { dispose?.(); return; }
            if (dispose) this.legacyHandles.add(dispose);
            this.installed.set(fontId, [...(this.installed.get(fontId) ?? []), part.family]); this.stats.faces++;
          })();
          this.faces.set(part.web.sha256, face);
        }
        return face;
      }));
      const failed = results.find(result => result.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
      return { family: family(), status: "ready" };
    } catch (error) {
      this.stats.fallback++;
      // 缺字或新片失败只回退未覆盖字符，不能清掉同家族其他正文已注册的字形。
      // 目录撤下、来源清空或 manifest 不可验证时仍回到纯系统字体。
      return { family: available ? family() : systemFamily, status: "fallback", reason: error instanceof Error ? error.message : "unavailable" };
    }
  }
}
let runtime: ThreadFontRuntime | undefined;
export function threadFontRuntime() { if(!runtime){runtime=new ThreadFontRuntime(undefined,sharedThreadFontCache(),undefined,{shared:true});onFontCapacityAvailable(()=>runtime?.wake());}return runtime; }
