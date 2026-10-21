import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { ThreadFontSession, type FontSessionPolicy, type FontSessionResult } from "../thread-font-session";
import type { ThreadFontCatalog } from "../thread-font-protocol";
import catalogSource from "../../../contracts/thread-font-catalog-v1.json";
import { IndexedDbThreadFontCache } from "../thread-font-cache";
import { IDBFactory } from "fake-indexeddb";
beforeEach(()=>{vi.stubGlobal("crypto",webcrypto);vi.stubGlobal("indexedDB",new IDBFactory())});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals()});
async function fixture(count=2,original=false,estimatedSfntBytes=2*1024*1024) {
 const assets=new Map<string,ArrayBuffer>();const add=async(text:string,ext:string)=>{
  const raw=new TextEncoder().encode(text);let bytes=raw.buffer as ArrayBuffer;
  if(ext==="woff2"){const buffer=new Uint8Array(48+raw.length);buffer.set(raw,48);const header=new DataView(buffer.buffer);header.setUint32(0,0x774f4632);header.setUint32(8,buffer.length);header.setUint32(16,2*1024*1024);bytes=buffer.buffer}
  const sha256=Buffer.from(await webcrypto.subtle.digest("SHA-256",bytes)).toString("hex");
  const descriptor={path:`fonts/v1/${sha256}.${ext}`,sha256,bytes:bytes.byteLength};assets.set(descriptor.path,bytes);return descriptor;
 };
 const notices=[await add("license","txt"),await add("{}","json")];
 const fonts=await Promise.all(catalogSource.fonts.filter(f=>f.id!=="xiaocheng-lafeng").slice(0,count).map(async(f,i)=>({...f,deliveryMode:"subset",license:"OFL-1.1",baseWeight:400,baseStyle:"normal",notices,shards:[{id:"core",family:`WYF1-${String(i).padStart(16,"0")}-core`,unicodeRanges:["U+0041-005A"],web:{...await add("font-"+i,"woff2"),format:"woff2",contentType:"font/woff2"}},{id:"u003000",family:`WYF1-${String(i).padStart(16,"0")}-u003000`,unicodeRanges:["U+3042"],web:{...await add("kana-"+i,"woff2"),format:"woff2",contentType:"font/woff2"}}]})));
 if(original){
  const manifest=JSON.parse(readFileSync("contracts/thread-font-manifest-v1.json","utf8")),font=manifest.fonts.find((f:{id:string})=>f.id==="xiaocheng-lafeng");font.notices=notices;fonts.push(font);
  const part=font.shards[0].web;assets.set(part.path,new ArrayBuffer(part.bytes));const digest=webcrypto.subtle.digest.bind(webcrypto.subtle);
  vi.spyOn(webcrypto.subtle,"digest").mockImplementation((algorithm,data)=>data.byteLength===part.bytes?Promise.resolve(Uint8Array.from(Buffer.from(part.sha256,"hex")).buffer):digest(algorithm,data));
 }
 for (const font of fonts) for (const part of font.shards) { const item = part as typeof part & {mobile?:unknown}; item.mobile ??= {...part.web,bytes:estimatedSfntBytes,path:part.web.path.replace(/\.woff2$/, ".ttf"),format:"ttf",contentType:"font/ttf"}; }
 const manifest={schemaVersion:1,fontVersion:1,catalogVersion:"test",limits:{maxConcurrentDownloads:2,maxSessionFamilies:8,maxSessionRequests:64,maxWebSessionBytes:16777216,maxPersistentCacheBytes:67108864,downloadTimeoutMs:15000,maxAssetBytes:6291456},fonts};
 const descriptor=await add(JSON.stringify(manifest),"json");
 const catalog={...catalogSource,catalogVersion:"test",assetBaseUrl:"https://assets.wenyou.site/",manifest:descriptor} as ThreadFontCatalog;
 const policy:FontSessionPolicy={manifestSha256:descriptor.sha256,download:{concurrency:2,windowMs:1000,requestsPerWindow:64,bytesPerWindow:16777216,originalBytesPerWindow:18410600},residency:{families:29,faces:64,bytes:16777216,originalBytes:18410600},timeoutMs:15000,cacheBytes:67108864,retryBaseMs:100,retryMaxMs:1000,maxAssetBytes:6291456};
 const transport=vi.fn<typeof fetch>(async input=>{const path=new URL(String(input)).pathname.slice(1);return new Response(assets.get(path)!,{headers:{"content-type":path.endsWith(".woff2")?"font/woff2":path.endsWith(".ttf")?"font/ttf":path.endsWith(".txt")?"text/plain":"application/json"}})});
 const removed:string[]=[],install=vi.fn(async(part:{family:string})=>()=>{removed.push(part.family)});
 const cache=new IndexedDbThreadFontCache(),session=new ThreadFontSession(transport,cache,install,{random:()=>1});
 const watch=(id=fonts[0]!.id,text="A")=>{const results:FontSessionResult[]=[];const release=session.watch(catalog,policy,id,text,result=>results.push(result));return{results,release}};
 return{assets,add,fonts,catalog,policy,transport,install,removed,session,watch};
}
test("同SPA正反浏览29并返回，多轮注销无引用字体；无永久8家族限制及二进制Promise保留",async()=>{
 const f=await fixture(28,true);
 for(const font of [...f.fonts,...f.fonts.toReversed(),...f.fonts]){
  const view=f.watch(font.id);await vi.waitFor(()=>expect(view.results.at(-1)?.status).toBe("ready"));view.release();
  expect(f.session.snapshot.residency!.families).toBeLessThanOrEqual(29);expect(f.session.snapshot.residency!.bytes).toBeLessThanOrEqual(16777216);
 }
 expect(f.removed.length).toBeGreaterThan(50);expect(f.session.snapshot).toMatchObject({demands:0,faceTasks:0,registrationBytes:0,manifests:1,protectedHashes:0,assets:{inFlight:0,bufferedBytes:0}});
 expect(f.transport.mock.calls.filter(([url])=>String(url).endsWith(".ttf"))).toHaveLength(1);
 f.session.invalidate();expect(f.session.snapshot.residency).toMatchObject({faces:0,bytes:0,originalBytes:0});
},15000);
test("两个正文共享分片，一处离开仍显示；最后释放后压力淘汰且资源引用收敛",async()=>{
 const f=await fixture(2);f.policy.residency.families=1;
 const a=f.watch(),b=f.watch();await vi.waitFor(()=>expect(b.results.at(-1)?.status).toBe("ready"));expect(f.install).toHaveBeenCalledTimes(1);
 a.release();const c=f.watch(f.fonts[1]!.id);await vi.waitFor(()=>expect(f.session.snapshot.waitingForCapacity).toBe(1));expect(f.removed).toEqual([]);expect(b.results.at(-1)?.status).toBe("ready");
 b.release();await vi.waitFor(()=>expect(c.results.at(-1)?.status).toBe("ready"));expect(f.removed).toHaveLength(1);c.release();f.session.invalidate();
});
test("临时补片失败保留core，网络恢复无需重挂载自动补片，重复online不重复请求",async()=>{
 const f=await fixture(),send=f.transport.getMockImplementation()!,kana=f.fonts[0]!.shards[1]!.web.path;let offline=true;
 f.transport.mockImplementation((...args)=>String(args[0]).endsWith(kana)&&offline?Promise.reject(Error("offline")):send(...args));
 const a=f.watch(undefined,"Aあ");await vi.waitFor(()=>expect(a.results.at(-1)?.status).toBe("fallback"));expect(a.results.at(-1)?.family).toContain("-core");
 offline=false;for(let i=0;i<8;i++)window.dispatchEvent(new Event("online"));await vi.waitFor(()=>expect(a.results.at(-1)?.status).toBe("ready"));
 expect(a.results.at(-1)?.family).toContain("u003000");expect(f.transport.mock.calls.filter(([url])=>String(url).endsWith(kana))).toHaveLength(2);expect(f.session.snapshot.assets!.failures).toBe(0);a.release();f.session.invalidate();
});
test("注销后晚到解码不注册；来源撤回禁用旧字体并取消所有待恢复需求",async()=>{
 const f=await fixture();let finish!:(dispose:()=>void)=>void;f.install.mockImplementation(()=>new Promise(resolve=>{finish=resolve}));const a=f.watch();await vi.waitFor(()=>expect(f.install).toHaveBeenCalledTimes(1));
 const unavailable:FontSessionResult[]=[];f.session.watch({...f.catalog,assetBaseUrl:null},f.policy,f.fonts[0]!.id,"A",r=>unavailable.push(r));const dispose=vi.fn();finish(dispose);
 await vi.waitFor(()=>expect(f.session.snapshot.faceTasks).toBe(0));expect(dispose).toHaveBeenCalledTimes(1);expect(a.results.at(-1)?.family).not.toContain("WYF1");expect(unavailable.at(-1)?.status).toBe("fallback");expect(f.session.snapshot.demands).toBe(0);
});
test("MIME与decode隔离当前版本，不因重复online形成重试风暴",async()=>{
 const f=await fixture();f.install.mockRejectedValue(Error("decode"));const view=f.watch();await vi.waitFor(()=>expect(view.results.at(-1)?.reason).toBe("font-decode"));
 for(let i=0;i<20;i++)window.dispatchEvent(new Event("online"));await new Promise(resolve=>setTimeout(resolve,150));expect(f.install).toHaveBeenCalledTimes(1);view.release();f.session.invalidate();
});

