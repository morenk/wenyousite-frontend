import { IDBFactory } from "fake-indexeddb";
import { beforeEach, expect, test, vi } from "vitest";
import { IndexedDbThreadFontCache } from "../thread-font-cache";
beforeEach(()=>vi.stubGlobal("indexedDB",new IDBFactory()));
const bytes=(length:number)=>new Uint8Array(length).buffer;
test("LRU触碰最新条目，淘汰未活动字体并保留活动许可",async()=>{
 const cache=new IndexedDbThreadFontCache();const now=vi.spyOn(Date,"now");let time=0;now.mockImplementation(()=>++time);
 await cache.put("license",bytes(2),10,new Set());await cache.put("first",bytes(3),10,new Set());await cache.put("second",bytes(3),10,new Set());
 expect((await cache.get("first"))?.byteLength).toBe(3);
 await cache.put("third",bytes(3),10,new Set(["license"]));
 expect(await cache.get("second")).toBeNull();expect((await cache.get("first"))?.byteLength).toBe(3);expect((await cache.get("license"))?.byteLength).toBe(2);
 await cache.delete("third");expect(await cache.get("third")).toBeNull();now.mockRestore();
});
test("全部受保护时不超预算，替换按新条目实际字节计数",async()=>{
 const cache=new IndexedDbThreadFontCache();await cache.put("a",bytes(4),4,new Set());await cache.put("b",bytes(2),4,new Set(["a"]));expect(await cache.get("b")).toBeNull();
 await cache.put("huge",bytes(5),4,new Set());expect(await cache.get("huge")).toBeNull();
 await cache.put("a",bytes(2),4,new Set());await cache.put("b",bytes(2),4,new Set());expect((await cache.get("a"))?.byteLength).toBe(2);expect((await cache.get("b"))?.byteLength).toBe(2);
});
test.each([undefined,{open:()=>{throw new Error("storage denied")}}])("存储不可用不阻断字体读取 %s",async(factory)=>{
 vi.stubGlobal("indexedDB",factory);const cache=new IndexedDbThreadFontCache();expect(await cache.get("a")).toBeNull();await expect(cache.put("a",bytes(2),4,new Set())).resolves.toBeUndefined();await expect(cache.delete("a")).resolves.toBeUndefined();
});
test("连续轮换活动资源只保护当前集合，持久缓存大小和条目数保持有界",async()=>{
 const cache=new IndexedDbThreadFontCache();
 for(let i=0;i<100;i++)await cache.put(String(i),bytes(10000),65536,new Set([String(i-1)]));
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open("wenyou-thread-font-assets-v1",1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
 const entries=await new Promise<{size:number}[]>((resolve,reject)=>{const req=db.transaction("assets").objectStore("assets").getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
 expect(entries.reduce((total,entry)=>total+entry.size,0)).toBeLessThanOrEqual(65536);expect(entries.length).toBeLessThanOrEqual(6);
 expect(await cache.get("0")).toBeNull();expect((await cache.get("99"))?.byteLength).toBe(10000);db.close();
});
test("收紧缓存立即回收旧条目，后续旧协议的较大限额不能放宽",async()=>{
 const clock=vi.spyOn(Date,"now");let time=0;clock.mockImplementation(()=>++time);
 const cache=new IndexedDbThreadFontCache();await cache.put("old",bytes(6),10,new Set());await cache.put("new",bytes(4),10,new Set());await cache.tightenLimit(4);expect(await cache.get("old")).toBeNull();expect((await cache.get("new"))?.byteLength).toBe(4);
 await cache.put("oversize",bytes(5),10,new Set());expect(await cache.get("oversize")).toBeNull();clock.mockRestore();
});
