import { isValidMediaAudio, type MarkdownMediaAudio } from "./markdown-audio";

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

// 已完成投影单独保留，不因文件恢复记录确认入文而删除；不接受剪贴板提供的元数据。
interface AudioProjectionRecord { key: string; userId: string; mediaAudios: MarkdownMediaAudio[]; updatedAt: number }
export async function loadAudioProjections(key: string, userId: string): Promise<MarkdownMediaAudio[]> {
  const record: AudioProjectionRecord | undefined = await transaction("readonly", (store) => store.get(`projection:${key}`));
  if (!record || record.userId !== userId) return [];
  if (Date.now() - record.updatedAt > 7 * 86400_000) { await removeAudioDraft(record.key); return []; }
  return Array.isArray(record.mediaAudios) ? record.mediaAudios.filter(isValidMediaAudio) : [];
}
export async function saveAudioProjection(key: string, userId: string, media: MarkdownMediaAudio) {
  if (!isValidMediaAudio(media)) return;
  await transaction("readwrite", (store) => {
    const request = store.get(`projection:${key}`);
    request.onsuccess = () => {
      const previous = request.result as AudioProjectionRecord | undefined;
      const existing = previous?.userId === userId && Date.now() - previous.updatedAt <= 7 * 86400_000 && Array.isArray(previous.mediaAudios) ? previous.mediaAudios.filter(isValidMediaAudio) : [];
      const mediaAudios = [...new Map([...existing, media].map((item) => [item.sourceUrl, item])).values()];
      store.put({ key: `projection:${key}`, userId, mediaAudios, updatedAt: Date.now() } satisfies AudioProjectionRecord);
    };
    return request;
  });
}
