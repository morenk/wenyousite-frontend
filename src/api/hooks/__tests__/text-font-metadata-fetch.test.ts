import { afterEach, expect, test, vi } from "vitest";
import { fetchTextFontMetadata, FONT_METADATA_BYTES } from "@/api/text-font-fetch";
import { threadFontNetwork } from "@/lib/thread-font-network";
import { textFontCatalogQueryOptions } from "../use-text-font-catalog";
import { textFontPolicyQueryOptions } from "../use-text-font-policy";
import { FontMetadataError, fontMetadataRetry, fontMetadataRetryDelay } from "../text-font-recovery";
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks()});
test("目录和策略共用资源窗口，预占64KiB且不带认证",async()=>{
 const before=threadFontNetwork().stats.started;
 const transport=vi.fn<typeof fetch>(async()=>new Response('{"data":{}}',{headers:{"content-type":"application/json"}}));
 for(const suffix of ["","/runtime-policy"])await fetchTextFontMetadata(new Request("https://wenyou.site/api/v1/meta/text-fonts"+suffix,{headers:{Authorization:"synthetic"}}),transport);
 expect(threadFontNetwork().stats.started-before).toBe(2);expect(threadFontNetwork().snapshot.windowBytes).toBeGreaterThanOrEqual(2*FONT_METADATA_BYTES);
 const request=transport.mock.calls[0]![0] as Request;expect(request.headers.has("Authorization")).toBe(false);expect(request.credentials).toBe("omit");
});
test("不信任Content-Length：成功响应在流式越界时取消",async()=>{
 for(const status of [200]) {
  const cancel=vi.fn();const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(FONT_METADATA_BYTES));controller.enqueue(new Uint8Array(1));},cancel});
  const transport=vi.fn<typeof fetch>(async()=>new Response(body,{status,headers:{"content-length":"1"}}));
  await expect(fetchTextFontMetadata(new Request("https://wenyou.site/api/v1/meta/text-fonts"),transport)).rejects.toMatchObject({retryable:false});expect(cancel).toHaveBeenCalledTimes(1);
 }
});

test("HTML/纯文本网关错误仍按暂时HTTP状态退避，不被JSON解析错误永久锁死",async()=>{
 for(const status of [408,429,500,502,503,504]) {
  const transport=vi.fn<typeof fetch>(async()=>new Response("<html>gateway unavailable</html>",{status,headers:{"content-type":"text/html","retry-after":"2"}}));
  await expect(fetchTextFontMetadata(new Request("https://wenyou.site/api/v1/meta/text-fonts"),transport)).rejects.toMatchObject({retryable:true});
 }
});

test.each(["catalog", "policy"])("真实apiClient与%s查询保留无body 503的Retry-After",async(kind)=>{
 const response=new Response(null,{status:503,headers:{"retry-after":"120"}});
 expect(response.body).toBeNull();
 const transport=vi.spyOn(globalThis,"fetch").mockResolvedValue(response);
 const options=kind==="catalog"?textFontCatalogQueryOptions():textFontPolicyQueryOptions();
 const before=performance.now();
 const error=await options.queryFn({signal:new AbortController().signal}).catch((failure:unknown)=>failure);
 expect(error).toBeInstanceOf(FontMetadataError);expect(error).toMatchObject({retryable:true});
 const retryAt=(error as FontMetadataError).retryAt!;
 expect(retryAt).toBeGreaterThanOrEqual(before+120000);expect(retryAt).toBeLessThanOrEqual(performance.now()+120000);
 expect(fontMetadataRetry(100,error)).toBe(true);expect(fontMetadataRetryDelay(100,error)).toBeGreaterThan(119000);
 expect(transport).toHaveBeenCalledTimes(1);
});

const progressTimeout={mode:"progress",firstByteMs:15000,idleMs:15000,maxDurationMs:600000} as const;
test("元数据持续30秒流式传输仍完成，读取结束清理超时器",async()=>{
 vi.useFakeTimers();let stream!:ReadableStreamDefaultController<Uint8Array>;
 const transport=vi.fn<typeof fetch>(async()=>new Response(new ReadableStream({start(controller){stream=controller}})));
 const result=fetchTextFontMetadata(new Request("https://wenyou.site/api/v1/meta/text-fonts"),transport,progressTimeout);await vi.advanceTimersByTimeAsync(0);
 for(const value of ['{"data":','{"fonts":[]}', '}']){await vi.advanceTimersByTimeAsync(10000);stream.enqueue(new TextEncoder().encode(value));await vi.advanceTimersByTimeAsync(0)}
 stream.close();expect(await (await result).json()).toEqual({data:{fonts:[]}});expect(transport).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});
test("元数据响应头不续期，body停流会取消reader，空块也不能延长",async()=>{
 vi.useFakeTimers();const cancel=vi.fn();let stream!:ReadableStreamDefaultController<Uint8Array>;
 const transport=vi.fn<typeof fetch>(async()=>{await new Promise(resolve=>setTimeout(resolve,14000));return new Response(new ReadableStream({start(controller){stream=controller},cancel}))});
 const result=expect(fetchTextFontMetadata(new Request("https://wenyou.site/api/v1/meta/text-fonts"),transport,progressTimeout)).rejects.toMatchObject({name:"TimeoutError"});
 await vi.advanceTimersByTimeAsync(14000);stream.enqueue(new Uint8Array(0));await vi.advanceTimersByTimeAsync(1000);await result;expect(cancel).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});

test.each([403,503])("HTTP %s在响应头立即分类并取消未结束错误流",async status=>{
 const cancel=vi.fn(),transport=vi.fn<typeof fetch>(async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(FONT_METADATA_BYTES+1))},cancel}),{status}));
 await expect(fetchTextFontMetadata(new Request("https://wenyou.site/api/v1/meta/text-fonts"),transport)).rejects.toMatchObject({retryable:status===503});expect(cancel).toHaveBeenCalledTimes(1);
});
