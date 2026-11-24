import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  OfflineCompanySettings,
  OfflineDatabaseBackup,
  OfflineDataset,
  OfflineSavedAnalysis,
  OfflineUserProfile,
} from './offline.types';

export const OFFLINE_DB_NAME = 'BenFaisalOfflineDB';
export const OFFLINE_DB_VERSION = 1;

interface BenFaisalOfflineSchema extends DBSchema {
  datasets: {
    key: string;
    value: OfflineDataset;
  };
  analyses: {
    key: string;
    value: OfflineSavedAnalysis;
    indexes: { byCreatedAt: string };
  };
  settings: {
    key: string;
    value: {
      key: string;
      payload: unknown;
      updatedAtIso: string;
    };
  };
}

const LS_FALLBACK_DATASETS = 'bf_offline_db_datasets_v1';
const LS_FALLBACK_ANALYSES = 'bf_offline_db_analyses_v1';
const LS_FALLBACK_COMPANY = 'bf_offline_db_company_v1';
const LS_FALLBACK_USER = 'bf_offline_db_user_v1';

const EMPTY_COMPANY: OfflineCompanySettings = {
  companyName: '',
  location: '',
  address: '',
  logoDataUrl: '',
};

let dbPromise: Promise<IDBPDatabase<BenFaisalOfflineSchema> | null> | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

async function getDb(): Promise<IDBPDatabase<BenFaisalOfflineSchema> | null> {
  if (!hasIndexedDb()) return null;
  if (!dbPromise) {
    dbPromise = openDB<BenFaisalOfflineSchema>(OFFLINE_DB_NAME, OFFLINE_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('datasets')) {
          db.createObjectStore('datasets', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('analyses')) {
          const store = db.createObjectStore('analyses', { keyPath: 'id' });
          store.createIndex('byCreatedAt', 'createdAtIso');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      },
    }).catch((err) => {
      console.warn('IndexedDB unavailable, using localStorage fallback:', err);
      return null;
    });
  }
  return dbPromise;
}

function readLs<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLs<T>(key: string, val: T): void {
  try {
    window.localStorage?.setItem(key, JSON.stringify(val));
  } catch {
    // ignore quota errors
  }
}

export async function initOfflineDatabase(): Promise<{ engine: 'IndexedDB' | 'LocalStorage'; dbName: string }> {
  const db = await getDb();
  return {
    engine: db ? 'IndexedDB' : 'LocalStorage',
    dbName: OFFLINE_DB_NAME,
  };
}

// ==================== CUSTOM DATASETS STORE ====================

export async function loadOfflineCustomDatasets(): Promise<Record<string, OfflineDataset>> {
  const db = await getDb();
  if (db) {
    const rows = await db.getAll('datasets');
    const record: Record<string, OfflineDataset> = {};
    for (const r of rows) {
      record[r.id] = r;
    }
    return record;
  }
  return readLs<Record<string, OfflineDataset>>(LS_FALLBACK_DATASETS, {});
}

export async function saveOfflineCustomDataset(ds: OfflineDataset): Promise<OfflineDataset> {
  const clean: OfflineDataset = {
    ...ds,
    isCustom: true,
    savedAtIso: ds.savedAtIso || new Date().toISOString(),
  };
  const db = await getDb();
  if (db) {
    await db.put('datasets', clean);
  }
  // Keep localStorage mirror only for small datasets (<= 2,500 rows) to prevent QuotaExceededError on large files
  if (clean.rowsCount <= 2500 || !db) {
    const lsAll = readLs<Record<string, OfflineDataset>>(LS_FALLBACK_DATASETS, {});
    lsAll[clean.id] = clean;
    writeLs(LS_FALLBACK_DATASETS, lsAll);
  }
  return clean;
}

export async function deleteOfflineCustomDataset(id: string): Promise<void> {
  const db = await getDb();
  if (db) {
    await db.delete('datasets', id);
  }
  const lsAll = readLs<Record<string, OfflineDataset>>(LS_FALLBACK_DATASETS, {});
  delete lsAll[id];
  writeLs(LS_FALLBACK_DATASETS, lsAll);
}

