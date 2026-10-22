import { useRef } from "react";
import { webcrypto } from "node:crypto";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { TextFontEnvironment, useVisibleTextFonts, applyFontWithoutScrollJump } from "../use-visible-text-fonts";
import { ThreadFontRuntime, type ThreadFontCatalog } from "@/lib/thread-font-runtime";
import { EditorFontPreview } from "../editor-font-preview";
const catalog = { fontVersion: 1, catalogVersion: "1.0.0", assetBaseUrl: null, manifest: null, fonts: [] } as ThreadFontCatalog;
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks()});
function Content({ text="正文", id="wenkai" }: {text?:string;id?:string}) {
 const root=useRef<HTMLDivElement>(null);useVisibleTextFonts(root,text);
 return <div ref={root}><span data-wenyou-font-v1={id}>{text}</span></div>;
}
test("离屏不加载，进入视口后一次加载，正文变化重新选片",async()=>{
 let notify: IntersectionObserverCallback=()=>{};const observe=vi.fn();const disconnect=vi.fn();
 vi.stubGlobal("IntersectionObserver",class {constructor(callback:IntersectionObserverCallback){notify=callback}observe=observe;unobserve=vi.fn();disconnect=disconnect});
 const runtime=new ThreadFontRuntime();const load=vi.spyOn(runtime,"load").mockResolvedValue({family:'"WYF1-test", system-ui',status:"ready"});
 const env={catalog,runtime};
 const {container,rerender,unmount}=render(<TextFontEnvironment.Provider value={env}><Content/></TextFontEnvironment.Provider>);
 const element=container.querySelector("span")!;expect(observe).toHaveBeenCalledWith(element);expect(load).not.toHaveBeenCalled();
 await act(async()=>notify([{target:element,isIntersecting:true,intersectionRatio:1,boundingClientRect:element.getBoundingClientRect(),intersectionRect:element.getBoundingClientRect(),rootBounds:null,time:0}],{} as IntersectionObserver));
 expect(load).toHaveBeenCalledWith(catalog,"wenkai","正文");expect(element).toHaveAttribute("data-font-load","ready");
 expect(element.parentElement!.style.getPropertyValue("--wenyou-content-font-wenkai")).toContain("WYF1-test");
 await act(async()=>notify([{target:element,isIntersecting:true,intersectionRatio:1,boundingClientRect:element.getBoundingClientRect(),intersectionRect:element.getBoundingClientRect(),rootBounds:null,time:0}],{} as IntersectionObserver));expect(load).toHaveBeenCalledTimes(1);
 rerender(<TextFontEnvironment.Provider value={env}><Content text="新字"/></TextFontEnvironment.Provider>);
 await act(async()=>notify([{target:element,isIntersecting:true,intersectionRatio:1,boundingClientRect:element.getBoundingClientRect(),intersectionRect:element.getBoundingClientRect(),rootBounds:null,time:0}],{} as IntersectionObserver));expect(load).toHaveBeenLastCalledWith(catalog,"wenkai","新字");
 unmount();expect(disconnect).toHaveBeenCalled();
});
test("未知标记不请求；异步返回不能修改已卸载正文",async()=>{
 vi.stubGlobal("IntersectionObserver",undefined);
 const runtime=new ThreadFontRuntime();const load=vi.spyOn(runtime,"load");
 const env={catalog,runtime};const unknown=render(<TextFontEnvironment.Provider value={env}><Content id="unknown"/></TextFontEnvironment.Provider>);
 expect(load).not.toHaveBeenCalled();unknown.unmount();
 let finish!:(result:{family:string;status:"ready"})=>void;load.mockImplementation(()=>new Promise(resolve=>{finish=resolve}));
 const {container,unmount}=render(<TextFontEnvironment.Provider value={env}><Content/></TextFontEnvironment.Provider>);const element=container.querySelector("span")!;
 await waitFor(()=>expect(load).toHaveBeenCalledTimes(1));unmount();await act(async()=>finish({family:"custom",status:"ready"}));expect(element).not.toHaveAttribute("data-font-load");
});
test("预览失败提供回退反馈，源属性保留",async()=>{
 vi.stubGlobal("IntersectionObserver",undefined);const runtime=new ThreadFontRuntime();vi.spyOn(runtime,"load").mockRejectedValue(Error("offline"));
 const {getByRole,container}=render(<TextFontEnvironment.Provider value={{catalog,runtime}}><EditorFontPreview fontId="wenkai"/></TextFontEnvironment.Provider>);
 await waitFor(()=>expect(getByRole("status")).toHaveTextContent("已使用系统字体"));expect(container.querySelector("[data-wenyou-font-v1]")).toHaveAttribute("data-wenyou-font-v1","wenkai");
});
test("字体就绪按可见字符位移补偿滚动，保留选区",()=>{
 const root=document.createElement("div");root.textContent="滚动锚点";document.body.append(root);
 const owner=document.createElement("div");Object.defineProperty(document,"scrollingElement",{configurable:true,value:owner});owner.scrollTop=100;
 let top=20;const range={startContainer:root.firstChild!,startOffset:0,setEnd:vi.fn(),getBoundingClientRect:()=>({top}),cloneRange(){return this}};
 Object.defineProperty(document,"caretRangeFromPoint",{configurable:true,value:()=>range});
 const before=window.getSelection()?.anchorNode;applyFontWithoutScrollJump(root,()=>{top=48});expect(owner.scrollTop).toBe(128);expect(window.getSelection()?.anchorNode).toBe(before);
 delete (document as unknown as Record<string,unknown>).scrollingElement;delete (document as unknown as Record<string,unknown>).caretRangeFromPoint;root.remove();
});
test("滚动到同ID全缺字片段时，真实runtime保留先前可见英文的已安装family", async () => {
 vi.stubGlobal("crypto", webcrypto);
 let notify: IntersectionObserverCallback = () => {};
 vi.stubGlobal("IntersectionObserver", class {
  constructor(callback: IntersectionObserverCallback) { notify = callback; }
  observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn();
 });
 const assets = new Map<string, ArrayBuffer>();
 const add = async (text: string, ext: string) => {
  const bytes = new TextEncoder().encode(text).buffer as ArrayBuffer;
  const sha256 = Buffer.from(await webcrypto.subtle.digest("SHA-256", bytes)).toString("hex");
  const descriptor = { path: `fonts/v1/${sha256}.${ext}`, sha256, bytes: bytes.byteLength };
  assets.set(descriptor.path, bytes); return descriptor;
 };
 const notices = [await add("test license", "txt"), await add("{}", "json")];
 const web = { ...await add("synthetic font", "woff2"), format: "woff2", contentType: "font/woff2" };
 const family = "WYF1-0000000000000000-core";
 const manifest = await add(JSON.stringify({ schemaVersion: 1, fontVersion: 1, catalogVersion: "test", limits: { maxConcurrentDownloads: 2, maxSessionFamilies: 8, maxSessionRequests: 64, maxWebSessionBytes: 16777216, maxPersistentCacheBytes: 67108864, downloadTimeoutMs: 15000, maxAssetBytes: 6291456 }, fonts: [{ id: "great-vibes", availability: "ready", deliveryMode: "subset", license: "OFL-1.1", baseWeight: 400, baseStyle: "normal", notices, shards: [{ id: "core", family, unicodeRanges: ["U+0041-005A"], web }] }] }), "json");
 const configured: ThreadFontCatalog = { fontVersion: 1, catalogVersion: "test", assetBaseUrl: "https://assets.wenyou.site/", manifest, fonts: [{ id: "great-vibes", name: "Great Vibes", designLanguage: "en", availability: "ready" }] };
 const transport = vi.fn<typeof fetch>(async input => {
  const path = new URL(String(input)).pathname.slice(1);
  return new Response(assets.get(path)!, { headers: { "content-type": path.endsWith(".woff2") ? "font/woff2" : path.endsWith(".json") ? "application/json" : "text/plain" } });
 });
 const install = vi.fn(async () => {});
 const runtime = new ThreadFontRuntime(transport, { get: async () => null, put: async () => {}, delete: async () => {} }, install);
 function Mixed() {
  const root = useRef<HTMLDivElement>(null); useVisibleTextFonts(root);
  return <div ref={root}><span data-wenyou-font-v1="great-vibes">ABC</span><span data-wenyou-font-v1="great-vibes">中文</span></div>;
 }
 const { container } = render(<TextFontEnvironment.Provider value={{ catalog: configured, runtime }}><Mixed/></TextFontEnvironment.Provider>);
 const [english, chinese] = Array.from(container.querySelectorAll("span"));
 const enter = async (element: Element) => act(async () => notify([{ target: element, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
 await enter(english!); await waitFor(() => expect(english).toHaveAttribute("data-font-load", "ready"));
 const root = english!.parentElement!;
 const before = root.style.getPropertyValue("--wenyou-content-font-great-vibes");
 expect(before).toContain(family);
 await enter(chinese!); await waitFor(() => expect(chinese).toHaveAttribute("data-font-load", "fallback"));
 expect(root.style.getPropertyValue("--wenyou-content-font-great-vibes")).toBe(before);
 expect(english).toHaveTextContent("ABC"); expect(chinese).toHaveTextContent("中文");
 expect(install).toHaveBeenCalledTimes(1); expect(transport).toHaveBeenCalledTimes(4);
});
