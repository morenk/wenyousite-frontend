/** 字体缓存只存经过运行时完整性校验的公开资产，不保存身份或正文。 */
export interface ThreadFontAssetCache {
  get(hash: string): Promise<ArrayBuffer | null>;
  put(hash: string, bytes: ArrayBuffer, limit: number, protectedHashes: ReadonlySet<string>): Promise<void>;
  delete(hash: string): Promise<void>;
}
export class IndexedDbThreadFontCache implements ThreadFontAssetCache {
  private database?: Promise<IDBDatabase | null>;
  private open() {
    return this.database ??= new Promise<IDBDatabase | null>((resolve) => {
      if (typeof indexedDB === "undefined") { resolve(null); return; }
      try {
        const request = indexedDB.open("wenyou-thread-font-assets-v1", 1);
        request.onupgradeneeded = () => {
          const store = request.result.createObjectStore("assets", { keyPath: "hash" });
          store.createIndex("touched", "touched");
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = request.onblocked = () => resolve(null);
      } catch { resolve(null); }
    });
  }
  async get(hash: string): Promise<ArrayBuffer | null> {
    const db = await this.open(); if (!db) return null;
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction("assets", "readwrite"), store = transaction.objectStore("assets");
        const request = store.get(hash);
        let bytes: ArrayBuffer | null = null;
        request.onsuccess = () => {
          const value = request.result;
          if (value?.bytes instanceof ArrayBuffer) {
            bytes = value.bytes;
            store.put({ ...value, touched: Date.now() });
          }
        };
        transaction.oncomplete = () => resolve(bytes);
        transaction.onerror = transaction.onabort = () => resolve(null);
      } catch { resolve(null); }
    });
  }
  async delete(hash: string) {
    const db = await this.open(); if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction("assets", "readwrite"); tx.objectStore("assets").delete(hash);
        tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
      } catch { resolve(); }
    });
  }
  async put(hash: string, bytes: ArrayBuffer, limit: number, protectedHashes: ReadonlySet<string>) {
    const db = await this.open(); if (!db || bytes.byteLength > limit) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction("assets", "readwrite"), store = tx.objectStore("assets");
        const entries: { hash: string; size: number }[] = [];
        let total = 0;
        const request = store.index("touched").openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const entry = cursor.value;
            if (entry.hash !== hash) { total += entry.size; entries.push({ hash: entry.hash, size: entry.size }); }
            cursor.continue(); return;
          }
          for (const entry of entries) {
            if (total + bytes.byteLength <= limit) break;
            if (!protectedHashes.has(entry.hash)) { store.delete(entry.hash); total -= entry.size; }
          }
          if (total + bytes.byteLength <= limit) store.put({ hash, bytes, size: bytes.byteLength, touched: Date.now() });
        };
        tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
      } catch { resolve(); }
    });
  }
}
