import { afterEach, expect, test, vi } from "vitest";
import { FontAssetLoader } from "../thread-font-assets";
import { FontDownloadScheduler } from "../thread-font-scheduler";
const descriptor={path:"fonts/v1/test.woff2",sha256:"test",bytes:4};
const response=()=>new Response(new Uint8Array(4),{headers:{"content-type":"font/woff2"}});
function fixture(transport=vi.fn<typeof fetch>(async()=>response())) {
 const scheduler=new FontDownloadScheduler({concurrency:2,windowMs:1000,requestsPerWindow:64,bytesPerWindow:1000,originalBytesPerWindow:20});
 const loader=new FontAssetLoader({base:"https://assets.wenyou.site/",transport,scheduler,cache:{get:async()=>null,put:async()=>{},delete:async()=>{}},timeoutMs:100,retryBaseMs:1000,retryMaxMs:60000,cacheBytes:1000,verify:async bytes=>bytes.byteLength===4,protectedHashes:()=>new Set(),random:()=>1});
 return{transport,loader,scheduler};
}
afterEach(()=>vi.useRealTimers());
test("多正文共享进行中请求，settle 后删除二进制Promise与缓存引用",async()=>{
 const f=fixture(),signal=new AbortController().signal;
 const values=await Promise.all(Array.from({length:8},()=>f.loader.get(descriptor,signal)));
 expect(values.every(bytes=>bytes.byteLength===4)).toBe(true);expect(f.transport).toHaveBeenCalledTimes(1);
 expect(f.loader.snapshot).toMatchObject({inFlight:0,bufferedBytes:0,failures:0});
});
test("临时错误按资源退避，成功后自动清理失败记录，重复唤醒不重复下载",async()=>{
 vi.useFakeTimers();const f=fixture();f.transport.mockRejectedValueOnce(Error("offline"));const signal=new AbortController().signal;
 await expect(f.loader.get(descriptor,signal)).rejects.toMatchObject({message:"network",retryAt:performance.now()+1000});
 for(let i=0;i<8;i++)await expect(f.loader.get(descriptor,signal)).rejects.toThrow("network");expect(f.transport).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(1000);await Promise.all(Array.from({length:8},()=>f.loader.get(descriptor,signal)));
 expect(f.transport).toHaveBeenCalledTimes(2);expect(f.loader.snapshot).toMatchObject({failures:0,inFlight:0,bufferedBytes:0});
});
test("429 Retry-After等待后再重试，完整性/MIME故障版本内不循环请求",async()=>{
 vi.useFakeTimers();const f=fixture(),signal=new AbortController().signal;f.transport.mockResolvedValueOnce(new Response("busy",{status:429,headers:{"retry-after":"10"}}));
 await expect(f.loader.get(descriptor,signal)).rejects.toMatchObject({retryAt:performance.now()+10000});await vi.advanceTimersByTimeAsync(9999);
 await expect(f.loader.get(descriptor,signal)).rejects.toThrow("network");expect(f.transport).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(1);await f.loader.get(descriptor,signal);expect(f.transport).toHaveBeenCalledTimes(2);
 const bad=fixture();bad.transport.mockResolvedValue(new Response("bad",{headers:{"content-type":"text/html"}}));
 for(let i=0;i<3;i++){await expect(bad.loader.get(descriptor,signal)).rejects.toMatchObject({message:"asset-mime",retryAt:undefined});await vi.advanceTimersByTimeAsync(60000)}
 expect(bad.transport).toHaveBeenCalledTimes(1);expect(bad.loader.snapshot.inFlight).toBe(0);
});
test("一个正文释放不取消共享下载，最后引用释放终止请求；晚到结果不能成功",async()=>{
 let finish!:(response:Response)=>void;const transport=vi.fn<typeof fetch>(()=>new Promise(resolve=>{finish=resolve})),f=fixture(transport),a=new AbortController(),b=new AbortController();
 const first=f.loader.get(descriptor,a.signal),second=f.loader.get(descriptor,b.signal);const failed=expect(first).rejects.toMatchObject({name:"AbortError"});
 await vi.waitFor(()=>expect(transport).toHaveBeenCalledTimes(1));a.abort();await failed;expect(transport.mock.calls[0]![1]!.signal!.aborted).toBe(false);
 b.abort();await expect(second).rejects.toMatchObject({name:"AbortError"});expect(transport.mock.calls[0]![1]!.signal!.aborted).toBe(true);
 finish(response());await vi.waitFor(()=>expect(f.loader.snapshot.inFlight).toBe(0));expect(f.loader.snapshot.failures).toBe(0);
});

test("短 Retry-After 不绕过连续故障的指数退避，成功后恢复首档",async()=>{
 vi.useFakeTimers();const f=fixture(),signal=new AbortController().signal;
 f.transport.mockImplementation(async()=>new Response("busy",{status:503,headers:{"retry-after":"1"}}));
 for(const delay of [1000,2000,4000,8000,16000,32000,60000,60000]) {
  await expect(f.loader.get(descriptor,signal)).rejects.toMatchObject({retryAt:performance.now()+delay});
  await vi.advanceTimersByTimeAsync(delay);
 }
 f.transport.mockResolvedValueOnce(response());await f.loader.get(descriptor,signal);
 await expect(f.loader.get(descriptor,signal)).rejects.toMatchObject({retryAt:performance.now()+1000});
});
