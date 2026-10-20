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
