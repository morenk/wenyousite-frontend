import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import catalogSource from "../../../contracts/thread-font-catalog-v1.json";
import { ThreadFontRuntime, threadFontManifestSchema, type ThreadFontCatalog } from "../thread-font-runtime";
import type { ThreadFontAssetCache } from "../thread-font-cache";

const manifestSource = JSON.parse(readFileSync("contracts/thread-font-manifest-v1.json", "utf8"));
const original = manifestSource.fonts.find((font: { id: string }) => font.id === "xiaocheng-lafeng");
const originalDescriptor = original.shards[0].web;
const budgetSchema = JSON.parse(readFileSync("contracts/thread-font-manifest-v1.schema.json", "utf8")).properties.fonts.items.oneOf[0].properties.budgetException.const;
const encode = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;
beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => vi.restoreAllMocks());

class MemoryCache implements ThreadFontAssetCache {
  values = new Map<string, ArrayBuffer>();
  async get(hash: string) { return this.values.get(hash) ?? null; }
  async put(hash: string, bytes: ArrayBuffer) { this.values.set(hash, bytes); }
  async delete(hash: string) { this.values.delete(hash); }
}

async function fixture() {
  const assets = new Map<string, ArrayBuffer>();
  const add = async (bytes: ArrayBuffer, extension: string) => {
    const sha256 = Buffer.from(await webcrypto.subtle.digest("SHA-256", bytes)).toString("hex");
    const result = { path: `fonts/v1/${sha256}.${extension}`, sha256, bytes: bytes.byteLength };
    assets.set(result.path, bytes); return result;
  };
  const notices = [await add(encode("synthetic license"), "txt"), await add(encode("{}"), "json")];
  const small = { ...await add(new ArrayBuffer(64), "woff2"), format: "woff2", contentType: "font/woff2" };
  const other = { id: "wenkai", availability: "ready", deliveryMode: "subset", license: "OFL-1.1", baseWeight: 400, baseStyle: "normal", notices, shards: [{ id: "core", family: "WYF1-0000000000000000-core", unicodeRanges: ["U+0041"], web: small }] };
  const manifest = { ...manifestSource, limits: { ...manifestSource.limits, maxWebSessionBytes: 200000 }, fonts: [{ ...original, notices }, other] };
  const descriptor = await add(encode(JSON.stringify(manifest)), "json");
  const catalog = { fontVersion: 1, catalogVersion: manifestSource.catalogVersion, fonts: catalogSource.fonts, assetBaseUrl: "https://assets.wenyou.site/", manifest: descriptor } as ThreadFontCatalog;
  // 只替换合成大载荷的摘要以测试额度，不把测试字节当作真实字体；真实解码另由离线浏览器验收。
  const digest = webcrypto.subtle.digest.bind(webcrypto.subtle);
  vi.spyOn(webcrypto.subtle, "digest").mockImplementation(async (algorithm, data) => {
    if (data.byteLength === originalDescriptor.bytes && new Uint8Array(data as ArrayBuffer)[0] === 0) {
      return Uint8Array.from(Buffer.from(originalDescriptor.sha256, "hex")).buffer;
    }
    return digest(algorithm, data);
  });
  assets.set(originalDescriptor.path, new ArrayBuffer(originalDescriptor.bytes));
  const transport = vi.fn<typeof fetch>(async input => {
    const path = new URL(String(input)).pathname.slice(1);
    return new Response(assets.get(path)!, { headers: { "content-type": path.endsWith(".ttf") ? "font/ttf" : path.endsWith(".woff2") ? "font/woff2" : path.endsWith(".json") ? "application/json" : "text/plain" } });
  });
  const cache = new MemoryCache(), install = vi.fn(async () => {});
  return { assets, manifest, catalog, transport, cache, install, runtime: new ThreadFontRuntime(transport, cache, install) };
}

test("固定原件例外与正式schema一致，普通资源上限保持不变", () => {
  const parsed = threadFontManifestSchema.parse(manifestSource);
  const font = parsed.fonts.find(font => font.id === "xiaocheng-lafeng");
  expect(font).toMatchObject({ deliveryMode: "original", budgetException: budgetSchema });
  expect(parsed.limits).toMatchObject({ maxAssetBytes: 6291456, maxWebSessionBytes: 16777216 });
});

