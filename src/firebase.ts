import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  FacebookAuthProvider,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  OAuthProvider,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { CompanySettings, SavedAnalysisRecord, UserProfileRecord } from './types/app';

const app = initializeApp(firebaseConfig);

function createFirestoreClient(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    try {
      return initializeFirestore(
        app,
        { experimentalAutoDetectLongPolling: true },
        firebaseConfig.firestoreDatabaseId
      );
    } catch {
      return getFirestore(app, firebaseConfig.firestoreDatabaseId);
    }
  }
}

export const db = createFirestoreClient();
export const auth = getAuth(app);

// Persist authenticated user across page refreshes and offline sessions
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Auth persistence setup notice:', err);
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore operating in offline/local-cache mode:', error.message);
    }
  }
}

testConnection();

function isOfflineOrUnavailableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes('offline') ||
    msg.includes('unavailable') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('did not respond') ||
    msg.includes("didn't respond") ||
    msg.includes('deadline-exceeded')
  );
}

export function getFirebaseAuthErrorArabic(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: string }).code)
      : '';

  switch (code) {
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني غير صحيحة.';
    case 'auth/user-not-found':
      return 'لا يوجد حساب مسجل بهذا البريد الإلكتروني.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    case 'auth/email-already-in-use':
      return 'هذا البريد الإلكتروني مستخدم بالفعل لحساب آخر.';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة جداً؛ يجب أن تتكون من 6 أحرف على الأقل.';
    case 'auth/too-many-requests':
      return 'تم حظر المحاولات مؤقتاً بسبب كثرة المحاولات. يرجى المحاولة بعد قليل.';
    case 'auth/network-request-failed':
      return 'تعذر الاتصال بالإنترنت. يرجى التحقق من الشبكة والمحاولة مجدداً.';
    case 'auth/popup-closed-by-user':
      return 'تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.';
    case 'auth/popup-blocked':
      return 'قام المتصفح بحظر نافذة تسجيل الدخول المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.';
    case 'auth/account-exists-with-different-credential':
      return 'يوجد حساب مسجل بنفس البريد الإلكتروني عبر مزود دخول آخر. استخدم طريقة الدخول السابقة.';
    case 'auth/operation-not-allowed':
      return 'مزود تسجيل الدخول هذا غير مفعّل بعد في لوحة تحكم Firebase (Authentication → Sign-in method).';
    case 'auth/unauthorized-domain':
      return 'هذا النطاق غير مضاف إلى النطاقات المصرح بها في إعدادات Firebase Authentication.';
    case 'auth/user-disabled':
      return 'تم تعطيل هذا الحساب. يرجى التواصل مع الدعم الفني.';
    default: {
      const raw = error instanceof Error ? error.message : String(error);
      return raw ? `تعذر إتمام العملية: ${raw}` : 'حدث خطأ غير متوقع أثناء المصادقة.';
    }
  }
}

// ==================== AUTH ACTIONS ====================

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  cacheUserProfileLocally(cred.user, { provider: 'password' });
  void syncUserProfile(cred.user, { provider: 'password' }).catch((err) => {
    console.warn('Background login profile sync notice:', err);
  });
  return cred.user;
}

export async function registerWithEmail(params: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
  const cleanName = params.name.trim().slice(0, 120) || 'مستخدم';
  const cleanPhone = params.phone?.trim().slice(0, 32);
  cacheUserProfileLocally(cred.user, {
    displayName: cleanName,
    phone: cleanPhone,
    provider: 'password',
  });
  void updateProfile(cred.user, { displayName: cleanName })
    .catch(() => {})
    .then(() =>
      syncUserProfile(cred.user, {
        displayName: cleanName,
        phone: cleanPhone,
        provider: 'password',
      })
    )
    .catch((err) => {
      console.warn('Background register profile sync notice:', err);
    });
  return cred.user;
}

export async function updateUserAccountProfile(
  user: User,
  params: { displayName: string; phone: string }
): Promise<UserProfileRecord> {
  const cleanName = params.displayName.trim().slice(0, 120) || user.email?.split('@')[0] || 'مستخدم';
  const cleanPhone = params.phone.trim().slice(0, 32);
  await updateProfile(user, { displayName: cleanName });
  return syncUserProfile(user, {
    displayName: cleanName,
    phone: cleanPhone,
  });
}