// ==================== SAVED ANALYSES STORE ====================

export async function loadOfflineSavedAnalyses(): Promise<OfflineSavedAnalysis[]> {
  const db = await getDb();
  if (db) {
    const rows = await db.getAll('analyses');
    return rows.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
  }
  return readLs<OfflineSavedAnalysis[]>(LS_FALLBACK_ANALYSES, []);
}

export async function saveOfflineAnalysis(
  payload: Omit<OfflineSavedAnalysis, 'id' | 'createdAtIso'>
): Promise<OfflineSavedAnalysis> {
  const record: OfflineSavedAnalysis = {
    id: `off_analysis_${Date.now()}`,
    ownerId: payload.ownerId || 'offline_local_user',
    title: payload.title.trim().slice(0, 160) || 'تحليل محلي',
    pageType: payload.pageType,
    datasetName: payload.datasetName.trim().slice(0, 160) || 'dataset.csv',
    xCol: payload.xCol.trim().slice(0, 120) || 'X',
    yCol: payload.yCol.trim().slice(0, 120) || 'Y',
    chartType: payload.chartType,
    aggMode: payload.aggMode,
    rowCount: Math.max(0, Math.round(payload.rowCount)),
    colCount: Math.max(0, Math.round(payload.colCount)),
    summaryText: payload.summaryText.trim().slice(0, 2000),
    createdAtIso: new Date().toISOString(),
  };

  const db = await getDb();
  if (db) {
    await db.put('analyses', record);
  }
  const prev = readLs<OfflineSavedAnalysis[]>(LS_FALLBACK_ANALYSES, []);
  writeLs(LS_FALLBACK_ANALYSES, [record, ...prev]);
  return record;
}

export async function deleteOfflineAnalysis(id: string): Promise<void> {
  const db = await getDb();
  if (db) {
    await db.delete('analyses', id);
  }
  const prev = readLs<OfflineSavedAnalysis[]>(LS_FALLBACK_ANALYSES, []);
  writeLs(
    LS_FALLBACK_ANALYSES,
    prev.filter((r) => r.id !== id)
  );
}

// ==================== COMPANY SETTINGS STORE ====================

export async function loadOfflineCompanySettings(): Promise<OfflineCompanySettings> {
  const db = await getDb();
  if (db) {
    const row = await db.get('settings', 'company');
    if (row?.payload) {
      return row.payload as OfflineCompanySettings;
    }
  }
  return readLs<OfflineCompanySettings>(LS_FALLBACK_COMPANY, EMPTY_COMPANY);
}

export async function saveOfflineCompanySettings(
  next: OfflineCompanySettings
): Promise<OfflineCompanySettings> {
  const clean: OfflineCompanySettings = {
    companyName: next.companyName.trim().slice(0, 160),
    location: next.location.trim().slice(0, 160),
    address: next.address.trim().slice(0, 300),
    logoDataUrl: next.logoDataUrl.slice(0, 262144),
    updatedAtIso: new Date().toISOString(),
  };
  const db = await getDb();
  if (db) {
    await db.put('settings', {
      key: 'company',
      payload: clean,
      updatedAtIso: clean.updatedAtIso!,
    });
  }
  writeLs(LS_FALLBACK_COMPANY, clean);
  return clean;
}

// ==================== LOCAL OFFLINE USER PROFILE ====================

export async function loadOfflineLocalUser(): Promise<OfflineUserProfile | null> {
  const db = await getDb();
  if (db) {
    const row = await db.get('settings', 'userProfile');
    if (row?.payload) {
      return row.payload as OfflineUserProfile;
    }
  }
  return readLs<OfflineUserProfile | null>(LS_FALLBACK_USER, null);
}

