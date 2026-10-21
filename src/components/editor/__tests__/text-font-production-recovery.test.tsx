import { useRef } from "react";
import { webcrypto } from "node:crypto";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { useVisibleTextFonts } from "../use-visible-text-fonts";
import * as runtimeModule from "@/lib/thread-font-runtime";
import { threadFontNetwork } from "@/lib/thread-font-network";
import officialPolicy from "../../../../contracts/thread-font-runtime-policy-v2.json";
function Content(){const root=useRef<HTMLDivElement>(null);useVisibleTextFonts(root);return <div ref={root}><span data-wenyou-font-v1="wenkai">ABC</span></div>}
afterEach(()=>{cleanup();onlineManager.setOnline(true);vi.restoreAllMocks();vi.unstubAllGlobals();window.dispatchEvent(new Event("online"))});
async function fixture(){
 vi.stubGlobal("crypto",webcrypto);const assets=new Map<string,{bytes:ArrayBuffer;mime:string}>();
 const add=async(bytes:ArrayBuffer,ext:string,mime:string)=>{const sha256=Buffer.from(await webcrypto.subtle.digest("SHA-256",bytes)).toString("hex"),path=`fonts/v1/${sha256}.${ext}`;assets.set(path,{bytes,mime});return{path,sha256,bytes:bytes.byteLength}};
 const notices=[await add(new TextEncoder().encode("license").buffer,"txt","text/plain"),await add(new TextEncoder().encode("{}").buffer,"json","application/json")];
 const font=new ArrayBuffer(48),header=new DataView(font);header.setUint32(0,0x774f4632);header.setUint32(8,48);header.setUint32(16,12);
 const web={...await add(font,"woff2","font/woff2"),format:"woff2",contentType:"font/woff2"};
 const descriptor=await add(new TextEncoder().encode(JSON.stringify({schemaVersion:1,fontVersion:1,catalogVersion:"test",limits:{maxConcurrentDownloads:2,maxSessionFamilies:8,maxSessionRequests:64,maxWebSessionBytes:16777216,maxPersistentCacheBytes:67108864,downloadTimeoutMs:15000,maxAssetBytes:6291456},fonts:[{id:"wenkai",availability:"ready",deliveryMode:"subset",license:"OFL-1.1",baseWeight:400,baseStyle:"normal",notices,shards:[{id:"core",family:"WYF1-0000000000000000-core",unicodeRanges:["U+0041-005A"],web,mobile:{...web,path:web.path.replace(".woff2",".ttf"),bytes:12,format:"ttf",contentType:"font/ttf"}}]}]})).buffer,"json","application/json");
 const catalog={fontVersion:1,catalogVersion:"test",assetBaseUrl:"https://assets.wenyou.site/",manifest:descriptor,fonts:[{id:"wenkai",availability:"ready",name:"文楷"}]};
 const requests:string[]=[];
 server.use(http.get("*/api/v1/meta/text-fonts",()=>{requests.push("catalog");return HttpResponse.json({code:0,data:catalog})}),http.get("*/api/v1/meta/text-fonts/runtime-policy",()=>{requests.push("policy");return HttpResponse.json({code:0,data:{...officialPolicy,manifestSha256:descriptor.sha256}})}),http.get("https://assets.wenyou.site/*",({request})=>{const asset=assets.get(new URL(request.url).pathname.slice(1))!;requests.push("asset");return new HttpResponse(asset.bytes,{headers:{"content-type":asset.mime}})}));
 const install=vi.fn(async()=>()=>{}),runtime=new runtimeModule.ThreadFontRuntime(undefined,{get:async()=>null,put:async()=>{},delete:async()=>{}},install);vi.spyOn(runtimeModule,"threadFontRuntime").mockReturnValue(runtime);
 let notify:IntersectionObserverCallback=()=>{};vi.stubGlobal("IntersectionObserver",class{constructor(callback:IntersectionObserverCallback){notify=callback}observe=vi.fn();unobserve=vi.fn();disconnect=vi.fn()});
 const client=new QueryClient(),view=render(<QueryClientProvider client={client}><Content/></QueryClientProvider>),span=view.container.querySelector("span")!;
 const visible=async(value:boolean)=>act(async()=>notify([{target:span,isIntersecting:value,intersectionRatio:value?1:0,boundingClientRect:span.getBoundingClientRect(),intersectionRect:span.getBoundingClientRect(),rootBounds:null,time:0}],{} as IntersectionObserver));
 return{requests,install,client,view,span,visible,runtime};
}
test.each(["online","visibilitychange"])("生产链冷启动离线，只经%s自动就绪，无重挂载/重复请求",async(event)=>{
 const online=vi.spyOn(navigator,"onLine","get").mockReturnValue(false);onlineManager.setOnline(false);const f=await fixture();
 window.dispatchEvent(new Event("offline"));expect(f.requests).toEqual([]);await f.visible(true);await waitFor(()=>expect(threadFontNetwork().snapshot.queued).toBe(2));expect(f.requests).toEqual([]);
 online.mockReturnValue(true);await act(async()=>{for(let i=0;i<8;i++)(event==="online"?window:document).dispatchEvent(new Event(event))});
 await waitFor(()=>expect(f.span).toHaveAttribute("data-font-load","ready"));expect(f.requests.filter(x=>x==="catalog")).toHaveLength(1);expect(f.requests.filter(x=>x==="policy")).toHaveLength(1);expect(f.install).toHaveBeenCalledTimes(1);
 f.view.unmount();f.client.clear();expect(f.runtime.snapshot?.demands).toBe(0);
});
test("生产链初始离屏不请求，最后租约离开取消离线排队",async()=>{
 vi.spyOn(navigator,"onLine","get").mockReturnValue(false);const f=await fixture();window.dispatchEvent(new Event("offline"));await act(async()=>{});expect(f.requests).toEqual([]);
 await f.visible(true);await waitFor(()=>expect(threadFontNetwork().snapshot.queued).toBe(2));await f.visible(false);await waitFor(()=>expect(threadFontNetwork().snapshot.queued).toBe(0));expect(f.requests).toEqual([]);f.view.unmount();f.client.clear();
});
