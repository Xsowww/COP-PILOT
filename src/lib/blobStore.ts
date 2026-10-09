// File contents of the Drive: IndexedDB in local mode (localStorage is too small for files),
// Supabase Storage in cloud mode.

import { supabase } from './supabase';

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

const local = {
  put: (key: string, blob: Blob) => run('readwrite', s => s.put(blob, key)),
  get: (key: string) => run<Blob | undefined>('readonly', s => s.get(key)),
  delete: (key: string) => run('readwrite', s => s.delete(key)),
};

// Cloud mode: files go to the private Supabase Storage bucket "drive", under "<userId>/<itemId>".
const BUCKET = 'drive';
const path = (key: string) => key.replace(':', '/');

const cloud = {
  async put(key: string, blob: Blob) {
    const { error } = await supabase!.storage.from(BUCKET).upload(path(key), blob, { upsert: true, contentType: blob.type || undefined });
    if (error) throw error;
  },
  async get(key: string) {
    const { data, error } = await supabase!.storage.from(BUCKET).download(path(key));
    return error ? undefined : data;
  },
  async delete(key: string) {
    await supabase!.storage.from(BUCKET).remove([path(key)]);
  },
};

const backend = supabase ? cloud : local;

export const blobStore = {
  put: (key: string, blob: Blob) => backend.put(key, blob),
  get: (key: string): Promise<Blob | undefined> => backend.get(key),
  delete: (key: string) => backend.delete(key),
  async copy(from: string, to: string) {
    if (supabase) {
      await supabase.storage.from(BUCKET).copy(path(from), path(to));
      return;
    }
    const blob = await local.get(from);
    if (blob) await local.put(to, blob);
  },
};
