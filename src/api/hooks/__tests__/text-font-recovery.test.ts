import{afterEach,expect,test,vi}from"vitest";
import{FontMetadataError,fontMetadataHttpError,fontMetadataRetry,fontMetadataRetryDelay}from"../text-font-recovery";
afterEach(()=>vi.restoreAllMocks());
test("冷启动元数据的暂时网络/HTTP失败持续退避，权威拒绝不重试",()=>{
 for(const status of [408,429,500,502,503,504])expect(fontMetadataRetry(100,fontMetadataHttpError(new Response(null,{status})))).toBe(true);
 for(const status of [400,401,403,404,410,501])expect(fontMetadataRetry(0,fontMetadataHttpError(new Response(null,{status})))).toBe(false);
 expect(fontMetadataRetry(100,new TypeError("offline"))).toBe(true);expect(fontMetadataRetry(100,new DOMException("timeout","TimeoutError"))).toBe(true);
 expect(fontMetadataRetry(0,new DOMException("released","AbortError"))).toBe(false);
});
test("元数据重试抖动不越过Retry-After，online事件不会清除已经记录的期限",()=>{
 vi.spyOn(Math,"random").mockReturnValue(0.5);vi.spyOn(performance,"now").mockReturnValue(1000);
 expect(fontMetadataRetryDelay(0,new TypeError())).toBe(500);expect(fontMetadataRetryDelay(100,new TypeError())).toBe(30000);
 const error=fontMetadataHttpError(new Response(null,{status:429,headers:{"retry-after":"120"}}));
 expect(error).toBeInstanceOf(FontMetadataError);expect(fontMetadataRetryDelay(0,error)).toBe(120000);
});
test("Retry-After日期只在接收时换算，随后墙钟跳变不改变退避",()=>{
 vi.spyOn(Date,"now").mockReturnValue(100000);vi.spyOn(performance,"now").mockReturnValue(500);vi.spyOn(Math,"random").mockReturnValue(0);
 const error=fontMetadataHttpError(new Response(null,{status:503,headers:{"retry-after":new Date(130000).toUTCString()}}));
 expect(error.retryAt).toBe(30500);vi.mocked(Date.now).mockReturnValue(86400000);expect(fontMetadataRetryDelay(0,error)).toBe(30000);
 vi.mocked(performance.now).mockReturnValue(10500);vi.mocked(Date.now).mockReturnValue(0);expect(fontMetadataRetryDelay(0,error)).toBe(20000);
});
