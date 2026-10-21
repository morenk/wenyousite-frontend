import { expect, test, vi } from "vitest";
import { FontResidency } from "../thread-font-residency";
const font = (id: number, bytes=10, original=false) => ({key:String(id),fontId:String(id),bytes,original});
test("同会话顺序浏览29家族再返回，驻留不超8且实际注销被淘汰的FontFace", async () => {
 const pool=new FontResidency({families:8,faces:64,bytes:80,originalBytes:20}), signal=new AbortController().signal, removed:number[]=[];
 for(let id=0;id<29;id++) {
  const lease=await pool.acquire(font(id),signal);pool.installed(lease.entry,()=>removed.push(id));lease.release();
  expect(pool.snapshot.families).toBeLessThanOrEqual(8);expect(pool.snapshot.bytes).toBeLessThanOrEqual(80);
 }
 expect(removed).toHaveLength(21);expect(removed).toEqual(Array.from({length:21},(_,i)=>i));
 const back=await pool.acquire(font(0),signal);expect(pool.snapshot.families).toBe(8);expect(removed.at(-1)).toBe(21);back.release();
});
test("共享分片引用计数保护可见正文；容量满时等待释放而非替换正在使用的字形", async () => {
 const pool=new FontResidency({families:1,faces:64,bytes:20,originalBytes:20}),a=new AbortController(),b=new AbortController();
 const first=await pool.acquire(font(1),a.signal), shared=await pool.acquire(font(1),b.signal),dispose=vi.fn();pool.installed(first.entry,dispose);
 expect(shared.entry).toBe(first.entry);let granted=false;
 const next=pool.acquire(font(2),new AbortController().signal).then(value=>{granted=true;return value});
 expect(pool.snapshot.queued).toBe(1);a.abort();await Promise.resolve();expect(granted).toBe(false);expect(dispose).not.toHaveBeenCalled();
 b.abort();const last=await next;expect(dispose).toHaveBeenCalledTimes(1);expect(pool.snapshot.references).toBe(1);last.release();last.release();expect(pool.snapshot.references).toBe(0);
});
test("离屏取消排队，原件独立驻留，撤回期间完成的解码立即注销", async () => {
 const pool=new FontResidency({families:2,faces:64,bytes:10,originalBytes:20}),signal=new AbortController().signal;
 const ordinary=await pool.acquire(font(1),signal), original=await pool.acquire(font(2,20,true),signal);
 const abort=new AbortController(),waiting=pool.acquire(font(3),abort.signal), rejected=expect(waiting).rejects.toMatchObject({name:"AbortError"});abort.abort();await rejected;
 expect(pool.snapshot).toMatchObject({bytes:10,originalBytes:20,queued:0});
 pool.invalidate("2");const dispose=vi.fn();expect(pool.installed(original.entry,dispose)).toBe(false);expect(dispose).toHaveBeenCalledTimes(1);
 ordinary.release();original.release();expect(pool.snapshot.originalBytes).toBe(0);
 await expect(pool.acquire(font(4,11),signal)).rejects.toThrow("resident-asset-size");
});
