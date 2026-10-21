import { afterEach, expect, test, vi } from "vitest";
import fixtures from "../../../contracts/thread-font-runtime-policy-v2-fixtures.json";
import policy from "../../../contracts/thread-font-runtime-policy-v2.json";
import { FontAssetLoader } from "../thread-font-assets";
import { FontDownloadScheduler } from "../thread-font-scheduler";
import { fetchTextFontMetadata } from "@/api/text-font-fetch";
import { FontMetadataError } from "@/api/hooks/text-font-recovery";
afterEach(()=>vi.useRealTimers());
test.each(fixtures.transferCases)("共享传输轨迹 $id 经生产流式读取器验证",async trace=>{
 vi.useFakeTimers();await vi.advanceTimersByTimeAsync(trace.startedAtMs);
 const started=performance.now(),demand=new AbortController(),cancel=vi.fn();let stream!:ReadableStreamDefaultController<Uint8Array>,headers!:(response:Response)=>void;
 const body=new ReadableStream<Uint8Array>({start(controller){stream=controller},cancel});
 const metadata=trace.byteLimit===65536;
 const transport=vi.fn<typeof fetch>((_input,init)=>new Promise((resolve,reject)=>{
  headers=resolve;const signal=init?.signal??(_input as Request).signal;
  signal?.addEventListener("abort",()=>reject(signal.reason),{once:true});
 }));
 const scheduler=new FontDownloadScheduler({concurrency:2,windowMs:60000,requestsPerWindow:64,bytesPerWindow:16777216,originalBytesPerWindow:0});
 const loader=new FontAssetLoader({base:"https://assets.wenyou.site/",transport,scheduler,cache:{get:async()=>null,put:async()=>{},delete:async()=>{}},timeoutMs:15000,transferTimeout:{mode:"progress",firstByteMs:policy.web.network.timeoutMs,idleMs:policy.web.network.timeoutMs,maxDurationMs:policy.web.network.maxTransferMs},cacheBytes:67108864,retryBaseMs:1000,retryMaxMs:60000,verify:async()=>true,protectedHashes:()=>new Set()});
 let result:{outcome:string;atMs:number;acceptedBytes?:number}|undefined;
 const work=metadata?fetchTextFontMetadata(new Request("https://wenyou.site/api/v1/meta/text-fonts",{signal:demand.signal}),transport):loader.get({path:"fonts/v1/trace.woff2",sha256:trace.id,bytes:trace.byteLimit},demand.signal);
 const settled=work.then(value=>{result={outcome:"complete",atMs:trace.startedAtMs+performance.now()-started,acceptedBytes:value instanceof ArrayBuffer?value.byteLength:undefined}},error=>{
  result={outcome:error.name==="AbortError"?"cancelled":error instanceof FontMetadataError||error.message==="asset-length"?"length-rejected":performance.now()-started>=policy.web.network.maxTransferMs?"total-timeout":"idle-timeout",atMs:trace.startedAtMs+performance.now()-started,acceptedBytes:metadata?undefined:loader.snapshot.peakBufferedBytes};
 });
 await vi.advanceTimersByTimeAsync(0);let now=trace.startedAtMs,responded=false;
 const respond=()=>{if(!responded){responded=true;headers(new Response(body,{headers:{"content-type":metadata?"application/json":"font/woff2"}}))}};
 for(const event of trace.events){
  const repeated=event as typeof event&{repeat?:number;everyMs?:number;bytes?:number};
  for(let i=0;i<(repeated.repeat??1);i++){
   const at=event.atMs+i*(repeated.everyMs??0);await vi.advanceTimersByTimeAsync(at-now);now=at;if(result)break;
   if(event.kind==="headers")respond();
   else if(event.kind==="data"){respond();stream.enqueue(new Uint8Array(repeated.bytes??0))}
   else if(event.kind==="end"){respond();stream.close()}
   else if(event.kind==="cancel")demand.abort();
   await vi.advanceTimersByTimeAsync(0);
  }
  if(result)break;
 }
 await settled;expect(result).toMatchObject({outcome:trace.expected.outcome,atMs:trace.expected.atMs});
 if(!metadata)expect(result!.acceptedBytes).toBe(trace.expected.acceptedBytes);
 if(trace.expected.outcome!=="complete"&&responded)expect(cancel).toHaveBeenCalledTimes(1);
 expect(loader.snapshot).toMatchObject({inFlight:0,bufferedBytes:0});
});
