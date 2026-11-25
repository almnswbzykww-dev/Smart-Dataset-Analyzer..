import React, { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  auth,
  clearAllUserData,
  deleteSavedAnalysis,
  loadCompanySettings,
  loadLocalCompanySettings,
  loadLocalSavedAnalyses,
  loadLocalUserProfile,
  loadSavedAnalyses,
  LOCAL_GUEST_UID,
  logoutCurrentUser,
  resolveGoogleRedirectResult,
  saveAnalysisSnapshot,
  saveCompanySettings,
  syncUserProfile,
  updateUserAccountProfile,
} from './firebase';
import { BUILTIN_DATASETS } from './data/sampleDatasets';
import {
  clearOnlineCustomDatasets,
  deleteOnlineCustomDataset,
  loadOnlineCustomDatasets,
  saveOnlineCustomDataset,
} from './utils/onlineCustomDatasetDb';
import type {
  CompanySettings,
  Dataset,
  PageInstance,
  PageType,
  PrintPayload,
  SavedAnalysisRecord,
  UserProfileRecord,
} from './types/app';
import { CinematicHome } from './components/CinematicHome';
import { ConfirmModal, type ConfirmModalConfig } from './components/ConfirmModal';
import { AccountIcon, FeatureIcon } from './components/FeatureIcon';
import { OnlineAuthGate } from './components/OnlineAuthGate';
import { PAGE_META } from './components/PageToolbar';
import { PrintModal } from './components/PrintModal';
import { RedRubyGem } from './components/RedRubyGem';
import { AboutPage } from './components/pages/AboutPage';
import { ChartsStudioPage } from './components/pages/ChartsStudioPage';
import { DashboardPage } from './components/pages/DashboardPage';
import { DataExplorerPage } from './components/pages/DataExplorerPage';
import { DataLoaderPage } from './components/pages/DataLoaderPage';
import { ReportsPage } from './components/pages/ReportsPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { StatsPage } from './components/pages/StatsPage';

const SIDEBAR_GROUPS: Array<{ title: string; items: Array<{ type: PageType; label: string }> }> = [
  {
    title: 'أدوات التحليل والرسوم',
    items: [
      { type: 'dashboard', label: 'لوحة القيادة' },
      { type: 'studio', label: 'عرض الرسوم البيانية' },
      { type: 'stats', label: 'التحليل الإحصائي' },
      { type: 'reports', label: 'التقارير' },
      { type: 'details', label: 'مستعرض البيانات' },
    ],
  },
  {
    title: 'البيانات والإعدادات',
    items: [
      { type: 'loader', label: 'استيراد البيانات' },
      { type: 'settings', label: 'الإعدادات' },
      { type: 'about', label: 'حول التطبيق' },
    ],
  },
];

const SESSION_TABS_KEY = 'bf_open_instances_v1';
const SESSION_ACTIVE_TAB_KEY = 'bf_active_instance_v1';
const SESSION_PANEL_OPEN_KEY = 'bf_panel_open_v1';
const SESSION_DATASET_KEY = 'bf_active_dataset_v1';
const LOCAL_CUSTOM_DATASETS_KEY = 'bf_custom_datasets_v1';

