import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  OfflineCompanySettings,
  OfflineDataset,
  OfflinePageInstance,
  OfflinePageType,
  OfflinePrintPayload,
  OfflineSavedAnalysis,
  OfflineUserProfile,
} from './offline.types';
import {
  clearAllOfflineDatabaseData,
  clearOfflineLocalUser,
  deleteOfflineAnalysis,
  deleteOfflineCustomDataset,
  exportOfflineDatabaseBackup,
  importOfflineDatabaseBackup,
  initOfflineDatabase,
  loadOfflineCompanySettings,
  loadOfflineCustomDatasets,
  loadOfflineLocalUser,
  loadOfflineSavedAnalyses,
  OFFLINE_DB_NAME,
  saveOfflineAnalysis,
  saveOfflineCompanySettings,
  saveOfflineCustomDataset,
  saveOfflineLocalUser,
} from './offlineLocalDb';
import { OFFLINE_BUILTIN_DATASETS } from './offlineSampleData';
import { useOfflinePWA } from './useOfflinePWA';
import { OfflineConfirmDialog, type OfflineConfirmConfig } from './components/OfflineConfirmDialog';
import { OfflineAccountIcon, OfflineFeatureBadge } from './components/OfflineFeatureBadge';
import { OfflineHomeBackdrop } from './components/OfflineHomeBackdrop';
import { OfflinePrintSheet } from './components/OfflinePrintSheet';
import { OfflineRubyGem } from './components/OfflineRubyGem';
import { OFFLINE_PAGE_META } from './components/OfflineToolbar';
import { OfflineAboutPage } from './pages/OfflineAboutPage';
import { OfflineChartsPage } from './pages/OfflineChartsPage';
import { OfflineDashboardPage } from './pages/OfflineDashboardPage';
import { OfflineExplorerPage } from './pages/OfflineExplorerPage';
import { OfflineImportPage } from './pages/OfflineImportPage';
import { OfflineReportsPage } from './pages/OfflineReportsPage';
import { OfflineSettingsPage } from './pages/OfflineSettingsPage';
import { OfflineStatsPage } from './pages/OfflineStatsPage';