test("WOFF2头比mobile估算大时重新按SFNT准入，等待期间不持有下载二进制",async()=>{
 const f=await fixture(2,false,1024*1024);f.policy.residency.bytes=3*1024*1024;
 const first=f.watch();await vi.waitFor(()=>expect(first.results.at(-1)?.status).toBe("ready"));expect(f.session.snapshot.residency!.bytes).toBe(2*1024*1024);
 const second=f.watch(f.fonts[1]!.id);await vi.waitFor(()=>expect(f.session.snapshot.waitingForCapacity).toBe(1));
 expect(f.install).toHaveBeenCalledTimes(1);expect(f.session.snapshot).toMatchObject({registrationBytes:0,faceTasks:0,assets:{inFlight:0,bufferedBytes:0}});
 first.release();await vi.waitFor(()=>expect(second.results.at(-1)?.status).toBe("ready"));expect(f.session.snapshot.residency!.bytes).toBe(2*1024*1024);second.release();f.session.invalidate();
});

test("单一可见范围超过驻留预算时部分回退，不保持悬空Promise或互相驱逐",async()=>{
 const f=await fixture();f.policy.residency.bytes=3*1024*1024;
 const view=f.watch(undefined,"Aあ");await vi.waitFor(()=>expect(view.results.at(-1)?.reason).toBe("resident-capacity"));
 expect(view.results.at(-1)?.family).toContain("-core");expect(f.session.snapshot).toMatchObject({waitingForCapacity:1,faceTasks:0,assets:{inFlight:0},residency:{queued:0,bytes:2*1024*1024}});
 for(let i=0;i<10;i++)window.dispatchEvent(new Event("online"));await new Promise(resolve=>setTimeout(resolve,100));expect(f.install).toHaveBeenCalledTimes(1);view.release();f.session.invalidate();
});
test("同manifest的新策略立即应用更严驻留/单资源限制，并保留已使用下载窗口",async()=>{
 const f=await fixture();const first=f.watch();await vi.waitFor(()=>expect(first.results.at(-1)?.status).toBe("ready"));const used=f.session.snapshot.downloads!.windowRequests;
 const strict={...f.policy,maxAssetBytes:1,download:{...f.policy.download,requestsPerWindow:1},residency:{...f.policy.residency,bytes:1}};
 const results:FontSessionResult[]=[],release=f.session.watch(f.catalog,strict,f.fonts[1]!.id,"A",result=>results.push(result));await vi.waitFor(()=>expect(results.at(-1)?.status).toBe("fallback"));
 expect(first.results.at(-1)?.family).not.toContain("WYF1");expect(f.session.snapshot.downloads!.windowRequests).toBe(used);expect(f.install).toHaveBeenCalledTimes(1);expect(f.session.snapshot.residency!.bytes).toBe(0);release();f.session.invalidate();
});
test("同一范围多片均低估SFNT时收敛到部分回退，不留下自锁排队",async()=>{
 const f=await fixture(2,false,1024*1024);f.policy.residency.bytes=3*1024*1024;
 const view=f.watch(undefined,"Aあ");await vi.waitFor(()=>expect(view.results.at(-1)?.reason).toBe("resident-capacity"));
 expect(view.results.at(-1)?.family).toContain("-core");expect(f.session.snapshot).toMatchObject({faceTasks:0,registrationBytes:0,assets:{inFlight:0,bufferedBytes:0},residency:{queued:0,bytes:2*1024*1024}});
 view.release();f.session.invalidate();
});
test("跨manifest收紧窗口不清历史预留，新目录与分片按新窗口逐项推进",async()=>{
 const f=await fixture();const view=f.watch();await vi.waitFor(()=>expect(view.results.at(-1)?.status).toBe("ready"));
 const original=JSON.parse(new TextDecoder().decode(f.assets.get(f.catalog.manifest!.path)!)),manifest=await f.add(JSON.stringify({...original,fixtureRevision:2}),"json");
 const policy={...f.policy,manifestSha256:manifest.sha256,download:{...f.policy.download,requestsPerWindow:1}};
 const results:FontSessionResult[]=[],release=f.session.watch({...f.catalog,manifest},policy,f.fonts[1]!.id,"A",result=>results.push(result));
 expect(f.session.snapshot.downloads!.windowRequests).toBeGreaterThan(1);await vi.waitFor(()=>expect(f.session.snapshot.downloads!.queued).toBe(1));
 await vi.waitFor(()=>expect(results.at(-1)?.status).toBe("ready"),{timeout:4000});expect(f.session.snapshot.downloads!.windowRequests).toBe(1);release();f.session.invalidate();
},6000);
