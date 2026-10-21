import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeAll, expect, test, vi } from "vitest";
import { ThreadFontRuntime, requiredFontShards, rangesContain, validatedFontBase, verifyFontBytes, threadFontManifestSchema, type ThreadFontCatalog } from "../thread-font-runtime";
import type { ThreadFontAssetCache } from "../thread-font-cache";
import catalogSource from "../../../contracts/thread-font-catalog-v1.json";
beforeAll(() => vi.stubGlobal("crypto", webcrypto));
const encode = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;
async function descriptor(text: string, extension = "woff2") {
 const bytes=encode(text); const sha256=Buffer.from(await webcrypto.subtle.digest("SHA-256",bytes)).toString("hex");
 return {bytes:bytes.byteLength,sha256,path:`fonts/v1/${sha256}.${extension}`};
}
class MemoryCache implements ThreadFontAssetCache {
 values=new Map<string,ArrayBuffer>(); deleted:string[]=[];
 async get(hash:string){return this.values.get(hash)??null}
 async put(hash:string,bytes:ArrayBuffer){this.values.set(hash,bytes)}
 async delete(hash:string){this.deleted.push(hash);this.values.delete(hash)}
}
async function fixture(limits: Record<string,number>={}, count=1) {
 const assets=new Map<string,ArrayBuffer>();
 const add=async(text:string,ext?:string)=>{const d=await descriptor(text,ext);assets.set(d.path,encode(text));return d};
 const notice=await add("license","txt"), attribution=await add("attribution","json");
 const fonts=await Promise.all(catalogSource.fonts.filter(f=>f.availability==="ready").slice(0,count).map(async(f,i)=>({...f,baseWeight:400,baseStyle:"normal",deliveryMode:"subset",license:"OFL-1.1",notices:[notice,attribution],shards:[{id:"core",family:`WYF1-${String(i).padStart(16,"0")}-core`,unicodeRanges:["U+0041-005A","U+4E2D"],web:{...await add("font "+i),format:"woff2",contentType:"font/woff2"}}]})));
 const manifest={schemaVersion:1,fontVersion:1,catalogVersion:"1.0.0",fonts,limits:{maxConcurrentDownloads:2,maxSessionFamilies:8,maxSessionRequests:64,maxWebSessionBytes:16777216,maxPersistentCacheBytes:67108864,downloadTimeoutMs:15000,maxAssetBytes:6291456,...limits}};
 const md=await add(JSON.stringify(manifest),"json");
 const catalog={fontVersion:1,catalogVersion:"1.0.0",fonts:catalogSource.fonts,assetBaseUrl:"https://assets.wenyou.site/",manifest:md} as ThreadFontCatalog;
 const transport=vi.fn<typeof fetch>(async(input)=>new Response(assets.get(new URL(String(input)).pathname.slice(1))!,{headers:{"content-type":String(input).endsWith(".woff2")?"font/woff2":String(input).endsWith(".txt")?"text/plain":"application/json"}}));
 const cache=new MemoryCache();const install=vi.fn(async()=>{});const runtime=new ThreadFontRuntime(transport,cache,install);
 return {assets,catalog,fonts,manifest,transport,cache,install,runtime};
}
test.each([null,"http://wenyou.site/","https://evil.test/","https://wenyou.site.evil.test/","https://u:p@wenyou.site/","https://wenyou.site/no-slash","https://wenyou.site/?x=1","https://wenyou.site/#x","bad"])("拒绝非自有或不完整来源 %s",value=>expect(validatedFontBase(value)).toBeNull());
test("固定Unicode范围按实际码点选片，包含扩展平面",()=>{
 expect(validatedFontBase("https://cdn.wenyou.site/assets/")).toBe("https://cdn.wenyou.site/assets/");
 expect(rangesContain(["U+20000-20010"],0x20000)).toBe(true);expect(rangesContain(["U+0041"],66)).toBe(false);
 expect(requiredFontShards([{unicodeRanges:["U+0041"]},{unicodeRanges:["U+20000"]}] as never,"A𠀀A")).toHaveLength(2);
});
test.each(["shinsyoku-mincho", "bouken-gothic", "hakkou-mincho", "kaitou-yokoku-gothic"])("正式目录 %s 的日文样文按假名选择补充分片，不能只加载core", (id) => {
 const manifest = threadFontManifestSchema.parse(JSON.parse(readFileSync("contracts/thread-font-manifest-v1.json", "utf8")));
 const font = manifest.fonts.find(font => font.id === id);
 if (!font || font.availability !== "ready") throw new Error("缺少正式字体样本");
 const kana = "あいうえおアイウエオ";
 const core = font.shards.find(part => part.id === "core")!;
 expect(Array.from(kana).every(letter => !rangesContain(core.unicodeRanges, letter.codePointAt(0)!))).toBe(true);
 const selected = requiredFontShards(font.shards, "日本語" + kana);
 expect(selected.some(part => part.id === "core")).toBe(true);
 for (const letter of kana) {
  expect(selected.some(part => part.id !== "core" && rangesContain(part.unicodeRanges, letter.codePointAt(0)!))).toBe(true);
 }
 expect(selected.length).toBeLessThan(font.shards.length);
});
test("manifest、许可、字体先验哈希，重复阅读和多段共用一次下载与注册",async()=>{
 const f=await fixture();const results=await Promise.all(Array.from({length:10},()=>f.runtime.load(f.catalog,f.fonts[0]!.id,"A中")));
 expect(results.every(r=>r.status==="ready")).toBe(true);expect(f.transport).toHaveBeenCalledTimes(4);expect(f.install).toHaveBeenCalledTimes(1);
 expect(f.runtime.stats).toMatchObject({requests:4,faces:1,families:1,fallback:0});expect(f.cache.values.size).toBe(4);
 for(const [,options] of f.transport.mock.calls)expect(options).toMatchObject({credentials:"omit",redirect:"error",cache:"no-store"});
 const offline=vi.fn<typeof fetch>(async()=>{throw Error("offline")});const reopened=new ThreadFontRuntime(offline,f.cache,f.install);
 expect((await reopened.load(f.catalog,f.fonts[0]!.id,"A")).status).toBe("ready");expect(offline).not.toHaveBeenCalled();expect(reopened.stats.cacheHits).toBe(4);
});
test("无base、待源、未知ID与无内容不请求；纯缺字只有manifest",async()=>{
 const f=await fixture();
 const pendingCatalog = { ...f.catalog, fonts: f.catalog.fonts.map(font => ({ ...font, availability: "pendingSource" as const })) };
 for(const [catalog,id,text] of [[null,"wenkai","A"],[{...f.catalog,assetBaseUrl:null},"wenkai","A"],[f.catalog,"unknown","A"],[pendingCatalog,"kaitou-yokoku-gothic","A"],[f.catalog,f.fonts[0]!.id,""]] as const)expect((await f.runtime.load(catalog,id,text)).status).toBe("fallback");
 expect(f.transport).not.toHaveBeenCalled();expect((await f.runtime.load(f.catalog,f.fonts[0]!.id,"😀")).reason).toBe("missing-glyph");expect(f.transport).toHaveBeenCalledTimes(1);
});
test("损坏缓存删除后仅下载一次，失败不会重复请求",async()=>{
 const f=await fixture();const d=f.fonts[0]!.shards[0]!.web;f.cache.values.set(d.sha256,encode("bad"));
 expect((await f.runtime.load(f.catalog,f.fonts[0]!.id,"A")).status).toBe("ready");expect(f.cache.deleted).toEqual([d.sha256]);
 const g=await fixture();g.assets.set(g.fonts[0]!.shards[0]!.web.path,encode("corrupt"));
 for(let i=0;i<3;i++)expect((await g.runtime.load(g.catalog,g.fonts[0]!.id,"A")).status).toBe("fallback");
 expect(g.transport).toHaveBeenCalledTimes(4);expect(g.install).not.toHaveBeenCalled();
});
test("长度相同但哈希错误也不能注册或缓存",async()=>{
 const f=await fixture();const d=f.fonts[0]!.shards[0]!.web;f.assets.set(d.path,encode("x".repeat(d.bytes)));
 expect((await f.runtime.load(f.catalog,f.fonts[0]!.id,"A")).reason).toBe("asset-integrity");expect(f.cache.values.has(d.sha256)).toBe(false);expect(f.install).not.toHaveBeenCalled();
 expect(await verifyFontBytes(encode("x"),d)).toBe(false);
});
test.each(["length","network","decode","oversize"])("%s错误保留fontId并回退",async(mode)=>{
 const f=await fixture();
 if(mode==="decode")f.install.mockRejectedValue(Error("decode"));
 else if(mode==="network")f.transport.mockRejectedValue(Error("offline"));
 else if(mode==="length")f.transport.mockResolvedValue(new Response("x",{headers:{"content-length":"1"}}));
 else f.assets.set(f.catalog.manifest!.path,encode("x".repeat(f.catalog.manifest!.bytes+1)));
 expect((await f.runtime.load(f.catalog,f.fonts[0]!.id,"A")).status).toBe("fallback");expect(f.catalog.fonts[0]!.id).toBe(f.fonts[0]!.id);
});
test("预算跨多段和重试累计，最多8家族且最多2个并行下载",async()=>{
 const f=await fixture({},9);let active=0,peak=0;const transport=f.transport.getMockImplementation()!;
 f.transport.mockImplementation(async(...args)=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,2));try{return await transport(...args)}finally{active--}});
 const results=await Promise.all(f.fonts.map(font=>f.runtime.load(f.catalog,font.id,"A")));
 expect(results.filter(r=>r.status==="ready")).toHaveLength(8);expect(results[8]!.reason).toBe("family-budget");expect(peak).toBe(2);expect(f.runtime.stats.families).toBe(8);
});
test.each<Record<string, number>>([{maxSessionRequests:2},{maxWebSessionBytes:1},{maxAssetBytes:1}])("服务端更小预算生效 %j",async(limits)=>{
 const f=await fixture(limits);expect((await f.runtime.load(f.catalog,f.fonts[0]!.id,"A")).status).toBe("fallback");expect(f.install).not.toHaveBeenCalled();
});
test("manifest版本或数据异常拒绝，目录不匹配不能注册",async()=>{
 const f=await fixture();expect((await f.runtime.load({...f.catalog,catalogVersion:"wrong"},f.fonts[0]!.id,"A")).reason).toBe("catalog-version");
 expect(threadFontManifestSchema.safeParse({...f.manifest,schemaVersion:2}).success).toBe(false);
 expect(threadFontManifestSchema.safeParse({...f.manifest,fonts:[{...f.fonts[0],shards:[{...f.fonts[0]!.shards[0],unicodeRanges:["U+FFFF-0000"]}]}]}).success).toBe(false);
});

