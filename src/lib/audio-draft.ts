import type { MarkdownMediaAudio } from "./markdown-audio";

/** 沿用动态草稿的 IndexedDB 文件存储模式，独立库不升级既有草稿数据库。 */
export interface AudioDraftRecord {
  key: string;
  userId: string;
  file: File;
  mediaId?: string;
  completed?: MarkdownMediaAudio;
  updatedAt: number;
}
const DATABASE = "wenyousite-audio-drafts";
const STORE = "audio-drafts";
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("无法保存本机音频，请重试"));
  });
}
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = database.transaction(STORE, mode); const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(new Error("无法保存本机音频，请重试"));
    });
  } finally { database.close(); }
}
export async function saveAudioDraft(record: AudioDraftRecord) {
  await transaction("readwrite", (store) => {
    const cursor = store.openCursor();
    cursor.onsuccess = () => {
      if (!cursor.result) return;
      const old = cursor.result.value as AudioDraftRecord;
      if (Date.now() - old.updatedAt > 7 * 86400_000) cursor.result.delete();
      cursor.result.continue();
    };
    return store.put(record);
  });
}
export async function removeAudioDraft(key: string) { await transaction("readwrite", (store) => store.delete(key)); }
export async function loadAudioDraft(key: string, userId: string): Promise<AudioDraftRecord | null> {
  const record: AudioDraftRecord | undefined = await transaction("readonly", (store) => store.get(key));
  if (!record) return null;
  if (record.userId !== userId || Date.now() - record.updatedAt > 7 * 86400_000) { await removeAudioDraft(key); return null; }
  return record;
}
