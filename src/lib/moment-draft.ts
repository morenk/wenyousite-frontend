const DATABASE_NAME = "wenyousite-local-drafts";
const STORE_NAME = "moment-drafts";
const DATABASE_VERSION = 1;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface MomentDraftFile {
  id: string;
  file: File;
}

export interface MomentDraftRecord {
  userId: string;
  title: string;
  content: string;
  files: MomentDraftFile[];
  coverFileId: string | null;
  updatedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "userId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法打开本地草稿"));
  });
}

export async function loadMomentDraft(userId: string): Promise<MomentDraftRecord | null> {
  const database = await openDatabase();
  try {
    const record = await new Promise<MomentDraftRecord | undefined>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(userId);
      request.onsuccess = () => resolve(request.result as MomentDraftRecord | undefined);
      request.onerror = () => reject(request.error);
    });
    if (!record) return null;
    if (Date.now() - record.updatedAt <= MAX_AGE_MS) return record;
    await deleteMomentDraft(userId);
    return null;
  } finally {
    database.close();
  }
}

export async function saveMomentDraft(record: MomentDraftRecord): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

export async function deleteMomentDraft(userId: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(userId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}
