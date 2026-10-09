// Minimal IndexedDB key/value store for file contents (localStorage is too small for files).

const DB_NAME = 'cop-pilot';
const STORE = 'blobs';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const blobStore = {
  put: (key: string, blob: Blob) => run('readwrite', s => s.put(blob, key)),
  get: (key: string) => run<Blob | undefined>('readonly', s => s.get(key)),
  delete: (key: string) => run('readwrite', s => s.delete(key)),
  async copy(from: string, to: string) {
    const blob = await blobStore.get(from);
    if (blob) await blobStore.put(to, blob);
  },
};