export async function saveOfflineLocalUser(params: {
  displayName: string;
  email?: string;
  phone?: string;
  role?: string;
}): Promise<OfflineUserProfile> {
  const existing = await loadOfflineLocalUser();
  const now = new Date().toISOString();
  const profile: OfflineUserProfile = {
    uid: existing?.uid || `local_user_${Date.now().toString(36)}`,
    displayName: params.displayName.trim().slice(0, 120) || 'مستخدم محلي',
    email: (params.email ?? existing?.email ?? '').trim().slice(0, 200),
    phone: (params.phone ?? existing?.phone ?? '').trim().slice(0, 32),
    role: (params.role ?? existing?.role ?? 'محلل بيانات محلي').trim().slice(0, 80),
    createdAtIso: existing?.createdAtIso || now,
    updatedAtIso: now,
  };

  const db = await getDb();
  if (db) {
    await db.put('settings', {
      key: 'userProfile',
      payload: profile,
      updatedAtIso: now,
    });
  }
  writeLs(LS_FALLBACK_USER, profile);
  return profile;
}

export async function clearOfflineLocalUser(): Promise<void> {
  const db = await getDb();
  if (db) {
    await db.delete('settings', 'userProfile');
  }
  try {
    window.localStorage?.removeItem(LS_FALLBACK_USER);
  } catch {
    // ignore
  }
}

// ==================== BACKUP EXPORT / IMPORT / CLEAR ====================

export async function exportOfflineDatabaseBackup(): Promise<OfflineDatabaseBackup> {
  const [datasetsMap, savedAnalyses, company, userProfile] = await Promise.all([
    loadOfflineCustomDatasets(),
    loadOfflineSavedAnalyses(),
    loadOfflineCompanySettings(),
    loadOfflineLocalUser(),
  ]);

  return {
    version: OFFLINE_DB_VERSION,
    exportedAtIso: new Date().toISOString(),
    app: 'BenFaisalOfflineAnalytics',
    customDatasets: Object.values(datasetsMap),
    savedAnalyses,
    company,
    userProfile,
  };
}

export async function importOfflineDatabaseBackup(rawJson: string): Promise<OfflineDatabaseBackup> {
  const parsed = JSON.parse(rawJson) as Partial<OfflineDatabaseBackup>;
  if (!parsed || parsed.app !== 'BenFaisalOfflineAnalytics') {
    throw new Error('ملف النسخة الاحتياطية غير صالح أو لا يخص قاعدة البيانات المحلية للتطبيق.');
  }

  const db = await getDb();

  if (Array.isArray(parsed.customDatasets)) {
    const lsDs: Record<string, OfflineDataset> = readLs(LS_FALLBACK_DATASETS, {});
    for (const ds of parsed.customDatasets) {
      if (ds && ds.id && Array.isArray(ds.rows)) {
        const cleanDs: OfflineDataset = { ...ds, isCustom: true };
        if (db) await db.put('datasets', cleanDs);
        lsDs[cleanDs.id] = cleanDs;
      }
    }
    writeLs(LS_FALLBACK_DATASETS, lsDs);
  }

  if (Array.isArray(parsed.savedAnalyses)) {
    const existing = await loadOfflineSavedAnalyses();
    const map = new Map<string, OfflineSavedAnalysis>();
    for (const a of existing) map.set(a.id, a);
    for (const a of parsed.savedAnalyses) {
      if (a && a.id) {
        map.set(a.id, a);
        if (db) await db.put('analyses', a);
      }
    }
    writeLs(LS_FALLBACK_ANALYSES, Array.from(map.values()));
  }

  if (parsed.company) {
    await saveOfflineCompanySettings(parsed.company);
  }

  if (parsed.userProfile) {
    await saveOfflineLocalUser(parsed.userProfile);
  }

  return exportOfflineDatabaseBackup();
}

export async function clearAllOfflineDatabaseData(): Promise<void> {
  const db = await getDb();
  if (db) {
    await Promise.all([db.clear('datasets'), db.clear('analyses'), db.clear('settings')]);
  }
  try {
    window.localStorage?.removeItem(LS_FALLBACK_DATASETS);
    window.localStorage?.removeItem(LS_FALLBACK_ANALYSES);
    window.localStorage?.removeItem(LS_FALLBACK_COMPANY);
    window.localStorage?.removeItem(LS_FALLBACK_USER);
  } catch {
    // ignore
  }
}
