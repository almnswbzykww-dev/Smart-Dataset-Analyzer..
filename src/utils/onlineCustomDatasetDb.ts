import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Dataset } from '../types/app';

const ONLINE_CUSTOM_DB_NAME = 'BenFaisalOnlineCustomCacheDB';
const ONLINE_CUSTOM_DB_VERSION = 1;
const LS_SMALL_DATASETS_KEY = 'bf_custom_datasets_v1';
const MAX_LS_CHARS = 1_200_000; // ~1.2MB safe localStorage cap to prevent QuotaExceededError on 100k+ row files

interface OnlineCustomSchema extends DBSchema {
  customDatasets: {
    key: string;
    value: Dataset;
  };
}

let dbPromise: Promise<IDBPDatabase<OnlineCustomSchema> | null> | null = null;

async function getOnlineCustomDb(): Promise<IDBPDatabase<OnlineCustomSchema> | null> {
  if (typeof indexedDB === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB<OnlineCustomSchema>(ONLINE_CUSTOM_DB_NAME, ONLINE_CUSTOM_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('customDatasets')) {
          db.createObjectStore('customDatasets', { keyPath: 'id' });
        }
      },
    }).catch(() => null);
  }
  return dbPromise;
}

export async function loadOnlineCustomDatasets(): Promise<Record<string, Dataset>> {
  const result: Record<string, Dataset> = {};
  const db = await getOnlineCustomDb();
  if (db) {
    try {
      const all = await db.getAll('customDatasets');
      for (const ds of all) {
        if (ds && ds.id) result[ds.id] = ds;
      }
    } catch {
      // ignore IndexedDB read issue
    }
  }
  try {
    const raw = window.localStorage?.getItem(LS_SMALL_DATASETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, Dataset>;
      for (const [k, ds] of Object.entries(parsed)) {
        if (ds && !result[k]) result[k] = ds;
      }
    }
  } catch {
    // ignore
  }
  return result;
}

export async function saveOnlineCustomDataset(ds: Dataset): Promise<void> {
  const db = await getOnlineCustomDb();
  if (db) {
    try {
      await db.put('customDatasets', ds);
    } catch {
      // ignore
    }
  }
  // Keep lightweight localStorage mirror ONLY if small enough
  if (ds.rowsCount <= 2500) {
    try {
      const existingRaw = window.localStorage?.getItem(LS_SMALL_DATASETS_KEY);
      const existing = existingRaw ? (JSON.parse(existingRaw) as Record<string, Dataset>) : {};
      existing[ds.id] = ds;
      const serialized = JSON.stringify(existing);
      if (serialized.length <= MAX_LS_CHARS) {
        window.localStorage?.setItem(LS_SMALL_DATASETS_KEY, serialized);
      }
    } catch {
      // ignore quota error cleanly
    }
  }
}

export async function deleteOnlineCustomDataset(id: string): Promise<void> {
  const db = await getOnlineCustomDb();
  if (db) {
    try {
      await db.delete('customDatasets', id);
    } catch {
      // ignore
    }
  }
  try {
    const existingRaw = window.localStorage?.getItem(LS_SMALL_DATASETS_KEY);
    if (existingRaw) {
      const existing = JSON.parse(existingRaw) as Record<string, Dataset>;
      delete existing[id];
      window.localStorage?.setItem(LS_SMALL_DATASETS_KEY, JSON.stringify(existing));
    }
  } catch {
    // ignore
  }
}

export async function clearOnlineCustomDatasets(): Promise<void> {
  const db = await getOnlineCustomDb();
  if (db) {
    try {
      await db.clear('customDatasets');
    } catch {
      // ignore
    }
  }
  try {
    window.localStorage?.removeItem(LS_SMALL_DATASETS_KEY);
  } catch {
    // ignore
  }
}
