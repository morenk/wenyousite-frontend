import { useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useVisibleTextFonts } from "../use-visible-text-fonts";
import * as runtimeModule from "@/lib/thread-font-runtime";
import { queryKeys } from "@/api/query-keys";
import policy from "../../../../contracts/thread-font-runtime-policy-v2.json";
import catalogSource from "../../../../contracts/thread-font-catalog-v1.json";
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/api/client", () => ({ apiClient: { GET: get } }));
const catalog = { ...catalogSource, assetBaseUrl: "https://assets.wenyou.site/", manifest: { path: `fonts/v1/${policy.manifestSha256}.json`, sha256: policy.manifestSha256, bytes: 5031019 } };
function Content() { const root=useRef<HTMLDivElement>(null);useVisibleTextFonts(root);return <div ref={root}><span data-wenyou-font-v1="wenkai">正文</span></div>; }
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();get.mockReset()});
test.each(["both","catalog","policy"])("冷启动 %s 元数据不可达，保持同一正文自动恢复且不提前启用legacy",async(scenario)=>{
 vi.stubGlobal("IntersectionObserver",undefined);vi.spyOn(Math,"random").mockReturnValue(0.01);
 let online=false;
 get.mockImplementation(async(path:string)=>{
  const isPolicy=path.endsWith("runtime-policy");
  if(!online&&(scenario==="both"||(scenario==="policy")===isPolicy))return{error:{},response:new Response(null,{status:503})};
  return{data:{data:isPolicy?policy:catalog},response:new Response(null)};
 });
 const runtime=new runtimeModule.ThreadFontRuntime(),watch=vi.spyOn(runtime,"watch").mockImplementation((_catalog,config,_id,_text,emit)=>{expect(config).not.toBeNull();emit({family:"custom",status:"ready"});return()=>{}});
 vi.spyOn(runtimeModule,"threadFontRuntime").mockReturnValue(runtime);
 const client=new QueryClient(),view=render(<QueryClientProvider client={client}><Content/></QueryClientProvider>);
 await waitFor(()=>expect(get).toHaveBeenCalledTimes(2));expect(watch).not.toHaveBeenCalled();online=true;
 await waitFor(()=>expect(view.container.querySelector("span")).toHaveAttribute("data-font-load","ready"));expect(watch).toHaveBeenCalledTimes(1);
 const node=view.container.querySelector("span");expect(node).toHaveTextContent("正文");view.unmount();client.clear();
});
test("缓存目录/策略可离线继续使用，权威空来源刷新禁用已装字库",async()=>{
 vi.stubGlobal("IntersectionObserver",undefined);
 const runtime=new runtimeModule.ThreadFontRuntime(),watch=vi.spyOn(runtime,"watch").mockImplementation((_catalog,config,_id,_text,emit)=>{emit({family:config?"custom":"system-ui",status:config?"ready":"fallback"});return()=>{}});
 vi.spyOn(runtimeModule,"threadFontRuntime").mockReturnValue(runtime);
 const client=new QueryClient();client.setQueryData(queryKeys.textFonts,catalog);client.setQueryData(queryKeys.textFontPolicy,policy);
 const view=render(<QueryClientProvider client={client}><Content/></QueryClientProvider>);
 await waitFor(()=>expect(watch).toHaveBeenCalledTimes(1));expect(get).not.toHaveBeenCalled();
 client.setQueryData(queryKeys.textFonts,{...catalog,assetBaseUrl:null});
 await waitFor(()=>expect(view.container.querySelector("span")).toHaveAttribute("data-font-load","fallback"));
 expect(watch.mock.calls.at(-1)![0]!.assetBaseUrl).toBeNull();view.unmount();client.clear();
});
