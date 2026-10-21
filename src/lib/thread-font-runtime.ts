import { z } from "zod";
import type { components } from "@/api/types";
import { normalizeTextFont } from "@/lib/markdown-text-font";
import { IndexedDbThreadFontCache, type ThreadFontAssetCache } from "./thread-font-cache";

export type ThreadFontCatalog = components["schemas"]["TextFontCatalogDto"];
const hash = z.string().regex(/^[a-f0-9]{64}$/u);
const asset = z.object({ path: z.string().regex(/^fonts\/v1\/[a-f0-9]{64}\.(?:woff2|ttf|otf|json|txt)$/u), sha256: hash, bytes: z.number().int().positive().max(6 * 1024 * 1024) }).refine((a) => a.path.split("/").at(-1)?.split(".")[0] === a.sha256);
// 来自已提交 manifest schema 的唯一原件例外；回归与契约完整对象比较，不能由远端扩大。
const originalHash = "cf4a4215e562d6de6e3ee88f25fc5d47d77668d28eb3a0f2533c7290de307423";
const originalBytes = 18410600;
const originalAsset = z.object({ path: z.literal(`fonts/v1/${originalHash}.ttf`), sha256: z.literal(originalHash), bytes: z.literal(originalBytes), format: z.literal("ttf"), contentType: z.literal("font/ttf") });
const originalBudget = z.object({ kind: z.literal("original-source"), assetSha256: z.literal(originalHash), assetBytes: z.literal(originalBytes), additionalSessionBytes: z.literal(originalBytes) }).strict();
const ranges = z.array(z.string().regex(/^U\+[0-9A-F]{4,6}(?:-[0-9A-F]{4,6})?$/u)).max(100000).refine((items) => items.every((range) => {
  const [from, to = from] = range.slice(2).split("-").map((v) => parseInt(v, 16));
  return from! <= to! && to! <= 0x10ffff;
}));
const shard = z.object({ id: z.string().regex(/^(?:core|u[0-9a-f]{6})$/u), family: z.string().regex(/^WYF1-[0-9a-f]{16}-(?:core|u[0-9a-f]{6})$/u), unicodeRanges: ranges, web: asset.refine((a) => a.path.endsWith(".woff2")).and(z.object({ format: z.literal("woff2"), contentType: z.literal("font/woff2") })) });
const originalShard = z.object({ id: z.literal("original"), family: z.literal(`WYF1-${originalHash.slice(0, 16)}-original`), unicodeRanges: ranges, web: originalAsset });
const readyBase = z.object({ id: z.string().refine((id) => !!normalizeTextFont(id)), availability: z.literal("ready"), baseWeight: z.literal(400), baseStyle: z.literal("normal"), notices: z.array(asset).min(2).max(16) });
const readyFont = z.discriminatedUnion("deliveryMode", [
  readyBase.extend({ deliveryMode: z.literal("subset"), id: z.string().refine((id) => !!normalizeTextFont(id) && id !== "xiaocheng-lafeng"), license: z.enum(["OFL-1.1", "Apache-2.0"]), budgetException: z.never().optional(), shards: z.array(shard).min(1).max(1024) }),
  readyBase.extend({ deliveryMode: z.literal("original"), id: z.literal("xiaocheng-lafeng"), license: z.literal("LicenseRef-ProjectAuthorization"), fontSha256: z.literal(originalHash), budgetException: originalBudget, shards: z.array(originalShard).length(1) }),
]);
export const threadFontManifestSchema = z.object({
  schemaVersion: z.literal(1), fontVersion: z.literal(1), catalogVersion: z.string(),
  limits: z.object({ maxConcurrentDownloads: z.number().int().positive(), maxSessionFamilies: z.number().int().positive(), maxSessionRequests: z.number().int().positive(), maxWebSessionBytes: z.number().int().positive(), maxPersistentCacheBytes: z.number().int().positive(), downloadTimeoutMs: z.number().int().positive(), maxAssetBytes: z.number().int().positive() }),
  fonts: z.array(z.union([readyFont, z.object({ id: z.string(), availability: z.literal("pendingSource"), shards: z.array(z.unknown()).length(0) })])).max(100),
});
export type ThreadFontManifest = z.infer<typeof threadFontManifestSchema>;
export type ThreadFontShard = z.infer<typeof shard> | z.infer<typeof originalShard>;
type Asset = z.infer<typeof asset> | z.infer<typeof originalAsset>;
const ceilings = { maxConcurrentDownloads: 2, maxSessionFamilies: 8, maxSessionRequests: 64, maxWebSessionBytes: 16 * 1024 * 1024, maxPersistentCacheBytes: 64 * 1024 * 1024, downloadTimeoutMs: 15000, maxAssetBytes: 6 * 1024 * 1024 };
export function rangesContain(ranges: readonly string[], codepoint: number): boolean {
  return ranges.some((range) => { const [start, end = start] = range.slice(2).split("-").map((v) => parseInt(v, 16)); return codepoint >= start! && codepoint <= end!; });
}
export function requiredFontShards(shards: readonly ThreadFontShard[], text: string) {
  const points = [...new Set(Array.from(text, (letter) => letter.codePointAt(0)!))];
  return shards.filter((part) => points.some((point) => rangesContain(part.unicodeRanges, point)));
}
export function validatedFontBase(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !url.pathname.endsWith("/")) return null;
    // 后端运营配置只能把客户端引向站点自有字体来源，不能变成任意第三方资源代理。
    if (url.hostname !== "wenyou.site" && !url.hostname.endsWith(".wenyou.site")) return null;
    return url.href;
  } catch { return null; }
}
export async function verifyFontBytes(bytes: ArrayBuffer, descriptor: Asset): Promise<boolean> {
  if (bytes.byteLength !== descriptor.bytes) return false;
  const actual = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
  return actual === descriptor.sha256;
}
export type FontLoadResult = { family: string; status: "ready" | "fallback"; reason?: string };
const systemFamily = "var(--wenyou-font-body-family, system-ui)";