test.each(["id", "hash", "bytes", "allowance", "missing", "mime", "format", "mode", "notice"])("%s不能伪造或扩大原件额度", change => {
  const font = structuredClone(original);
  if (change === "id") font.id = "wenkai";
  if (change === "hash") font.shards[0].web.sha256 = "0".repeat(64);
  if (change === "bytes") font.shards[0].web.bytes++;
  if (change === "allowance") font.budgetException.additionalSessionBytes++;
  if (change === "missing") delete font.budgetException;
  if (change === "mime") font.shards[0].web.contentType = "application/octet-stream";
  if (change === "format") font.shards[0].web.format = "woff2";
  if (change === "mode") font.deliveryMode = "future";
  if (change === "notice") font.notices.push(font.shards[0].web);
  expect(threadFontManifestSchema.safeParse({ ...manifestSource, fonts: [font] }).success).toBe(false);
});

test("原件下载前预占独立额度，并发重复调用只下载注册一次", async () => {
  const f = await fixture();
  const send = f.transport.getMockImplementation()!;
  f.transport.mockImplementation(async (...args) => {
    if (String(args[0]).endsWith(".ttf")) expect(f.runtime.stats.originalReservedBytes).toBe(originalDescriptor.bytes);
    return send(...args);
  });
  const results = await Promise.all(Array.from({ length: 3 }, () => f.runtime.load(f.catalog, original.id, "中文A")));
  expect(results.every(result => result.status === "ready")).toBe(true);
  expect(f.install).toHaveBeenCalledTimes(1);
  expect(f.transport.mock.calls.filter(([input]) => String(input).endsWith(".ttf"))).toHaveLength(1);
  expect(f.runtime.stats).toMatchObject({ families: 1, faces: 1, originalReservedBytes: originalDescriptor.bytes });
  expect((await f.runtime.load(f.catalog, "wenkai", "A")).status).toBe("ready");
});

test("缓存原件首次注册也预占独立额度，重读复用且不下载", async () => {
  const f = await fixture(); f.cache.values.set(originalDescriptor.sha256, f.assets.get(originalDescriptor.path)!);
  f.install.mockImplementation(async () => { expect(f.runtime.stats.originalReservedBytes).toBe(originalDescriptor.bytes); });
  for (let i = 0; i < 2; i++) expect((await f.runtime.load(f.catalog, original.id, "中文A")).status).toBe("ready");
  expect(f.install).toHaveBeenCalledTimes(1); expect(f.runtime.stats.cacheHits).toBe(1);
  expect(f.transport.mock.calls.some(([input]) => String(input).endsWith(".ttf"))).toBe(false);
});

test.each(["network", "decode", "mime", "integrity"])("原件%s失败不返还额度或重试，也不修改fontId", async mode => {
  const f = await fixture(), send = f.transport.getMockImplementation()!;
  if (mode === "decode") f.install.mockRejectedValue(new Error("decode"));
  if (mode === "integrity") new Uint8Array(f.assets.get(originalDescriptor.path)!)[0] = 1;
  f.transport.mockImplementation(async (...args) => {
    if (String(args[0]).endsWith(".ttf")) {
      if (mode === "network") throw new Error("offline");
      if (mode === "mime") return new Response("wrong MIME", { headers: { "content-type": "text/plain" } });
    }
    return send(...args);
  });
  for (let i = 0; i < 2; i++) expect((await f.runtime.load(f.catalog, original.id, "中文A")).status).toBe("fallback");
  expect(f.transport.mock.calls.filter(([input]) => String(input).endsWith(".ttf"))).toHaveLength(1);
  expect(f.runtime.stats.originalReservedBytes).toBe(originalDescriptor.bytes);
  expect(f.catalog.fonts.find(font => font.id === original.id)?.id).toBe("xiaocheng-lafeng");
});

test("其他字体不能借用未消费的原件额度", async () => {
  const f = await fixture();
  const manifest = structuredClone(f.manifest);
  const other = manifest.fonts.find((font: { id: string }) => font.id === "wenkai")!;
  other.shards[0].web.bytes = 250000;
  const bytes = encode(JSON.stringify(manifest));
  const sha256 = Buffer.from(await webcrypto.subtle.digest("SHA-256", bytes)).toString("hex");
  const descriptor = { path: `fonts/v1/${sha256}.json`, sha256, bytes: bytes.byteLength };
  f.assets.set(descriptor.path, bytes);
  const result = await f.runtime.load({ ...f.catalog, manifest: descriptor }, "wenkai", "A");
  expect(result.reason).toBe("registration-budget");
  expect(f.runtime.stats.originalReservedBytes).toBe(0); expect(f.install).not.toHaveBeenCalled();
});