test("目录撤下或base清空后不沿用已经注册的字体", async () => {
 const f=await fixture();expect((await f.runtime.load(f.catalog,f.fonts[0]!.id,"A")).status).toBe("ready");
 const before=f.transport.mock.calls.length;
 const result=await f.runtime.load({...f.catalog,assetBaseUrl:null},f.fonts[0]!.id,"A");
 expect(result.status).toBe("fallback");expect(result.family).not.toContain("WYF1");expect(f.transport).toHaveBeenCalledTimes(before);
});

test("同字体后续全缺字不覆盖先前成功注册的family，也不重下资源", async () => {
 const f = await fixture();
 const loaded = await f.runtime.load(f.catalog, f.fonts[0]!.id, "A");
 const requests = f.transport.mock.calls.length;
 const missing = await f.runtime.load(f.catalog, f.fonts[0]!.id, "😀");
 expect(missing).toEqual({ family: loaded.family, status: "fallback", reason: "missing-glyph" });
 expect(missing.family).toContain(f.fonts[0]!.shards[0]!.family);
 expect(f.transport).toHaveBeenCalledTimes(requests);
});

test.each(["previous", "concurrent"])("追加分片失败保留%s成功的字形，不以失败片覆盖已安装family", async order => {
 const f = await fixture();
 const first = f.fonts[0]!.shards[0]!;
 const extra = { ...first, id: "u003000", family: "WYF1-0000000000000000-u003000", unicodeRanges: ["U+3042"], web: { ...await descriptor("kana-font"), format: "woff2", contentType: "font/woff2" } };
 const manifest = { ...f.manifest, fonts: [{ ...f.fonts[0]!, shards: [first, extra] }] };
 const md = await descriptor(JSON.stringify(manifest), "json");
 f.assets.set(md.path, encode(JSON.stringify(manifest)));
 const catalog = { ...f.catalog, manifest: md };
 const send = f.transport.getMockImplementation()!;
 f.transport.mockImplementation(async (...args) => {
  if (String(args[0]).endsWith(extra.web.path)) throw new Error("kana-offline");
  return send(...args);
 });
 if (order === "previous") expect((await f.runtime.load(catalog, firstFontId(), "A")).status).toBe("ready");
 // 同批另一个片先失败，已有片稍后安装完成也必须进入最终family链。
 if (order === "concurrent") f.install.mockImplementation(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
 const result = await f.runtime.load(catalog, firstFontId(), order === "previous" ? "あ" : "Aあ");
 expect(result).toEqual({ family: expect.stringContaining(first.family), status: "fallback", reason: "kana-offline" });
 expect(result.family).not.toContain(extra.family);
 expect(f.install).toHaveBeenCalledTimes(1);
 expect((await f.runtime.load(catalog, firstFontId(), "A")).family).toBe(result.family);
 expect((await f.runtime.load(catalog, firstFontId(), "あ")).family).toBe(result.family);
 expect(f.transport.mock.calls.filter(([input]) => String(input).endsWith(extra.web.path))).toHaveLength(1);
 function firstFontId() { return f.fonts[0]!.id; }
});
