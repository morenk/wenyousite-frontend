import { afterEach, expect, test, vi } from "vitest";
import { fetchTextFontMetadata, FONT_METADATA_BYTES } from "@/api/text-font-fetch";
import { threadFontNetwork } from "@/lib/thread-font-network";
afterEach(()=>vi.useRealTimers());
test("目录和策略共用资源窗口，预占64KiB且不带认证",async()=>{
 const before=threadFontNetwork().stats.started;
 const transport=vi.fn<typeof fetch>(async()=>new Response('{"data":{}}',{headers:{"content-type":"application/json"}}));
 for(const suffix of ["","/runtime-policy"])await fetchTextFontMetadata(new Request("https://wenyou.site/api/v1/meta/text-fonts"+suffix,{headers:{Authorization:"synthetic"}}),transport);
 expect(threadFontNetwork().stats.started-before).toBe(2);expect(threadFontNetwork().snapshot.windowBytes).toBeGreaterThanOrEqual(2*FONT_METADATA_BYTES);
 const request=transport.mock.calls[0]![0] as Request;expect(request.headers.has("Authorization")).toBe(false);expect(request.credentials).toBe("omit");
});
test("不信任Content-Length：成功和错误响应都在流式越界时取消",async()=>{
 for(const status of [200,503]) {
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
