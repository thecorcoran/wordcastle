export type AudioKind = 'word' | 'sentence' | 'slow';

export interface StoredAudio {
  key: string;
  itemId: string;
  kind: AudioKind;
  blob: Blob;
  mimeType: string;
  durationSec: number;
  recordedAt: number;
}

export function makeAudioKey(itemId: string, kind: AudioKind): string {
  return `${itemId}:${kind}`;
}

export function parseAudioKey(key: string): { itemId: string; kind: AudioKind } | null {
  const idx = key.lastIndexOf(':');
  if (idx <= 0) return null;
  const itemId = key.slice(0, idx);
  const kind = key.slice(idx + 1) as AudioKind;
  if (kind !== 'word' && kind !== 'sentence' && kind !== 'slow') return null;
  return { itemId, kind };
}

const STORE_NAME = 'recordings';

export class AudioStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(private readonly dbName: string) {}

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
    });
    return this.dbPromise;
  }

  async put(
    itemId: string,
    kind: AudioKind,
    blob: Blob,
    durationSec: number,
    recordedAt = Date.now(),
  ): Promise<StoredAudio> {
    const db = await this.openDb();
    const record: StoredAudio = {
      key: makeAudioKey(itemId, kind),
      itemId,
      kind,
      blob,
      mimeType: blob.type || 'audio/webm',
      durationSec,
      recordedAt,
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB put failed'));
    });
    return record;
  }

  async get(itemId: string, kind: AudioKind): Promise<StoredAudio | null> {
    const db = await this.openDb();
    const key = makeAudioKey(itemId, kind);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result as StoredAudio | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB get failed'));
    });
  }

  async delete(itemId: string, kind: AudioKind): Promise<void> {
    const db = await this.openDb();
    const key = makeAudioKey(itemId, kind);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'));
    });
  }

  async listKeys(): Promise<string[]> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAllKeys();
      req.onsuccess = () => resolve((req.result as string[]) ?? []);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB getAllKeys failed'));
    });
  }

  async getAll(): Promise<StoredAudio[]> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result as StoredAudio[]) ?? []);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB getAll failed'));
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB clear failed'));
    });
  }
}
