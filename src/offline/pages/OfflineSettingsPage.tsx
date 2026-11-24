import React, { useEffect, useRef, useState } from 'react';
import type { OfflineCompanySettings, OfflinePageInstance, OfflineUserProfile } from '../offline.types';
import { compressOfflineLogoFile, downloadOfflineBlobFile } from '../offlineDataEngine';
import { OfflineAccountIcon } from '../components/OfflineFeatureBadge';
import { OfflineToolbar } from '../components/OfflineToolbar';
import { useOfflinePWA } from '../useOfflinePWA';

interface OfflineSettingsPageProps {
  instance: OfflinePageInstance;
  dbEngineName: 'IndexedDB' | 'LocalStorage';
  dbName: string;
  userProfile: OfflineUserProfile | null;
  company: OfflineCompanySettings;
  savedCount: number;
  customDatasetsCount: number;
  onSaveUserProfile: (params: {
    displayName: string;
    email?: string;
    phone?: string;
    role?: string;
  }) => Promise<boolean>;
  onRequestLogoutUser: () => void;
  onSaveCompany: (next: OfflineCompanySettings) => Promise<boolean>;
  onExportBackup: () => Promise<string>;
  onImportBackup: (rawJson: string) => Promise<boolean>;
  onRequestClearAllData: () => void;
  onRefresh: (instanceId: string) => void;
  onCloseToHome: (instanceId: string) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const OfflineSettingsPage: React.FC<OfflineSettingsPageProps> = ({
  instance,
  dbEngineName,
  dbName,
  userProfile,
  company,
  savedCount,
  customDatasetsCount,
  onSaveUserProfile,
  onRequestLogoutUser,
  onSaveCompany,
  onExportBackup,
  onImportBackup,
  onRequestClearAllData,
  onRefresh,
  onCloseToHome,
  onToast,
}) => {
  const { isInstallable, isInstalled, isIOS, isOnline, installApp } = useOfflinePWA();

  // Local user form state
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [email, setEmail] = useState(userProfile?.email || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [role, setRole] = useState(userProfile?.role || 'محلل بيانات محلي');
  const [savingUser, setSavingUser] = useState(false);

  // Company form state
  const [companyName, setCompanyName] = useState(company.companyName);
  const [location, setLocation] = useState(company.location);
  const [address, setAddress] = useState(company.address);
  const [logoDataUrl, setLogoDataUrl] = useState(company.logoDataUrl);
  const [savingCompany, setSavingCompany] = useState(false);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDisplayName(userProfile?.displayName || '');
    setEmail(userProfile?.email || '');
    setPhone(userProfile?.phone || '');
    setRole(userProfile?.role || 'محلل بيانات محلي');
  }, [userProfile]);