export async function resetPasswordByEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export function isEmbeddedIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function buildGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export async function resolveGoogleRedirectResult(): Promise<User | null> {
  const cred = await getRedirectResult(auth);
  if (cred?.user) {
    cacheUserProfileLocally(cred.user, { provider: 'google.com' });
    void syncUserProfile(cred.user, { provider: 'google.com' }).catch((err) => {
      console.warn('Background redirect profile sync notice:', err);
    });
    return cred.user;
  }
  return null;
}

export async function startGoogleRedirectLogin(): Promise<void> {
  await signInWithRedirect(auth, buildGoogleProvider());
}

export async function loginWithGoogle(preferRedirect = false): Promise<User | null> {
  const provider = buildGoogleProvider();
  if (preferRedirect && !isEmbeddedIframe()) {
    await signInWithRedirect(auth, provider);
    return null;
  }
  const cred = await signInWithPopup(auth, provider);
  cacheUserProfileLocally(cred.user, { provider: 'google.com' });
  void syncUserProfile(cred.user, { provider: 'google.com' }).catch((err) => {
    console.warn('Background Google profile sync notice:', err);
  });
  return cred.user;
}

export async function loginWithFacebook(): Promise<User> {
  const provider = new FacebookAuthProvider();
  provider.addScope('email');
  provider.addScope('public_profile');
  const cred = await signInWithPopup(auth, provider);
  cacheUserProfileLocally(cred.user, { provider: 'facebook.com' });
  void syncUserProfile(cred.user, { provider: 'facebook.com' }).catch((err) => {
    console.warn('Background Facebook profile sync notice:', err);
  });
  return cred.user;
}

export async function loginWithApple(): Promise<User> {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  const cred = await signInWithPopup(auth, provider);
  cacheUserProfileLocally(cred.user, { provider: 'apple.com' });
  void syncUserProfile(cred.user, { provider: 'apple.com' }).catch((err) => {
    console.warn('Background Apple profile sync notice:', err);
  });
  return cred.user;
}

export async function logoutCurrentUser(): Promise<void> {
  await signOut(auth);
}

// ==================== LOCAL STORAGE KEYS (OFFLINE / DIRECT MODE CACHE) ====================
export const LOCAL_GUEST_UID = 'local_guest';
const localCompanyKey = (uid: string) => `dav_company_${uid}`;
const localAnalysesKey = (uid: string) => `dav_analyses_${uid}`;
const localProfileKey = (uid: string) => `dav_profile_${uid}`;

function canUseFirestore(uid: string): boolean {
  return Boolean(uid && uid !== LOCAL_GUEST_UID && auth.currentUser?.uid === uid);
}

// ==================== FIRESTORE DATA SYNC ====================

const syncProfileQueue = new Map<string, Promise<UserProfileRecord>>();
const recentProfileSync = new Map<string, { ts: number; record: UserProfileRecord }>();

function buildLocalProfileRecord(
  user: User,
  overrides?: { displayName?: string; phone?: string; provider?: string }
): UserProfileRecord {
  const uid = user.uid;
  const displayName = (overrides?.displayName || user.displayName || user.email?.split('@')[0] || 'مستخدم')
    .trim()
    .slice(0, 120);
  const email = (user.email || '').trim().slice(0, 200);
  const provider = (overrides?.provider || user.providerData[0]?.providerId || 'firebase')
    .trim()
    .slice(0, 40);
  const hasPhoneOverride = overrides?.phone !== undefined;
  const phone = overrides?.phone?.trim().slice(0, 32);

  const localRecord: UserProfileRecord = {
    uid,
    displayName,
    email,
    ...(phone ? { phone } : {}),
    provider,
  };

  try {
    const existingLocal = localStorage.getItem(localProfileKey(uid));
    if (existingLocal && !hasPhoneOverride) {
      const parsed = JSON.parse(existingLocal) as UserProfileRecord;
      if (parsed.phone) localRecord.phone = parsed.phone;
    }
  } catch {
    // Ignore localStorage parse issues
  }

  return localRecord;
}

export function cacheUserProfileLocally(
  user: User,
  overrides?: { displayName?: string; phone?: string; provider?: string }
): UserProfileRecord {
  const localRecord = buildLocalProfileRecord(user, overrides);
  try {
    localStorage.setItem(localProfileKey(user.uid), JSON.stringify(localRecord));
  } catch {
    // Ignore localStorage quota issues
  }
  return localRecord;
}