/** 每个文档会话一个实例；预算不会随阅读组件卸载、路由切换或缓存删除重置。 */
export class ThreadFontRuntime {
  private limits = { ...ceilings };
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
  constructor(private readonly transport: typeof fetch = (...args) => fetch(...args), private readonly cache: ThreadFontAssetCache = new IndexedDbThreadFontCache(), private readonly install: (part: ThreadFontShard, bytes: ArrayBuffer) => Promise<void> = async (part, bytes) => {
    const face = new FontFace(part.family, bytes, { unicodeRange: part.unicodeRanges.join(","), weight: "400", style: "normal", display: "swap" });
    await face.load(); document.fonts.add(face);
  }) {}
  private async slot<T>(run: () => Promise<T>): Promise<T> {
    if (this.active >= this.limits.maxConcurrentDownloads) await new Promise<void>((resolve) => this.queue.push(resolve));
    else this.active++;
    this.stats.peakConcurrent = Math.max(this.stats.peakConcurrent, this.active);
    try { return await run(); } finally { const next = this.queue.shift(); if (next) next(); else this.active--; }
  }
  private getAsset(base: string, descriptor: Asset, original = false): Promise<ArrayBuffer> {
    const checked = original ? originalAsset.parse(descriptor) : asset.parse(descriptor);
    if (!original && checked.bytes > this.limits.maxAssetBytes) return Promise.reject(new Error("asset-budget"));
    const key = checked.sha256;
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
          const abort = new AbortController(), timer = setTimeout(() => abort.abort(), this.limits.downloadTimeoutMs);
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
          } finally { clearTimeout(timer); }
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
    try {
      const base = validatedFontBase(catalog?.assetBaseUrl ?? null);
      if (!catalog || catalog.fontVersion !== 1 || !normalizeTextFont(fontId) || !base || !catalog.manifest || !text || !catalog.fonts.some((font) => font.id === fontId && font.availability === "ready")) throw new Error("unavailable");
      const manifest = await this.manifest(catalog, base);
      const font = manifest.fonts.find((item) => item.id === fontId);
      if (!font || font.availability !== "ready") throw new Error("unavailable");
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
      await Promise.all(parts.map((part) => {
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
            await this.install(part, bytes);
            this.installed.set(fontId, [...(this.installed.get(fontId) ?? []), part.family]); this.stats.faces++;
          })();
          this.faces.set(part.web.sha256, face);
        }
        return face;
      }));
      return { family: family(), status: "ready" };
    } catch (error) {
      this.stats.fallback++;
      return { family: systemFamily, status: "fallback", reason: error instanceof Error ? error.message : "unavailable" };
    }
  }
}
let runtime: ThreadFontRuntime | undefined;
export function threadFontRuntime() { return runtime ??= new ThreadFontRuntime(); }