  useEffect(() => {
    setCompanyName(company.companyName);
    setLocation(company.location);
    setAddress(company.address);
    setLogoDataUrl(company.logoDataUrl);
  }, [company]);

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      onToast('يرجى كتابة اسم المستخدم المحلي.', 'error');
      return;
    }
    setSavingUser(true);
    try {
      const ok = await onSaveUserProfile({ displayName, email, phone, role });
      if (ok) {
        onToast('تم حفظ ملف المستخدم المحلي في قاعدة IndexedDB بنجاح!');
      }
    } finally {
      setSavingUser(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    try {
      const compressed = await compressOfflineLogoFile(file, 300);
      setLogoDataUrl(compressed);
      onToast('تم رفع شعار الشركة وتجهيزه محلياً بنجاح');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'تعذر معالجة صورة الشعار', 'error');
    }
  };

  const handleSubmitCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCompany(true);
    try {
      const confirmed = await onSaveCompany({
        companyName,
        location,
        address,
        logoDataUrl,
      });
      if (confirmed) {
        onToast('تم حفظ بيانات الشركة محلياً بنجاح وسيتم إرفاقها في جميع المطبوعات!');
      }
    } finally {
      setSavingCompany(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const rawJson = await onExportBackup();
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadOfflineBlobFile(rawJson, `BenFaisal_Offline_Backup_${dateStr}.json`, 'application/json');
      onToast('تم تصدير نسخة احتياطية كاملة لقاعدة البيانات المحلية!');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'تعذر تصدير النسخة الاحتياطية', 'error');
    }
  };

  const handleUploadBackup = (file: File) => {
    const reader = new FileReader();
    reader.onerror = () => onToast('تعذر قراءة ملف النسخة الاحتياطية.', 'error');
    reader.onload = async (ev) => {
      const raw = String(ev.target?.result || '');
      const ok = await onImportBackup(raw);
      if (ok) {
        onToast('تمت استعادة البيانات من النسخة الاحتياطية بنجاح!');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  return (
    <div className="flex flex-col gap-5 min-h-full">
      <OfflineToolbar instance={instance} onRefresh={onRefresh} onCloseToHome={onCloseToHome} />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Local Offline Account Card ("حول حسابك المحلي") */}
        <div className="xl:col-span-12 bg-emeraldos-900/95 border border-platgold-400/45 rounded-2xl p-6 space-y-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-4">
            <div className="flex items-center gap-3">
              <OfflineAccountIcon size="lg" />
              <div>
                <h3 className="text-base font-black text-white">حول حسابك المحلي (بدون إنترنت)</h3>
                <p className="text-xs text-platgold-300 font-bold mt-0.5">
                  {userProfile
                    ? `مسجل محلياً باسم: ${userProfile.displayName} • ${userProfile.role}`
                    : 'أنشئ ملف المستخدم المحلي الخاص بك لحفظ هويتك على هذا الجهاز'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-black px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/35">
                {userProfile ? '🟢 حساب محلي نشط' : '🟡 وضع ضيف محلي'}
              </span>
              {userProfile && (
                <button
                  type="button"
                  onClick={onRequestLogoutUser}
                  className="px-4 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-black border border-rose-400/45 cursor-pointer transition"
                >
                  🚪 تسجيل الخروج
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmitUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div>
              <label htmlFor="offUserName" className="block text-[11px] font-bold text-platgold-300 mb-1">
                اسم المستخدم المحلي:
              </label>
              <input
                id="offUserName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="مثال: المهندس زكريا"
                className="w-full bg-emeraldos-950 text-white text-xs font-bold rounded-xl px-3.5 py-2.5 border border-platgold-500/30 outline-none focus:border-platgold-400"
              />
            </div>
            <div>
              <label htmlFor="offUserEmail" className="block text-[11px] font-bold text-platgold-300 mb-1">
                البريد الإلكتروني (اختياري):
              </label>
              <input
                id="offUserEmail"
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.local"
                className="w-full bg-emeraldos-950 text-white text-xs font-bold rounded-xl px-3.5 py-2.5 border border-platgold-500/30 outline-none focus:border-platgold-400"
              />
            </div>
            <div>
              <label htmlFor="offUserPhone" className="block text-[11px] font-bold text-platgold-300 mb-1">
                رقم الهاتف (اختياري):
              </label>
              <input
                id="offUserPhone"
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+967..."
                className="w-full bg-emeraldos-950 text-white text-xs font-bold rounded-xl px-3.5 py-2.5 border border-platgold-500/30 outline-none focus:border-platgold-400"
              />
            </div>
            <div>
              <label htmlFor="offUserRole" className="block text-[11px] font-bold text-platgold-300 mb-1">
                الصفة / المسمى الوظيفي:
              </label>
              <input
                id="offUserRole"
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="محلل بيانات محلي"
                className="w-full bg-emeraldos-950 text-white text-xs font-bold rounded-xl px-3.5 py-2.5 border border-platgold-500/30 outline-none focus:border-platgold-400"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-[11px] text-slate-300">
                يُحفظ ملف المستخدم مباشرة داخل قاعدة بيانات جهازك ({dbName}) ويعمل 100% بدون إنترنت.
              </p>
              <button
                type="submit"
                disabled={savingUser}
                className="platgold-gradient text-emeraldos-950 font-black text-xs px-5 py-2.5 rounded-xl cursor-pointer transition disabled:opacity-60"
              >
                {savingUser ? '⏳ جاري الحفظ...' : userProfile ? '💾 حفظ تعديلات الحساب' : '✨ إنشاء وحفظ الحساب المحلي'}
              </button>
            </div>
          </form>
        </div>

        {/* Company Branding Settings */}
        <form
          onSubmit={handleSubmitCompany}
          className="xl:col-span-7 bg-emeraldos-900/90 border border-platgold-500/30 rounded-2xl p-6 space-y-5"
        >
          <div className="border-b border-white/15 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white">⚙️ بيانات الشركة</h3>
              <p className="text-xs text-platgold-300 mt-0.5">
                تظهر هذه البيانات والشعار تلقائياً أعلى تقارير الطباعة والمخططات
              </p>
            </div>
            <span className="text-2xl">🏢</span>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="offCompanyNameInput" className="block text-xs font-extrabold text-platgold-300 mb-1.5">
                اسم الشركة / المؤسسة
              </label>
              <input
                id="offCompanyNameInput"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="مثال: شركة النخبة لتحليل البيانات"
                maxLength={160}
                className="w-full bg-emeraldos-950 text-white text-sm font-bold rounded-xl px-4 py-2.5 border border-platgold-500/30 outline-none focus:border-platgold-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="offCompanyLocInput" className="block text-xs font-extrabold text-platgold-300 mb-1.5">
                  📍 الموقع (المدينة / الدولة)
                </label>
                <input
                  id="offCompanyLocInput"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="مثال: صنعاء - الجمهورية اليمنية"
                  maxLength={160}
                  className="w-full bg-emeraldos-950 text-white text-sm font-bold rounded-xl px-4 py-2.5 border border-platgold-500/30 outline-none focus:border-platgold-400"
                />
              </div>

              <div>
                <label htmlFor="offCompanyAddrInput" className="block text-xs font-extrabold text-platgold-300 mb-1.5">
                  🏢 العنوان التفصيلي
                </label>
                <input
                  id="offCompanyAddrInput"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="مثال: شارع الزبيري - برج الأعمال"
                  maxLength={300}
                  className="w-full bg-emeraldos-950 text-white text-sm font-bold rounded-xl px-4 py-2.5 border border-platgold-500/30 outline-none focus:border-platgold-400"
                />
              </div>
            </div>

            <div className="bg-emeraldos-950/80 border border-platgold-500/25 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs font-black text-white">🖼️ شعار الشركة (Logo)</p>
                <p className="text-[11px] text-slate-400">PNG أو JPG — يُحفظ مضغوطاً داخل IndexedDB</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="bg-emeraldos-800 hover:bg-emeraldos-700 text-white border border-platgold-500/40 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition"
                  >
                    🖼️ رفع شعار الشركة
                  </button>
                  {logoDataUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoDataUrl('')}
                      className="bg-rose-900/70 hover:bg-rose-700 text-rose-200 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition"
                    >
                      🗑️ إزالة الشعار
                    </button>
                  )}
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLogoUpload(f);
                    e.target.value = '';
                  }}
                />
              </div>

              <div className="w-28 h-24 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-2 overflow-hidden">
                {logoDataUrl ? (
                  <img src={logoDataUrl} alt="شعار الشركة" className="max-w-full max-h-full object-contain" />
                ) : (
                  <span className="text-[11px] font-bold text-slate-400 text-center">لا يوجد شعار</span>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={savingCompany}
              className="platgold-gradient text-emeraldos-950 font-black text-xs sm:text-sm px-6 py-2.5 rounded-xl cursor-pointer transition disabled:opacity-60"
            >
              {savingCompany ? '⏳ جاري الحفظ...' : '💾 حفظ بيانات الشركة'}
            </button>
          </div>
        </form>

        {/* Local DB Management, Backup & PWA Install */}
        <div className="xl:col-span-5 space-y-5">
          {/* IndexedDB Backup & Restore */}
          <div className="bg-emeraldos-900/90 border border-platgold-500/35 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <div>
                <h3 className="text-base font-black text-white">🗄️ قاعدة البيانات المحلية ({dbEngineName})</h3>
                <p className="text-xs text-platgold-300 mt-0.5">
                  المعرف: <span className="font-mono" dir="ltr">{dbName}</span>
                </p>
              </div>
              <span className="text-2xl">💾</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-center">
              <div className="bg-emeraldos-950/90 border border-white/10 rounded-xl p-3">
                <p className="text-[11px] text-slate-400">التحليلات المحفوظة</p>
                <p className="text-lg font-black text-platgold-300 tabular-nums">{savedCount}</p>
              </div>
              <div className="bg-emeraldos-950/90 border border-white/10 rounded-xl p-3">
                <p className="text-[11px] text-slate-400">الملفات المستوردة</p>
                <p className="text-lg font-black text-emerald-300 tabular-nums">{customDatasetsCount}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="py-2.5 px-3 rounded-xl bg-sky-800/80 hover:bg-sky-700 text-white text-xs font-black border border-sky-400/40 cursor-pointer transition"
              >
                📤 تصدير نسخة احتياطية (JSON)
              </button>
              <button
                type="button"
                onClick={() => backupInputRef.current?.click()}
                className="py-2.5 px-3 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 text-white text-xs font-black border border-emerald-400/40 cursor-pointer transition"
              >
                📥 استعادة نسخة احتياطية
              </button>
              <input
                ref={backupInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadBackup(f);
                  e.target.value = '';
                }}
              />
            </div>

            <button
              type="button"
              onClick={onRequestClearAllData}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black border border-rose-400/50 cursor-pointer transition"
            >
              🗑️ مسح جميع البيانات المحلية
            </button>
          </div>

          {/* PWA Offline Installation & Status */}
          <div className="bg-emeraldos-900/90 border border-emerald-400/35 rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-emerald-300">📲 تثبيت التطبيق للعمل بدون إنترنت (PWA)</h3>
              <span
                className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                  isOnline
                    ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
                    : 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
                }`}
              >
                {isOnline ? '🌐 متصل (جاهز للتخزين)' : '📴 وضع عدم الاتصال نشط'}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              تعمل هذه النسخة عبر Service Worker محلي لتخزين جميع الملفات والخطوط والرسوم على جهازك حتى عند انقطاع الإنترنت بالكامل.
            </p>
            {isInstalled ? (
              <div className="bg-emeraldos-950 border border-emerald-400/30 rounded-xl p-3 text-xs font-bold text-emerald-300">
                ✅ التطبيق مثبت حالياً على جهازك ويعمل كتطبيق مستقل!
              </div>
            ) : isInstallable ? (
              <button
                type="button"
                onClick={async () => {
                  const ok = await installApp();
                  if (ok) onToast('تم تثبيت التطبيق على جهازك بنجاح!');
                }}
                className="w-full platgold-gradient text-emeraldos-950 font-black text-xs py-2.5 px-4 rounded-xl cursor-pointer transition"
              >
                📲 تثبيت تطبيق بن فيصل على الجهاز
              </button>
            ) : isIOS ? (
              <p className="text-[11px] text-platgold-200 bg-emeraldos-950 p-3 rounded-xl border border-platgold-500/25">
                على أجهزة iPhone/iPad: اضغط على زر المشاركة (Share) ثم اختر «إضافة إلى الشاشة الرئيسية».
              </p>
            ) : (
              <p className="text-[11px] text-slate-300 bg-emeraldos-950 p-3 rounded-xl border border-white/10">
                يمكنك فتح القائمة في المتصفح واختيار «تثبيت التطبيق / Install App» أو حفظ الصفحة للعمل بدون اتصال.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