function readStoredJson<T>(storage: 'session' | 'local', key: string, fallback: T): T {
  try {
    const store = storage === 'session' ? window.sessionStorage : window.localStorage;
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  // Firebase Authentication state (Online edition starts with Login gate until authenticated)
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileRecord | null>(null);

  // App Data & Branding State (hydrated immediately from local workspace + custom datasets)
  const [datasets, setDatasets] = useState<Record<string, Dataset>>(() => ({
    ...BUILTIN_DATASETS,
  }));
  const [activeDatasetKey, setActiveDatasetKey] = useState<string>(() =>
    readStoredJson<string>('session', SESSION_DATASET_KEY, 'sales')
  );
  const [company, setCompany] = useState<CompanySettings>(() => loadLocalCompanySettings(LOCAL_GUEST_UID));
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysisRecord[]>(() =>
    loadLocalSavedAnalyses(LOCAL_GUEST_UID)
  );

  // Hydrate Online custom datasets from IndexedDB safely (no localStorage 5MB crash)
  useEffect(() => {
    let active = true;
    loadOnlineCustomDatasets()
      .then((customDs) => {
        if (!active) return;
        if (Object.keys(customDs).length > 0) {
          setDatasets((prev) => ({ ...BUILTIN_DATASETS, ...customDs, ...prev }));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Workspace Shell State (persisted in sessionStorage so preview/HMR reconnects never close open pages)
  const [isControlPanelOpen, setIsControlPanelOpen] = useState<boolean>(() =>
    readStoredJson<boolean>('session', SESSION_PANEL_OPEN_KEY, false)
  );
  const [windowMode, setWindowMode] = useState<'compact' | 'normal' | 'maximized'>('normal');
  const [openInstances, setOpenInstances] = useState<PageInstance[]>(() =>
    readStoredJson<PageInstance[]>('session', SESSION_TABS_KEY, [])
  );
  const [currentInstanceId, setCurrentInstanceId] = useState<string | null>(() => {
    const savedTabs = readStoredJson<PageInstance[]>('session', SESSION_TABS_KEY, []);
    const savedId = readStoredJson<string | null>('session', SESSION_ACTIVE_TAB_KEY, null);
    return savedId && savedTabs.some((t) => t.instanceId === savedId) ? savedId : null;
  });
  const typeCountersRef = useRef<Record<PageType, number>>({
    dashboard: openInstances.filter((p) => p.type === 'dashboard').length,
    studio: openInstances.filter((p) => p.type === 'studio').length,
    stats: openInstances.filter((p) => p.type === 'stats').length,
    reports: openInstances.filter((p) => p.type === 'reports').length,
    details: openInstances.filter((p) => p.type === 'details').length,
    loader: openInstances.filter((p) => p.type === 'loader').length,
    settings: openInstances.filter((p) => p.type === 'settings').length,
    about: openInstances.filter((p) => p.type === 'about').length,
  });

  // Sync workspace tabs & open state to sessionStorage cleanly
  useEffect(() => {
    try {
      window.sessionStorage?.setItem(SESSION_TABS_KEY, JSON.stringify(openInstances));
      window.sessionStorage?.setItem(SESSION_ACTIVE_TAB_KEY, JSON.stringify(currentInstanceId));
      window.sessionStorage?.setItem(SESSION_PANEL_OPEN_KEY, JSON.stringify(isControlPanelOpen));
      window.sessionStorage?.setItem(SESSION_DATASET_KEY, JSON.stringify(activeDatasetKey));
    } catch {
      // ignore storage quota errors
    }
  }, [openInstances, currentInstanceId, isControlPanelOpen, activeDatasetKey]);

  // Modals & Toast State
  const [printPayload, setPrintPayload] = useState<PrintPayload | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalConfig>({
    open: false,
    title: '',
    message: '',
    confirmLabel: '✓ تأكيد',
    onConfirm: () => {},
    onCancel: () => {},
  });
  const [toast, setToast] = useState<{ open: boolean; msg: string; type: 'success' | 'error' }>({
    open: false,
    msg: '',
    type: 'success',
  });
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ open: true, msg, type });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, open: false }));
    }, 2800);
  }, []);

  // Sync authenticated session immediately with local cache and run cloud sync in parallel background
  useEffect(() => {
    let active = true;
    resolveGoogleRedirectResult().catch(() => {});

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      setFirebaseUser(user);
      setAuthReady(true);

      if (!user) {
        setUserProfile(null);
        setCompany(loadLocalCompanySettings(LOCAL_GUEST_UID));
        setSavedAnalyses(loadLocalSavedAnalyses(LOCAL_GUEST_UID));
        return;
      }

      const cachedProfile = loadLocalUserProfile(user.uid);
      setUserProfile(
        cachedProfile || {
          uid: user.uid,
          displayName: user.displayName || user.email?.split('@')[0] || 'مستخدم',
          email: user.email || '',
          provider: user.providerData[0]?.providerId || 'firebase',
        }
      );
      setCompany(loadLocalCompanySettings(user.uid));
      setSavedAnalyses(loadLocalSavedAnalyses(user.uid));

      try {
        const [profileRes, companyRes, analysesRes] = await Promise.allSettled([
          syncUserProfile(user),
          loadCompanySettings(user.uid),
          loadSavedAnalyses(user.uid),
        ]);
        if (!active || auth.currentUser?.uid !== user.uid) return;
        if (profileRes.status === 'fulfilled') setUserProfile(profileRes.value);
        if (companyRes.status === 'fulfilled') setCompany(companyRes.value);
        if (analysesRes.status === 'fulfilled') setSavedAnalyses(analysesRes.value);
      } catch (err) {
        console.warn('Background Firestore sync notice:', err);
      }
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  // Instance Helpers
  const createPageInstance = useCallback(
    (type: PageType): PageInstance => {
      typeCountersRef.current[type] = (typeCountersRef.current[type] || 0) + 1;
      const num = typeCountersRef.current[type];
      const ds = datasets[activeDatasetKey] || datasets.sales;
      return {
        instanceId: `${type}_${num}_${Date.now()}`,
        type,
        title: num === 1 ? PAGE_META[type].title : `${PAGE_META[type].title} (${num})`,
        datasetKey: ds.id,
        xCol: ds.defaultX,
        yCol: ds.defaultY,
        aggMode: 'sum',
        chartType: 'Bar',
        catFilter: 'ALL',
        search: '',
      };
    },
    [activeDatasetKey, datasets]
  );

  const openFeaturePage = (type: PageType) => {
    const existing = openInstances.find((p) => p.type === type);
    if (existing) {
      setCurrentInstanceId(existing.instanceId);
      return;
    }
    const inst = createPageInstance(type);
    setOpenInstances((prev) => {
      if (prev.some((p) => p.type === type)) return prev;
      return [...prev, inst];
    });
    setCurrentInstanceId(inst.instanceId);
  };

  const goHomeScreen = () => {
    setCurrentInstanceId(null);
  };

  const exitInstanceToHome = (instanceId: string) => {
    setOpenInstances((prev) => prev.filter((p) => p.instanceId !== instanceId));
    setCurrentInstanceId(null);
  };

  const closeTabOnly = (instanceId: string) => {
    const next = openInstances.filter((p) => p.instanceId !== instanceId);
    setOpenInstances(next);
    if (currentInstanceId === instanceId) {
      setCurrentInstanceId(next.length > 0 ? next[next.length - 1].instanceId : null);
    }
  };

  const updateInstanceConfig = (instanceId: string, patch: Partial<PageInstance>) => {
    setOpenInstances((prev) => prev.map((p) => (p.instanceId === instanceId ? { ...p, ...patch } : p)));
  };

  const changeInstanceDataset = (_instanceId: string, datasetKey: string) => {
    const ds = datasets[datasetKey];
    if (!ds) return;
    setActiveDatasetKey(datasetKey);
    setOpenInstances((prev) =>
      prev.map((p) => ({
        ...p,
        datasetKey,
        xCol: ds.defaultX,
        yCol: ds.defaultY,
        catFilter: 'ALL',
        search: '',
      }))
    );
    showToast(`تم تفعيل البيانات في جميع الصفحات والرسوم: ${ds.name}`);
  };

  const refreshInstance = (instanceId: string) => {
    const inst = openInstances.find((p) => p.instanceId === instanceId);
    if (!inst) return;
    setOpenInstances((prev) => prev.map((p) => (p.instanceId === instanceId ? { ...p } : p)));
    showToast(`تم تحديث ${inst.title} بنجاح!`);
  };

  const handleAddCustomDataset = (ds: Dataset, _instanceId: string) => {
    setDatasets((prev) => ({ ...prev, [ds.id]: ds }));
    setActiveDatasetKey(ds.id);
    setOpenInstances((prev) =>
      prev.map((p) => ({
        ...p,
        datasetKey: ds.id,
        xCol: ds.defaultX,
        yCol: ds.defaultY,
        catFilter: 'ALL',
        search: '',
      }))
    );
    void saveOnlineCustomDataset(ds);
  };

  const requestRemoveCustomDataset = (ds: Dataset) => {
    setConfirmModal({
      open: true,
      title: 'تأكيد حذف الملف المستورد',
      message: `هل أنت متأكد من حذف الملف "${ds.name}"؟ سيتم إزالته من قائمة قواعد البيانات المتاحة.`,
      confirmLabel: '✓ نعم، حذف الملف',
      cancelLabel: '✕ إلغاء',
      tone: 'danger',
      onCancel: closeConfirmModal,
      onConfirm: () => {
        void deleteOnlineCustomDataset(ds.id);
        setDatasets((prev) => {
          const copy = { ...prev };
          delete copy[ds.id];
          return copy;
        });
        if (activeDatasetKey === ds.id) {
          setActiveDatasetKey('sales');
        }
        setOpenInstances((prev) =>
          prev.map((p) =>
            p.datasetKey === ds.id
              ? {
                  ...p,
                  datasetKey: 'sales',
                  xCol: BUILTIN_DATASETS.sales.defaultX,
                  yCol: BUILTIN_DATASETS.sales.defaultY,
                  catFilter: 'ALL',
                  search: '',
                }
              : p
          )
        );
        closeConfirmModal();
        showToast(`تم حذف الملف "${ds.name}" بنجاح`);
      },
    });
  };

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, open: false, loading: false }));

  const activeOwnerId = firebaseUser?.uid || LOCAL_GUEST_UID;

  // Save with Mandatory Confirmation Modal
  const requestSaveAnalysis = (inst: PageInstance, ds: Dataset, summaryText: string) => {
    const pageType = (['dashboard', 'studio', 'stats', 'details', 'reports', 'loader'].includes(inst.type)
      ? inst.type
      : 'dashboard') as SavedAnalysisRecord['pageType'];

    setConfirmModal({
      open: true,
      title: 'تأكيد الحفظ',
      message: 'هل أنت متأكد من حفظ البيانات؟ سيتم حفظ لقطة التحليل الحالية في السجل.',
      confirmLabel: '✓ نعم، حفظ',
      cancelLabel: '✕ إلغاء',
      tone: 'primary',
      onCancel: closeConfirmModal,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, loading: true }));
        try {
          const created = await saveAnalysisSnapshot(activeOwnerId, {
            title: inst.title,
            pageType,
            datasetName: ds.name,
            xCol: inst.xCol,
            yCol: inst.yCol,
            chartType: inst.chartType,
            aggMode: inst.aggMode,
            rowCount: ds.rowsCount,
            colCount: ds.colsCount,
            summaryText,
          });
          setSavedAnalyses((prev) => [created, ...prev]);
          closeConfirmModal();
          showToast('تم حفظ البيانات بنجاح!');
        } catch (err) {
          closeConfirmModal();
          showToast(err instanceof Error ? err.message : 'تعذر حفظ البيانات', 'error');
        }
      },
    });
  };

  // Clear All Previous Data with Mandatory Warning Confirmation
  const requestClearAllData = () => {
    setConfirmModal({
      open: true,
      title: 'تحذير: مسح جميع البيانات السابقة',
      message:
        'هل أنت متأكد من مسح جميع البيانات السابقة؟ سيتم حذف جميع التحليلات المحفوظة، الملفات المرفوعة، وبيانات الشركة، ولن تتأثر ملفات التطبيق الأساسية.',
      confirmLabel: '✓ نعم، مسح الكل',
      cancelLabel: '✕ إلغاء',
      tone: 'danger',
      onCancel: closeConfirmModal,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, loading: true }));
        try {
          await clearAllUserData(activeOwnerId);
          await clearOnlineCustomDatasets();
          setDatasets({ ...BUILTIN_DATASETS });
          setActiveDatasetKey('sales');
          setCompany({ companyName: '', location: '', address: '', logoDataUrl: '' });
          setSavedAnalyses([]);
          setOpenInstances((prev) =>
            prev.map((p) => ({
              ...p,
              datasetKey: 'sales',
              xCol: BUILTIN_DATASETS.sales.defaultX,
              yCol: BUILTIN_DATASETS.sales.defaultY,
              catFilter: 'ALL',
              search: '',
            }))
          );
          closeConfirmModal();
          showToast('تم مسح جميع البيانات السابقة وتحديث التطبيق بنجاح!');
        } catch (err) {
          closeConfirmModal();
          showToast(err instanceof Error ? err.message : 'تعذر مسح البيانات', 'error');
        }
      },
    });
  };

  const requestSaveCompany = (next: CompanySettings): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmModal({
        open: true,
        title: 'تأكيد حفظ بيانات الشركة',
        message: 'هل أنت متأكد من حفظ بيانات الشركة؟ سيتم اعتمادها في رأس جميع التقارير والمطبوعات.',
        confirmLabel: '✓ نعم، حفظ البيانات',
        cancelLabel: '✕ إلغاء',
        tone: 'primary',
        onCancel: () => {
          closeConfirmModal();
          resolve(false);
        },
        onConfirm: async () => {
          setConfirmModal((prev) => ({ ...prev, loading: true }));
          try {
            const saved = await saveCompanySettings(activeOwnerId, next);
            setCompany(saved);
            closeConfirmModal();
            resolve(true);
          } catch (err) {
            closeConfirmModal();
            showToast(err instanceof Error ? err.message : 'تعذر حفظ بيانات الشركة', 'error');
            resolve(false);
          }
        },
      });
    });
  };

  const requestDeleteAnalysis = (rec: SavedAnalysisRecord) => {
    setConfirmModal({
      open: true,
      title: 'تأكيد حذف التحليل',
      message: `هل أنت متأكد من حذف التحليل "${rec.title}" (${rec.datasetName})؟ لا يمكن التراجع عن هذا الإجراء.`,
      confirmLabel: '✓ نعم، حذف',
      cancelLabel: '✕ إلغاء',
      tone: 'danger',
      onCancel: closeConfirmModal,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, loading: true }));
        try {
          await deleteSavedAnalysis(activeOwnerId, rec.id);
          setSavedAnalyses((prev) => prev.filter((r) => r.id !== rec.id));
          closeConfirmModal();
          showToast('تم حذف التحليل المحفوظ بنجاح');
        } catch (err) {
          closeConfirmModal();
          showToast(err instanceof Error ? err.message : 'تعذر حذف السجل', 'error');
        }
      },
    });
  };

  const requestUpdateAccountProfile = (next: { displayName: string; phone: string }): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!firebaseUser) {
        resolve(false);
        return;
      }
      setConfirmModal({
        open: true,
        title: 'تأكيد حفظ بيانات الحساب',
        message: 'هل أنت متأكد من حفظ التعديلات على اسم المستخدم ورقم الهاتف في حسابك؟',
        confirmLabel: '✓ نعم، حفظ التعديلات',
        cancelLabel: '✕ إلغاء',
        tone: 'primary',
        onCancel: () => {
          closeConfirmModal();
          resolve(false);
        },
        onConfirm: async () => {
          setConfirmModal((prev) => ({ ...prev, loading: true }));
          try {
            const updated = await updateUserAccountProfile(firebaseUser, next);
            setUserProfile(updated);
            closeConfirmModal();
            resolve(true);
          } catch (err) {
            closeConfirmModal();
            showToast(err instanceof Error ? err.message : 'تعذر تحديث بيانات الحساب', 'error');
            resolve(false);
          }
        },
      });
    });
  };

  const requestLogout = () => {
    setConfirmModal({
      open: true,
      title: 'تأكيد تسجيل الخروج',
      message: 'هل أنت متأكد من تسجيل الخروج من حسابك؟ ستعود إلى صفحة تسجيل الدخول.',
      confirmLabel: '✓ نعم، تسجيل الخروج',
      cancelLabel: '✕ إلغاء',
      tone: 'danger',
      onCancel: closeConfirmModal,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, loading: true }));
        try {
          await logoutCurrentUser();
          closeConfirmModal();
          showToast('تم تسجيل الخروج من الحساب بنجاح');
        } catch (err) {
          closeConfirmModal();
          showToast(err instanceof Error ? err.message : 'تعذر تسجيل الخروج', 'error');
        }
      },
    });
  };

  const handleMinimizeWindow = () => {
    setWindowMode((prev) => {
      if (prev === 'maximized') return 'normal';
      if (prev === 'normal') return 'compact';
      showToast('النافذة في وضع التصغير حالياً');
      return 'compact';
    });
  };

  const handleToggleMaximizeWindow = () => {
    setWindowMode((prev) => (prev === 'maximized' ? 'normal' : 'maximized'));
  };

  const requestExitApp = () => {
    setConfirmModal({
      open: true,
      title: 'تأكيد الخروج',
      message: firebaseUser
        ? 'هل أنت متأكد من الخروج؟ سيتم إغلاق جميع الصفحات المفتوحة وتسجيل الخروج من حسابك الحالي.'
        : 'هل أنت متأكد من الخروج من النوافذ المفتوحة والعودة إلى الشاشة الرئيسية للتطبيق؟',
      confirmLabel: '✓ نعم، خروج',
      cancelLabel: '✕ إلغاء',
      tone: 'danger',
      onCancel: closeConfirmModal,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, loading: true }));
        try {
          if (firebaseUser) {
            await logoutCurrentUser();
          }
          setOpenInstances([]);
          setCurrentInstanceId(null);
          setIsControlPanelOpen(false);
          setWindowMode('normal');
          closeConfirmModal();
          showToast(firebaseUser ? 'تم تسجيل الخروج وإغلاق جميع النوافذ' : 'تم الخروج من النوافذ المفتوحة بنجاح');
        } catch (err) {
          closeConfirmModal();
          showToast(err instanceof Error ? err.message : 'تعذر إتمام عملية الخروج', 'error');
        }
      },
    });
  };

  const activeInstance = openInstances.find((p) => p.instanceId === currentInstanceId) || null;
  const activeDataset = datasets[activeDatasetKey] || datasets.sales;

  const windowContainerClass =
    windowMode === 'maximized'
      ? 'm-0 rounded-none'
      : windowMode === 'compact'
        ? 'my-3 sm:my-5 mx-auto w-[96%] max-w-6xl rounded-2xl shadow-2xl'
        : 'm-1 sm:m-1.5 rounded-2xl';

  if (!authReady) {
    return (
      <div className="h-screen w-screen emerald-wallpaper flex items-center justify-center p-6" dir="rtl">
        <div className="glass-panel-emerald emerald-glow-border rounded-3xl px-8 py-7 text-center space-y-3 shadow-2xl">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-rose-950/90 to-emeraldos-950 border border-rose-400/50 flex items-center justify-center">
            <RedRubyGem size="lg" />
          </div>
          <h1 className="text-base font-black text-white">Dataset Analyzer Online</h1>
          <p className="text-xs font-bold text-platgold-300">⏳ جاري التحقق من جلسة الحساب السحابي...</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <>
        <OnlineAuthGate onToast={showToast} />
        <div
          className={`no-print fixed bottom-4 left-4 bg-emeraldos-900 border border-platgold-400 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 transition-all duration-300 z-50 text-xs font-bold ${
            toast.open ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'
          }`}
        >
          <span>{toast.type === 'error' ? '⚠️' : '✅'}</span>
          <span>{toast.msg}</span>
        </div>
      </>
    );
  }

  return (
    <div className="h-screen w-screen emerald-wallpaper relative flex flex-col overflow-hidden" dir="rtl">
      {/* ==================== MAIN APPLICATION WINDOW ==================== */}
      <div
        id="mainAppWindow"
        className={`no-print relative z-20 flex-1 glass-panel-emerald emerald-glow-border flex flex-col overflow-hidden transition-all duration-300 ${windowContainerClass}`}
      >
        {/* Top Application Bar */}
        <header className="bg-gradient-to-r from-emeraldos-950 via-emeraldos-900 to-emeraldos-950 border-b border-platgold-500/35 px-4 py-2 flex items-center justify-between gap-3 shrink-0">
          {/* Right: Dynamic Control Panel Toggle + Red Ruby Gem + Brand */}
          <div className="flex items-center gap-3">
            <button
              id="togglePanelBtn"
              type="button"
              onClick={() => setIsControlPanelOpen((prev) => !prev)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black shadow flex items-center gap-2 cursor-pointer transition shrink-0 whitespace-nowrap ${
                isControlPanelOpen
                  ? 'bg-emeraldos-800 hover:bg-emeraldos-700 text-platgold-200 border border-platgold-400/50'
                  : 'platgold-gradient text-emeraldos-950'
              }`}
            >
              <span>{isControlPanelOpen ? '✕ إغلاق لوحة التحكم' : '☰ فتح لوحة التحكم'}</span>
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-950/90 to-emeraldos-950 border border-rose-400/45 flex items-center justify-center shadow-[0_0_18px_rgba(244,63,94,0.35)]">
                <RedRubyGem size="sm" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xs sm:text-sm font-black text-white leading-tight">
                    <span className="text-platgold-400">تطبيق بن فيصل</span> لتحليل البيانات الذكي
                  </h1>
                </div>
                <p className="text-[10px] text-emeraldos-400 font-bold hidden sm:block">
                  منصة التحليل الإحصائي والرسوم البيانية • الملف النشط: {activeDataset.name}
                </p>
              </div>
            </div>
          </div>

          {/* Left: Window Controls (Minimize, Maximize/Restore, Exit X) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleMinimizeWindow}
              title="تصغير النافذة"
              aria-label="تصغير النافذة"
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-emeraldos-900/90 hover:bg-emeraldos-800 text-slate-200 hover:text-white border border-platgold-500/30 cursor-pointer transition"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="3" y1="8" x2="13" y2="8" />
              </svg>
            </button>

            <button
              type="button"
              onClick={handleToggleMaximizeWindow}
              title={windowMode === 'maximized' ? 'استعادة حجم النافذة' : 'تكبير النافذة'}
              aria-label={windowMode === 'maximized' ? 'استعادة حجم النافذة' : 'تكبير النافذة'}
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-emeraldos-900/90 hover:bg-emeraldos-800 text-platgold-200 hover:text-white border border-platgold-500/30 cursor-pointer transition"
            >
              {windowMode === 'maximized' ? (
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
                  <rect x="2.5" y="5" width="8.5" height="8.5" rx="1" />
                  <path d="M5 5V3.5A1 1 0 0 1 6 2.5h6.5a1 1 0 0 1 1 1V10a1 1 0 0 1-1 1H11" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">
                  <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={requestExitApp}
              title="خروج"
              aria-label="خروج"
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-rose-950/80 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/45 cursor-pointer transition"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="3.5" y1="3.5" x2="12.5" y2="12.5" />
                <line x1="12.5" y1="3.5" x2="3.5" y2="12.5" />
              </svg>
            </button>
          </div>
        </header>

        {/* Main Split Layout */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* ==================== COLLAPSIBLE CONTROL PANEL (CLOSED BY DEFAULT) ==================== */}
          {isControlPanelOpen && (
            <aside
              id="controlPanelFrame"
              className="w-[238px] shrink-0 m-2.5 ml-0 rounded-2xl bg-emeraldos-950/95 border border-platgold-500/35 p-2.5 flex flex-col justify-between overflow-y-auto shadow-2xl z-20 transition-all duration-300"
            >
              <div className="space-y-3">
                {SIDEBAR_GROUPS.map((grp) => (
                  <div key={grp.title} className="space-y-1.5">
                    <p className="text-[10px] font-extrabold text-platgold-400/80 px-1.5">{grp.title}</p>
                    {grp.items.map((item) => {
                      const isActive = activeInstance?.type === item.type;
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => openFeaturePage(item.type)}
                          className={`w-full px-2.5 py-2 rounded-xl flex items-center gap-2.5 text-xs font-bold cursor-pointer text-right transition ${
                            isActive
                              ? 'platgold-gradient text-emeraldos-950 font-black shadow-md'
                              : 'bg-emeraldos-900/60 hover:bg-emeraldos-800/85 text-white border border-platgold-500/15 hover:border-platgold-400/50'
                          }`}
                        >
                          <FeatureIcon type={item.type} active={isActive} />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

                <div className="mt-3 space-y-2">
                  {/* Account Quick Link */}
                  <button
                    type="button"
                    onClick={() => openFeaturePage('settings')}
                    className="w-full rounded-xl bg-emeraldos-900/85 hover:bg-emeraldos-800 border border-platgold-500/35 px-2.5 py-2 text-right flex items-center justify-between gap-2.5 cursor-pointer transition shadow"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <AccountIcon size="sm" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-platgold-300">
                          {firebaseUser ? 'حسابك النشط' : 'حول حسابك'}
                        </p>
                        <p className="text-[11px] font-black text-white truncate">
                          {firebaseUser
                            ? userProfile?.displayName || firebaseUser.displayName || firebaseUser.email
                            : 'تسجيل الدخول / إنشاء حساب'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-platgold-300 shrink-0">←</span>
                  </button>

                  {/* Developer Signature Card */}
                  <div className="rounded-xl bg-gradient-to-br from-emeraldos-900/95 via-emeraldos-950 to-emeraldos-900/95 border border-platgold-400/45 px-2.5 py-2.5 text-center shadow-[0_6px_18px_rgba(0,0,0,0.45)] space-y-1">
                    <div className="inline-flex items-center justify-center gap-1.5 bg-platgold-500/15 border border-platgold-400/30 rounded-lg px-2 py-0.5">
                      <span className="text-[10.5px] font-extrabold text-platgold-200 tracking-wide">
                        💻 برمجة وتطوير
                      </span>
                    </div>
                    <p className="text-[12px] font-black text-white leading-snug">
                      المهندس / <span className="text-platgold-300">زكريا فيصل العزعزي</span>
                    </p>
                  </div>
                </div>
              </aside>
            )}

            {/* ==================== MAIN WORKSPACE AREA ==================== */}
            <main id="mainWorkspace" className="flex-1 min-w-0 flex flex-col overflow-hidden relative">
              {/* Multi-Instance Tab Bar */}
              {openInstances.length > 0 && currentInstanceId && (
                <div className="flex items-center justify-between px-4 py-2 bg-emeraldos-950/80 border-b border-platgold-500/30 gap-2 overflow-x-auto shrink-0 backdrop-blur-md">
                  <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                    {openInstances.map((inst) => {
                      const isActive = inst.instanceId === currentInstanceId;
                      return (
                        <div
                          key={inst.instanceId}
                          onClick={() => setCurrentInstanceId(inst.instanceId)}
                          className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 cursor-pointer shrink-0 transition ${
                            isActive
                              ? 'bg-emeraldos-800 border border-platgold-400 text-platgold-200 font-black shadow'
                              : 'bg-emeraldos-950/80 border border-platgold-500/20 text-slate-300 hover:text-white'
                          }`}
                        >
                          <FeatureIcon type={inst.type} size="xs" active={isActive} />
                          <span>{inst.title}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              closeTabOnly(inst.instanceId);
                            }}
                            className="hover:text-rose-400 px-1 cursor-pointer"
                            aria-label="إغلاق التبويب"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={goHomeScreen}
                    className="bg-emeraldos-900 hover:bg-emeraldos-800 text-platgold-300 border border-platgold-500/35 font-black text-xs px-3 py-1 rounded-lg shrink-0 flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <span>🏠 الرئيسية</span>
                  </button>
                </div>
              )}

              {/* Home vs Active Large Page */}
              {!activeInstance ? (
                <CinematicHome />
              ) : (
                <div id="pagesContainer" className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-4 lg:p-5">
                  {(() => {
                    const ds = datasets[activeInstance.datasetKey] || activeDataset;
                    if (activeInstance.type === 'dashboard') {
                      return (
                        <DashboardPage
                          instance={activeInstance}
                          dataset={ds}
                          datasets={datasets}
                          onUpdateConfig={updateInstanceConfig}
                          onChangeDataset={changeInstanceDataset}
                          onRefresh={refreshInstance}
                          onRequestSave={(summary) => requestSaveAnalysis(activeInstance, ds, summary)}
                          onRequestPrint={setPrintPayload}
                          onCloseToHome={exitInstanceToHome}
                          onToast={showToast}
                        />
                      );
                    }
                    if (activeInstance.type === 'studio') {
                      return (
                        <ChartsStudioPage
                          instance={activeInstance}
                          dataset={ds}
                          datasets={datasets}
                          onUpdateConfig={updateInstanceConfig}
                          onChangeDataset={changeInstanceDataset}
                          onRefresh={refreshInstance}
                          onRequestSave={(summary) => requestSaveAnalysis(activeInstance, ds, summary)}
                          onRequestPrint={setPrintPayload}
                          onCloseToHome={exitInstanceToHome}
                          onToast={showToast}
                        />
                      );
                    }
                    if (activeInstance.type === 'stats') {
                      return (
                        <StatsPage
                          instance={activeInstance}
                          dataset={ds}
                          datasets={datasets}
                          onChangeDataset={changeInstanceDataset}
                          onRefresh={refreshInstance}
                          onRequestSave={(summary) => requestSaveAnalysis(activeInstance, ds, summary)}
                          onRequestPrint={setPrintPayload}
                          onCloseToHome={exitInstanceToHome}
                          onToast={showToast}
                        />
                      );
                    }
                    if (activeInstance.type === 'reports') {
                      return (
                        <ReportsPage
                          instance={activeInstance}
                          dataset={ds}
                          datasets={datasets}
                          company={company}
                          savedAnalyses={savedAnalyses}
                          onChangeDataset={changeInstanceDataset}
                          onUpdateConfig={updateInstanceConfig}
                          onRefresh={refreshInstance}
                          onRequestSave={(summary) => requestSaveAnalysis(activeInstance, ds, summary)}
                          onRequestPrint={setPrintPayload}
                          onDeleteAnalysis={requestDeleteAnalysis}
                          onCloseToHome={exitInstanceToHome}
                        />
                      );
                    }
                    if (activeInstance.type === 'details') {
                      return (
                        <DataExplorerPage
                          instance={activeInstance}
                          dataset={ds}
                          datasets={datasets}
                          onChangeDataset={changeInstanceDataset}
                          onUpdateConfig={updateInstanceConfig}
                          onRefresh={refreshInstance}
                          onRequestSave={(summary) => requestSaveAnalysis(activeInstance, ds, summary)}
                          onRequestPrint={setPrintPayload}
                          onCloseToHome={exitInstanceToHome}
                          onToast={showToast}
                        />
                      );
                    }
                    if (activeInstance.type === 'loader') {
                      return (
                        <DataLoaderPage
                          instance={activeInstance}
                          activeDatasetKey={activeDatasetKey}
                          datasets={datasets}
                          onSelectGlobalDataset={(k, instId) => changeInstanceDataset(instId, k)}
                          onAddCustomDataset={handleAddCustomDataset}
                          onRemoveCustomDataset={requestRemoveCustomDataset}
                          onOpenFeature={openFeaturePage}
                          onRefresh={refreshInstance}
                          onRequestSave={(summary) => requestSaveAnalysis(activeInstance, ds, summary)}
                          onCloseToHome={exitInstanceToHome}
                          onToast={showToast}
                        />
                      );
                    }
                    if (activeInstance.type === 'settings') {
                      return (
                        <SettingsPage
                          instance={activeInstance}
                          firebaseUser={firebaseUser}
                          userProfile={userProfile}
                          company={company}
                          savedCount={savedAnalyses.length}
                          customDatasetsCount={Object.values(datasets).filter((d) => d.isCustom).length}
                          onSaveCompany={requestSaveCompany}
                          onRequestUpdateAccount={requestUpdateAccountProfile}
                          onRequestLogout={requestLogout}
                          onRequestClearAllData={requestClearAllData}
                          onRefresh={refreshInstance}
                          onCloseToHome={exitInstanceToHome}
                          onToast={showToast}
                        />
                      );
                    }
                    return (
                      <AboutPage
                        instance={activeInstance}
                        userProfile={userProfile}
                        activeDataset={ds}
                        onRefresh={refreshInstance}
                        onConfirmAction={({ title, message, confirmLabel, onConfirm }) => {
                          setConfirmModal({
                            open: true,
                            title,
                            message,
                            confirmLabel,
                            cancelLabel: '✕ إلغاء',
                            tone: 'primary',
                            onCancel: closeConfirmModal,
                            onConfirm: () => {
                              onConfirm();
                              closeConfirmModal();
                            },
                          });
                        }}
                        onCloseToHome={exitInstanceToHome}
                        onToast={showToast}
                      />
                    );
                  })()}
                </div>
              )}
            </main>
          </div>
        </div>

      {/* Confirmation Modal */}
      <ConfirmModal {...confirmModal} />

      {/* Print Modal with Automatic Company Header */}
      <PrintModal payload={printPayload} company={company} onClose={() => setPrintPayload(null)} />

      {/* Toast Notification */}
      <div
        className={`no-print fixed bottom-4 left-4 bg-emeraldos-900 border border-platgold-400 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 transition-all duration-300 z-50 text-xs font-bold ${
          toast.open ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'
        }`}
      >
        <span>{toast.type === 'error' ? '⚠️' : '✅'}</span>
        <span>{toast.msg}</span>
      </div>
    </div>
  );
}