async function executeSyncUserProfile(
  user: User,
  overrides?: { displayName?: string; phone?: string; provider?: string }
): Promise<UserProfileRecord> {
  const uid = user.uid;
  const hasPhoneOverride = overrides?.phone !== undefined;
  const phone = overrides?.phone?.trim().slice(0, 32);
  const localRecord = cacheUserProfileLocally(user, overrides);

  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid,
        displayName: localRecord.displayName,
        email: localRecord.email,
        ...(localRecord.phone ? { phone: localRecord.phone } : {}),
        provider: localRecord.provider,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = snap.data() as Partial<UserProfileRecord>;
      if (existingData.phone && !hasPhoneOverride) {
        localRecord.phone = existingData.phone;
        try {
          localStorage.setItem(localProfileKey(uid), JSON.stringify(localRecord));
        } catch {
          // ignore
        }
      }
      await updateDoc(userRef, {
        displayName: localRecord.displayName,
        email: localRecord.email,
        ...(hasPhoneOverride ? { phone: phone || '' } : localRecord.phone ? { phone: localRecord.phone } : {}),
        provider: localRecord.provider,
        updatedAt: serverTimestamp(),
      });
    }
    recentProfileSync.set(uid, { ts: Date.now(), record: localRecord });
  } catch (error) {
    if (!isOfflineOrUnavailableError(error)) {
      handleFirestoreError(error, OperationType.WRITE, userPath);
    }
  }

  return localRecord;
}

export function syncUserProfile(
  user: User,
  overrides?: { displayName?: string; phone?: string; provider?: string }
): Promise<UserProfileRecord> {
  const uid = user.uid;
  const pending = syncProfileQueue.get(uid);
  if (pending && !overrides) {
    return pending;
  }
  const recent = recentProfileSync.get(uid);
  if (!overrides && recent && Date.now() - recent.ts < 15000) {
    return Promise.resolve(recent.record);
  }

  const previous = pending || Promise.resolve(null as unknown as UserProfileRecord);
  const next = previous
    .catch(() => null as unknown as UserProfileRecord)
    .then(() => executeSyncUserProfile(user, overrides))
    .finally(() => {
      if (syncProfileQueue.get(uid) === next) {
        syncProfileQueue.delete(uid);
      }
    });
  syncProfileQueue.set(uid, next);
  return next;
}

export function loadLocalUserProfile(uid: string): UserProfileRecord | null {
  try {
    const raw = localStorage.getItem(localProfileKey(uid));
    return raw ? (JSON.parse(raw) as UserProfileRecord) : null;
  } catch {
    return null;
  }
}

export function loadLocalCompanySettings(uid: string): CompanySettings {
  try {
    const raw = localStorage.getItem(localCompanyKey(uid));
    if (raw) return JSON.parse(raw) as CompanySettings;
  } catch {
    // ignore
  }
  return { companyName: '', location: '', address: '', logoDataUrl: '' };
}

export async function loadCompanySettings(uid: string): Promise<CompanySettings> {
  const local = loadLocalCompanySettings(uid);
  if (!canUseFirestore(uid)) return local;
  const path = `users/${uid}/companySettings/profile`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'companySettings', 'profile'));
    if (snap.exists()) {
      const d = snap.data();
      const loaded: CompanySettings = {
        companyName: String(d.companyName || ''),
        location: String(d.location || ''),
        address: String(d.address || ''),
        logoDataUrl: String(d.logoDataUrl || ''),
      };
      try {
        localStorage.setItem(localCompanyKey(uid), JSON.stringify(loaded));
      } catch {
        // ignore
      }
      return loaded;
    }
  } catch (error) {
    if (!isOfflineOrUnavailableError(error)) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }
  return local;
}