const OFFLINE_SIDEBAR_GROUPS: Array<{ title: string; items: Array<{ type: OfflinePageType; label: string }> }> = [
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

const SESSION_OFF_TABS_KEY = 'bf_off_tabs_v1';
const SESSION_OFF_ACTIVE_TAB_KEY = 'bf_off_active_tab_v1';
const SESSION_OFF_PANEL_KEY = 'bf_off_panel_v1';
const SESSION_OFF_DATASET_KEY = 'bf_off_dataset_v1';

function readSessionJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function OfflineApp() {
  const { isInstallable, isInstalled, isOnline, installApp } = useOfflinePWA();

  const [dbStatus, setDbStatus] = useState<{ engine: 'IndexedDB' | 'LocalStorage'; dbName: string }>({
    engine: 'IndexedDB',
    dbName: OFFLINE_DB_NAME,
  });

  const [datasets, setDatasets] = useState<Record<string, OfflineDataset>>(() => ({
    ...OFFLINE_BUILTIN_DATASETS,
  }));
  const [activeDatasetKey, setActiveDatasetKey] = useState<string>(() =>
    readSessionJson<string>(SESSION_OFF_DATASET_KEY, 'sales')
  );
  const [company, setCompany] = useState<OfflineCompanySettings>({
    companyName: '',
    location: '',
    address: '',
    logoDataUrl: '',
  });
  const [savedAnalyses, setSavedAnalyses] = useState<OfflineSavedAnalysis[]>([]);
  const [userProfile, setUserProfile] = useState<OfflineUserProfile | null>(null);

  const [isControlPanelOpen, setIsControlPanelOpen] = useState<boolean>(() =>
    readSessionJson<boolean>(SESSION_OFF_PANEL_KEY, false)
  );
  const [windowMode, setWindowMode] = useState<'compact' | 'normal' | 'maximized'>('normal');
  const [openInstances, setOpenInstances] = useState<OfflinePageInstance[]>(() =>
    readSessionJson<OfflinePageInstance[]>(SESSION_OFF_TABS_KEY, [])
  );
  const [currentInstanceId, setCurrentInstanceId] = useState<string | null>(() => {
    const tabs = readSessionJson<OfflinePageInstance[]>(SESSION_OFF_TABS_KEY, []);
    const activeId = readSessionJson<string | null>(SESSION_OFF_ACTIVE_TAB_KEY, null);
    return activeId && tabs.some((t) => t.instanceId === activeId) ? activeId : null;
  });

  const typeCountersRef = useRef<Record<OfflinePageType, number>>({
    dashboard: openInstances.filter((p) => p.type === 'dashboard').length,
    studio: openInstances.filter((p) => p.type === 'studio').length,
    stats: openInstances.filter((p) => p.type === 'stats').length,
    reports: openInstances.filter((p) => p.type === 'reports').length,
    details: openInstances.filter((p) => p.type === 'details').length,
    loader: openInstances.filter((p) => p.type === 'loader').length,
    settings: openInstances.filter((p) => p.type === 'settings').length,
    about: openInstances.filter((p) => p.type === 'about').length,
  });

  // Hydrate full local IndexedDB state on mount (zero internet calls)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const info = await initOfflineDatabase();
      const [customDs, storedCompany, storedAnalyses, storedUser] = await Promise.all([
        loadOfflineCustomDatasets(),
        loadOfflineCompanySettings(),
        loadOfflineSavedAnalyses(),
        loadOfflineLocalUser(),
      ]);
      if (cancelled) return;
      setDbStatus(info);
      setDatasets({ ...OFFLINE_BUILTIN_DATASETS, ...customDs });
      setCompany(storedCompany);
      setSavedAnalyses(storedAnalyses);
      setUserProfile(storedUser);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep session workspace tabs intact across refreshes
  useEffect(() => {
    try {
      window.sessionStorage?.setItem(SESSION_OFF_TABS_KEY, JSON.stringify(openInstances));
      window.sessionStorage?.setItem(SESSION_OFF_ACTIVE_TAB_KEY, JSON.stringify(currentInstanceId));
      window.sessionStorage?.setItem(SESSION_OFF_PANEL_KEY, JSON.stringify(isControlPanelOpen));
      window.sessionStorage?.setItem(SESSION_OFF_DATASET_KEY, JSON.stringify(activeDatasetKey));
    } catch {
      // ignore storage errors
    }
  }, [openInstances, currentInstanceId, isControlPanelOpen, activeDatasetKey]);

  const [printPayload, setPrintPayload] = useState<OfflinePrintPayload | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<OfflineConfirmConfig>({
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

  const closeConfirmDialog = () =>
    setConfirmDialog((prev) => ({ ...prev, open: false, loading: false }));

  // Page instance management
  const createPageInstance = useCallback(
    (type: OfflinePageType): OfflinePageInstance => {
      typeCountersRef.current[type] = (typeCountersRef.current[type] || 0) + 1;
      const num = typeCountersRef.current[type];
      const ds = datasets[activeDatasetKey] || datasets.sales;
      return {
        instanceId: `off_${type}_${num}_${Date.now()}`,
        type,
        title: num === 1 ? OFFLINE_PAGE_META[type].title : `${OFFLINE_PAGE_META[type].title} (${num})`,
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

  const openFeaturePage = (type: OfflinePageType) => {
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

  const goHomeScreen = () => setCurrentInstanceId(null);

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

  const updateInstanceConfig = (instanceId: string, patch: Partial<OfflinePageInstance>) => {
    setOpenInstances((prev) =>
      prev.map((p) => (p.instanceId === instanceId ? { ...p, ...patch } : p))
    );
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

  const handleAddCustomDataset = async (ds: OfflineDataset) => {
    const saved = await saveOfflineCustomDataset(ds);
    setDatasets((prev) => ({ ...prev, [saved.id]: saved }));
    setActiveDatasetKey(saved.id);
    setOpenInstances((prev) =>
      prev.map((p) => ({
        ...p,
        datasetKey: saved.id,
        xCol: saved.defaultX,
        yCol: saved.defaultY,
        catFilter: 'ALL',
        search: '',
      }))
    );
  };

  const requestRemoveCustomDataset = (ds: OfflineDataset) => {
    setConfirmDialog({
      open: true,
      title: 'تأكيد حذف الملف من قاعدة البيانات المحلية',
      message: `هل أنت متأكد من حذف الملف "${ds.name}"؟ سيتم إزالته نهائياً من قاعدة البيانات المحلية (${dbStatus.engine}).`,
      confirmLabel: '✓ نعم، حذف الملف',
      cancelLabel: '✕ إلغاء',
      tone: 'danger',
      onCancel: closeConfirmDialog,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, loading: true }));
        try {
          await deleteOfflineCustomDataset(ds.id);
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
                    xCol: OFFLINE_BUILTIN_DATASETS.sales.defaultX,
                    yCol: OFFLINE_BUILTIN_DATASETS.sales.defaultY,
                    catFilter: 'ALL',
                    search: '',
                  }
                : p
            )
          );
          closeConfirmDialog();
          showToast(`تم حذف الملف "${ds.name}" بنجاح`);
        } catch (err) {
          closeConfirmDialog();
          showToast(err instanceof Error ? err.message : 'تعذر حذف الملف', 'error');
        }
      },
    });
  };

  const requestSaveAnalysis = (inst: OfflinePageInstance, ds: OfflineDataset, summaryText: string) => {
    const pageType = (['dashboard', 'studio', 'stats', 'details', 'reports', 'loader'].includes(inst.type)
      ? inst.type
      : 'dashboard') as OfflineSavedAnalysis['pageType'];

    setConfirmDialog({
      open: true,
      title: 'تأكيد الحفظ في قاعدة البيانات المحلية',
      message: 'هل أنت متأكد من حفظ البيانات؟ سيتم تخزين لقطة التحليل الحالية في قاعدة IndexedDB على جهازك.',
      confirmLabel: '✓ نعم، حفظ محلياً',
      cancelLabel: '✕ إلغاء',
      tone: 'primary',
      onCancel: closeConfirmDialog,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, loading: true }));
        try {
          const created = await saveOfflineAnalysis({
            ownerId: userProfile?.uid || 'offline_local_user',
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
          closeConfirmDialog();
          showToast('تم حفظ التحليل في قاعدة البيانات المحلية بنجاح!');
        } catch (err) {
          closeConfirmDialog();
          showToast(err instanceof Error ? err.message : 'تعذر حفظ التحليل محلياً', 'error');
        }
      },
    });
  };

  const requestDeleteAnalysis = (rec: OfflineSavedAnalysis) => {
    setConfirmDialog({
      open: true,
      title: 'تأكيد حذف التحليل',
      message: `هل أنت متأكد من حذف التحليل "${rec.title}" (${rec.datasetName})؟ لا يمكن التراجع عن هذا الإجراء.`,
      confirmLabel: '✓ نعم، حذف',
      cancelLabel: '✕ إلغاء',
      tone: 'danger',
      onCancel: closeConfirmDialog,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, loading: true }));
        try {
          await deleteOfflineAnalysis(rec.id);
          setSavedAnalyses((prev) => prev.filter((r) => r.id !== rec.id));
          closeConfirmDialog();
          showToast('تم حذف التحليل المحفوظ محلياً');
        } catch (err) {
          closeConfirmDialog();
          showToast(err instanceof Error ? err.message : 'تعذر حذف السجل', 'error');
        }
      },
    });
  };

  const requestSaveCompany = (next: OfflineCompanySettings): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmDialog({
        open: true,
        title: 'تأكيد حفظ بيانات الشركة',
        message: 'هل أنت متأكد من حفظ بيانات الشركة في قاعدة البيانات المحلية؟ سيتم اعتمادها في جميع المطبوعات.',
        confirmLabel: '✓ نعم، حفظ البيانات',
        cancelLabel: '✕ إلغاء',
        tone: 'primary',
        onCancel: () => {
          closeConfirmDialog();
          resolve(false);
        },
        onConfirm: async () => {
          setConfirmDialog((prev) => ({ ...prev, loading: true }));
          try {
            const saved = await saveOfflineCompanySettings(next);
            setCompany(saved);
            closeConfirmDialog();
            resolve(true);
          } catch (err) {
            closeConfirmDialog();
            showToast(err instanceof Error ? err.message : 'تعذر حفظ بيانات الشركة', 'error');
            resolve(false);
          }
        },
      });
    });
  };

  const requestSaveLocalUser = (params: {
    displayName: string;
    email?: string;
    phone?: string;
    role?: string;
  }): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmDialog({
        open: true,
        title: 'تأكيد حفظ الحساب المحلي',
        message: `هل أنت متأكد من حفظ بيانات المستخدم "${params.displayName.trim()}" في قاعدة البيانات المحلية؟`,
        confirmLabel: '✓ نعم، حفظ الحساب',
        cancelLabel: '✕ إلغاء',
        tone: 'primary',
        onCancel: () => {
          closeConfirmDialog();
          resolve(false);
        },
        onConfirm: async () => {
          setConfirmDialog((prev) => ({ ...prev, loading: true }));
          try {
            const saved = await saveOfflineLocalUser(params);
            setUserProfile(saved);
            closeConfirmDialog();
            resolve(true);
          } catch (err) {
            closeConfirmDialog();
            showToast(err instanceof Error ? err.message : 'تعذر حفظ الحساب المحلي', 'error');
            resolve(false);
          }
        },
      });
    });
  };

  const requestLogoutLocalUser = () => {
    setConfirmDialog({
      open: true,
      title: 'تأكيد تسجيل الخروج من الحساب المحلي',
      message: 'هل أنت متأكد من تسجيل الخروج من ملف المستخدم المحلي الحالي؟',
      confirmLabel: '✓ نعم، تسجيل الخروج',
      cancelLabel: '✕ إلغاء',
      tone: 'danger',
      onCancel: closeConfirmDialog,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, loading: true }));
        try {
          await clearOfflineLocalUser();
          setUserProfile(null);
          closeConfirmDialog();
          showToast('تم تسجيل الخروج من الحساب المحلي بنجاح');
        } catch (err) {
          closeConfirmDialog();
          showToast(err instanceof Error ? err.message : 'تعذر تسجيل الخروج', 'error');
        }
      },
    });
  };

  const handleExportBackupJson = async (): Promise<string> => {
    const backup = await exportOfflineDatabaseBackup();
    return JSON.stringify(backup, null, 2);
  };

  const handleImportBackupJson = (rawJson: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmDialog({
        open: true,
        title: 'تأكيد استعادة النسخة الاحتياطية',
        message: 'هل أنت متأكد من استيراد النسخة الاحتياطية ودمجها في قاعدة البيانات المحلية؟',
        confirmLabel: '✓ نعم، استعادة الآن',
        cancelLabel: '✕ إلغاء',
        tone: 'primary',
        onCancel: () => {
          closeConfirmDialog();
          resolve(false);
        },
        onConfirm: async () => {
          setConfirmDialog((prev) => ({ ...prev, loading: true }));
          try {
            const restored = await importOfflineDatabaseBackup(rawJson);
            const dsMap: Record<string, OfflineDataset> = { ...OFFLINE_BUILTIN_DATASETS };
            for (const ds of restored.customDatasets) dsMap[ds.id] = ds;
            setDatasets(dsMap);
            setSavedAnalyses(restored.savedAnalyses);
            setCompany(restored.company);
            setUserProfile(restored.userProfile);
            closeConfirmDialog();
            resolve(true);
          } catch (err) {
            closeConfirmDialog();
            showToast(err instanceof Error ? err.message : 'ملف النسخة الاحتياطية غير صالح', 'error');
            resolve(false);
          }
        },
      });
    });
  };

  const requestClearAllData = () => {
    setConfirmDialog({
      open: true,
      title: 'تحذير: مسح جميع البيانات المحلية',
      message:
        'هل أنت متأكد من مسح جميع البيانات المحفوظة في قاعدة IndexedDB؟ سيتم حذف الملفات المرفوعة والتحليلات وبيانات الشركة والحساب المحلي، مع بقاء البيانات التجريبية الأساسية.',
      confirmLabel: '✓ نعم، مسح الكل',
      cancelLabel: '✕ إلغاء',
      tone: 'danger',
      onCancel: closeConfirmDialog,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, loading: true }));
        try {
          await clearAllOfflineDatabaseData();
          setDatasets({ ...OFFLINE_BUILTIN_DATASETS });
          setActiveDatasetKey('sales');
          setCompany({ companyName: '', location: '', address: '', logoDataUrl: '' });
          setSavedAnalyses([]);
          setUserProfile(null);
          setOpenInstances((prev) =>
            prev.map((p) => ({
              ...p,
              datasetKey: 'sales',
              xCol: OFFLINE_BUILTIN_DATASETS.sales.defaultX,
              yCol: OFFLINE_BUILTIN_DATASETS.sales.defaultY,
              catFilter: 'ALL',
              search: '',
            }))
          );
          closeConfirmDialog();
          showToast('تم مسح جميع البيانات المحلية بنجاح!');
        } catch (err) {
          closeConfirmDialog();
          showToast(err instanceof Error ? err.message : 'تعذر مسح البيانات المحلية', 'error');
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
    setConfirmDialog({
      open: true,
      title: 'تأكيد الخروج',
      message: 'هل أنت متأكد من الخروج وإغلاق جميع النوافذ المفتوحة والعودة للشاشة الرئيسية؟',
      confirmLabel: '✓ نعم، خروج',
      cancelLabel: '✕ إلغاء',
      tone: 'danger',
      onCancel: closeConfirmDialog,
      onConfirm: () => {
        setOpenInstances([]);
        setCurrentInstanceId(null);
        setIsControlPanelOpen(false);
        setWindowMode('normal');
        closeConfirmDialog();
        showToast('تم إغلاق النوافذ والعودة إلى الشاشة الرئيسية');
      },
    });
  };

  const activeInstance = openInstances.find((p) => p.instanceId === currentInstanceId) || null;
  const activeDataset = datasets[activeDatasetKey] || datasets.sales;

  const windowContainerClass =
    windowMode === 'maximized'
      ? 'm-0 rounded-none'
      : windowMode === 'compact'
        ? 'my-4 sm:my-7 mx-auto w-[94%] max-w-5xl rounded-2xl shadow-2xl'
        : 'm-2 sm:m-3 rounded-2xl';

  return (
    <div className="h-screen w-screen emerald-wallpaper relative flex flex-col overflow-hidden" dir="rtl">
      <div
        id="offlineAppWindow"
        className={`no-print relative z-20 flex-1 glass-panel-emerald emerald-glow-border flex flex-col overflow-hidden transition-all duration-300 ${windowContainerClass}`}
      >
        {/* Top Bar */}
        <header className="bg-gradient-to-r from-emeraldos-950 via-emeraldos-900 to-emeraldos-950 border-b border-platgold-500/35 px-4 py-2 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <button
              id="offlineTogglePanelBtn"
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
                <OfflineRubyGem size="sm" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xs sm:text-sm font-black text-white leading-tight">
                    <span className="text-platgold-400">تطبيق بن فيصل</span> لتحليل البيانات الذكي
                  </h1>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-200 border border-emerald-400/35">
                    📴 بدون إنترنت ({dbStatus.engine})
                  </span>
                </div>
                <p className="text-[10px] text-emeraldos-400 font-bold hidden sm:block">
                  قاعدة البيانات المحلية: {dbStatus.dbName} • الملف النشط: {activeDataset.name}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isInstalled && isInstallable && (
              <button
                type="button"
                onClick={installApp}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg platgold-gradient text-emeraldos-950 text-[11px] font-black cursor-pointer transition"
              >
                📲 تثبيت للتشغيل بدون نت
              </button>
            )}

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

        {/* Split Layout */}
        <div className="flex-1 flex overflow-hidden relative">
          {isControlPanelOpen && (
            <aside
              id="offlineControlPanelFrame"
              className="w-[242px] shrink-0 m-2.5 ml-0 rounded-2xl bg-emeraldos-950/95 border border-platgold-500/35 p-2.5 flex flex-col justify-between overflow-y-auto shadow-2xl z-20 transition-all duration-300"
            >
              <div className="space-y-3">
                {OFFLINE_SIDEBAR_GROUPS.map((grp) => (
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
                          <OfflineFeatureBadge type={item.type} active={isActive} />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="mt-3 space-y-2">
                {/* Local User Profile Quick Link */}
                <button
                  type="button"
                  onClick={() => openFeaturePage('settings')}
                  className="w-full rounded-xl bg-emeraldos-900/85 hover:bg-emeraldos-800 border border-platgold-500/35 px-2.5 py-2 text-right flex items-center justify-between gap-2.5 cursor-pointer transition shadow"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <OfflineAccountIcon size="sm" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-platgold-300">
                        {userProfile ? 'الحساب المحلي النشط' : 'حول حسابك المحلي'}
                      </p>
                      <p className="text-[11px] font-black text-white truncate">
                        {userProfile ? userProfile.displayName : 'إنشاء / ضبط حساب محلي'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-platgold-300 shrink-0">←</span>
                </button>

                {/* Switch to Online Edition Link */}
                <a
                  href="/"
                  className="w-full rounded-xl bg-sky-950/80 hover:bg-sky-900 border border-sky-400/35 px-2.5 py-2 text-right flex items-center justify-between gap-2 transition"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-sky-300">🌐 التبديل إلى النسخة السحابية</p>
                    <p className="text-[11px] font-black text-white truncate">فتح نسخة الإنترنت (Firebase)</p>
                  </div>
                  <span className="text-xs text-sky-300 shrink-0">↗</span>
                </a>

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

          {/* Main Workspace */}
          <main id="offlineMainWorkspace" className="flex-1 flex flex-col overflow-hidden relative">
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
                        <OfflineFeatureBadge type={inst.type} size="xs" active={isActive} />
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

            {!activeInstance ? (
              <OfflineHomeBackdrop />
            ) : (
              <div id="offlinePagesContainer" className="flex-1 overflow-y-auto p-4">
                {(() => {
                  const ds = datasets[activeInstance.datasetKey] || activeDataset;
                  if (activeInstance.type === 'dashboard') {
                    return (
                      <OfflineDashboardPage
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
                      <OfflineChartsPage
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
                      <OfflineStatsPage
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
                      <OfflineReportsPage
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
                      <OfflineExplorerPage
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
                      <OfflineImportPage
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
                      <OfflineSettingsPage
                        instance={activeInstance}
                        dbEngineName={dbStatus.engine}
                        dbName={dbStatus.dbName}
                        userProfile={userProfile}
                        company={company}
                        savedCount={savedAnalyses.length}
                        customDatasetsCount={Object.values(datasets).filter((d) => d.isCustom).length}
                        onSaveUserProfile={requestSaveLocalUser}
                        onRequestLogoutUser={requestLogoutLocalUser}
                        onSaveCompany={requestSaveCompany}
                        onExportBackup={handleExportBackupJson}
                        onImportBackup={handleImportBackupJson}
                        onRequestClearAllData={requestClearAllData}
                        onRefresh={refreshInstance}
                        onCloseToHome={exitInstanceToHome}
                        onToast={showToast}
                      />
                    );
                  }
                  return (
                    <OfflineAboutPage
                      instance={activeInstance}
                      userProfile={userProfile}
                      activeDataset={ds}
                      onRefresh={refreshInstance}
                      onConfirmAction={({ title, message, confirmLabel, onConfirm }) => {
                        setConfirmDialog({
                          open: true,
                          title,
                          message,
                          confirmLabel,
                          cancelLabel: '✕ إلغاء',
                          tone: 'primary',
                          onCancel: closeConfirmDialog,
                          onConfirm: () => {
                            onConfirm();
                            closeConfirmDialog();
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

      {/* Offline Connectivity Subtle Notice (Bottom-Right when offline) */}
      {!isOnline && (
        <div className="no-print fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-xl bg-emeraldos-950/95 border border-emerald-400/45 px-3 py-1.5 text-[11px] font-black text-emerald-200 shadow-lg">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>وضع العمل بدون إنترنت — قاعدة البيانات المحلية نشطة</span>
        </div>
      )}

      {/* Confirm Dialog */}
      <OfflineConfirmDialog {...confirmDialog} />

      {/* Print Preview Modal */}
      <OfflinePrintSheet payload={printPayload} company={company} onClose={() => setPrintPayload(null)} />

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