export async function saveCompanySettings(uid: string, settings: CompanySettings): Promise<CompanySettings> {
  const clean: CompanySettings = {
    companyName: settings.companyName.trim().slice(0, 160),
    location: settings.location.trim().slice(0, 160),
    address: settings.address.trim().slice(0, 300),
    logoDataUrl: settings.logoDataUrl.slice(0, 262144),
    updatedAtIso: new Date().toISOString(),
  };

  try {
    localStorage.setItem(localCompanyKey(uid), JSON.stringify(clean));
  } catch {
    // ignore
  }

  if (!canUseFirestore(uid)) return clean;

  const path = `users/${uid}/companySettings/profile`;
  const ref = doc(db, 'users', uid, 'companySettings', 'profile');

  try {
    const existingSnap = await getDoc(ref);
    if (!existingSnap.exists()) {
      await setDoc(ref, {
        ownerId: uid,
        companyName: clean.companyName,
        location: clean.location,
        address: clean.address,
        logoDataUrl: clean.logoDataUrl,
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        companyName: clean.companyName,
        location: clean.location,
        address: clean.address,
        logoDataUrl: clean.logoDataUrl,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    if (!isOfflineOrUnavailableError(error)) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  return clean;
}

export function loadLocalSavedAnalyses(uid: string): SavedAnalysisRecord[] {
  try {
    const raw = localStorage.getItem(localAnalysesKey(uid));
    return raw ? (JSON.parse(raw) as SavedAnalysisRecord[]) : [];
  } catch {
    return [];
  }
}

export async function loadSavedAnalyses(uid: string): Promise<SavedAnalysisRecord[]> {
  const local = loadLocalSavedAnalyses(uid);
  if (!canUseFirestore(uid)) return local;
  const path = `users/${uid}/savedAnalyses`;
  try {
    const q = query(collection(db, 'users', uid, 'savedAnalyses'), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    const rows: SavedAnalysisRecord[] = snap.docs
      .map((d) => {
        const data = d.data();
        const ts = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString();
        return {
          id: d.id,
          ownerId: String(data.ownerId || uid),
          title: String(data.title || ''),
          pageType: data.pageType,
          datasetName: String(data.datasetName || ''),
          xCol: String(data.xCol || ''),
          yCol: String(data.yCol || ''),
          chartType: data.chartType,
          aggMode: data.aggMode,
          rowCount: Number(data.rowCount || 0),
          colCount: Number(data.colCount || 0),
          summaryText: String(data.summaryText || ''),
          createdAtIso: ts,
        };
      })
      .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
    try {
      localStorage.setItem(localAnalysesKey(uid), JSON.stringify(rows));
    } catch {
      // ignore
    }
    return rows;
  } catch (error) {
    if (!isOfflineOrUnavailableError(error)) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    return local;
  }
}

export async function saveAnalysisSnapshot(
  uid: string,
  payload: Omit<SavedAnalysisRecord, 'id' | 'ownerId' | 'createdAtIso'>
): Promise<SavedAnalysisRecord> {
  const analysisId = `analysis_${Date.now()}`;
  const cleanRecord: SavedAnalysisRecord = {
    id: analysisId,
    ownerId: uid,
    title: payload.title.trim().slice(0, 160) || 'تحليل بيانات',
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

  const existingLocal = loadLocalSavedAnalyses(uid);
  try {
    localStorage.setItem(localAnalysesKey(uid), JSON.stringify([cleanRecord, ...existingLocal]));
  } catch {
    // ignore
  }

  if (!canUseFirestore(uid)) return cleanRecord;

  const path = `users/${uid}/savedAnalyses/${analysisId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'savedAnalyses', analysisId), {
      ownerId: uid,
      title: cleanRecord.title,
      pageType: cleanRecord.pageType,
      datasetName: cleanRecord.datasetName,
      xCol: cleanRecord.xCol,
      yCol: cleanRecord.yCol,
      chartType: cleanRecord.chartType,
      aggMode: cleanRecord.aggMode,
      rowCount: cleanRecord.rowCount,
      colCount: cleanRecord.colCount,
      summaryText: cleanRecord.summaryText,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (!isOfflineOrUnavailableError(error)) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  return cleanRecord;
}

export async function deleteSavedAnalysis(uid: string, analysisId: string): Promise<void> {
  const existingLocal = loadLocalSavedAnalyses(uid).filter((r) => r.id !== analysisId);
  try {
    localStorage.setItem(localAnalysesKey(uid), JSON.stringify(existingLocal));
  } catch {
    // ignore
  }

  if (!canUseFirestore(uid)) return;

  const path = `users/${uid}/savedAnalyses/${analysisId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'savedAnalyses', analysisId));
  } catch (error) {
    if (!isOfflineOrUnavailableError(error)) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

export async function clearAllUserData(uid: string): Promise<void> {
  try {
    localStorage.removeItem(localCompanyKey(uid));
    localStorage.removeItem(localAnalysesKey(uid));
  } catch {
    // ignore
  }

  if (!canUseFirestore(uid)) return;

  const analysesPath = `users/${uid}/savedAnalyses`;
  try {
    const q = query(collection(db, 'users', uid, 'savedAnalyses'), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (error) {
    if (!isOfflineOrUnavailableError(error)) {
      handleFirestoreError(error, OperationType.DELETE, analysesPath);
    }
  }

  const settingsPath = `users/${uid}/companySettings/profile`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'companySettings', 'profile'));
  } catch (error) {
    if (!isOfflineOrUnavailableError(error)) {
      handleFirestoreError(error, OperationType.DELETE, settingsPath);
    }
  }
}

export const FIREBASE_AUTH_DOMAIN = firebaseConfig.authDomain;
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
