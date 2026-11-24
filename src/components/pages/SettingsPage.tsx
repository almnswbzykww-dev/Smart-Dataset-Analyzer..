import React, { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { CompanySettings, PageInstance, UserProfileRecord } from '../../types/app';
import { compressLogoFile } from '../../utils/csvParser';
import { AccountSettingsCard } from '../AccountSettingsCard';
import { PageToolbar } from '../PageToolbar';

interface SettingsPageProps {
  instance: PageInstance;
  firebaseUser: User | null;
  userProfile: UserProfileRecord | null;
  company: CompanySettings;
  savedCount: number;
  customDatasetsCount: number;
  onSaveCompany: (next: CompanySettings) => Promise<boolean>;
  onRequestUpdateAccount: (next: { displayName: string; phone: string }) => Promise<boolean>;
  onRequestLogout: () => void;
  onRequestClearAllData: () => void;
  onRefresh: (instanceId: string) => void;
  onCloseToHome: (instanceId: string) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  instance,
  firebaseUser,
  userProfile,
  company,
  savedCount,
  customDatasetsCount,
  onSaveCompany,
  onRequestUpdateAccount,
  onRequestLogout,
  onRequestClearAllData,
  onRefresh,
  onCloseToHome,
  onToast,
}) => {
  const [companyName, setCompanyName] = useState(company.companyName);
  const [location, setLocation] = useState(company.location);
  const [address, setAddress] = useState(company.address);
  const [logoDataUrl, setLogoDataUrl] = useState(company.logoDataUrl);
  const [saving, setSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setCompanyName(company.companyName);
    setLocation(company.location);
    setAddress(company.address);
    setLogoDataUrl(company.logoDataUrl);
  }, [company]);

  const handleLogoUpload = async (file: File) => {
    try {
      const compressed = await compressLogoFile(file, 300);
      setLogoDataUrl(compressed);
      onToast('تم رفع شعار الشركة وتجهيزه بنجاح');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'تعذر معالجة صورة الشعار', 'error');
    }
  };

  const handleSubmitCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const confirmed = await onSaveCompany({
        companyName,
        location,
        address,
        logoDataUrl,
      });
      if (confirmed) {
        onToast('تم حفظ بيانات الشركة بنجاح وسيتم إرفاقها في جميع المطبوعات!');
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'تعذر حفظ بيانات الشركة', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 min-h-full">
      <PageToolbar
        instance={instance}
        onRefresh={onRefresh}
        onCloseToHome={onCloseToHome}
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Section 0: User Account & Authentication ("حول حسابك") */}
        <AccountSettingsCard
          firebaseUser={firebaseUser}
          userProfile={userProfile}
          companyName={company.companyName}
          savedCount={savedCount}
          customDatasetsCount={customDatasetsCount}
          onRequestUpdateAccount={onRequestUpdateAccount}
          onRequestLogout={onRequestLogout}
          onToast={onToast}
        />

        {/* Section 1: Company Branding Settings */}
        <form
          onSubmit={handleSubmitCompany}
          className="xl:col-span-7 bg-emeraldos-900/90 border border-platgold-500/30 rounded-2xl p-6 space-y-5"
        >
          <div className="border-b border-white/15 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white">⚙️ بيانات الشركة</h3>
              <p className="text-xs text-platgold-300 mt-0.5">
                تظهر هذه البيانات والشعار تلقائياً أعلى تقارير الطباعة والبيانات والمخططات
              </p>
            </div>
            <span className="text-2xl">🏢</span>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="companyNameInput" className="block text-xs font-extrabold text-platgold-300 mb-1.5">
                اسم الشركة / المؤسسة
              </label>
              <input
                id="companyNameInput"
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
                <label htmlFor="companyLocInput" className="block text-xs font-extrabold text-platgold-300 mb-1.5">
                  📍 الموقع (المدينة / الدولة)
                </label>
                <input
                  id="companyLocInput"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="مثال: صنعاء - الجمهورية اليمنية"
                  maxLength={160}
                  className="w-full bg-emeraldos-950 text-white text-sm font-bold rounded-xl px-4 py-2.5 border border-platgold-500/30 outline-none focus:border-platgold-400"
                />
              </div>

              <div>
                <label htmlFor="companyAddrInput" className="block text-xs font-extrabold text-platgold-300 mb-1.5">
                  🏢 العنوان التفصيلي
                </label>
                <input
                  id="companyAddrInput"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="مثال: شارع الزبيري - برج الأعمال"
                  maxLength={300}
                  className="w-full bg-emeraldos-950 text-white text-sm font-bold rounded-xl px-4 py-2.5 border border-platgold-500/30 outline-none focus:border-platgold-400"
                />
              </div>
            </div>

            {/* Logo Upload & Preview */}
            <div className="bg-emeraldos-950/80 border border-platgold-500/25 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs font-black text-white">🖼️ شعار الشركة (Logo)</p>
                <p className="text-[11px] text-slate-400">PNG أو JPG — يتم ضغطه تلقائياً لحفظه في المطبوعات</p>
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
              disabled={saving}
              className="platgold-gradient text-emeraldos-950 font-black text-xs sm:text-sm px-6 py-2.5 rounded-xl cursor-pointer transition disabled:opacity-60"
            >
              {saving ? '⏳ جاري الحفظ...' : '💾 حفظ بيانات الشركة'}
            </button>
          </div>
        </form>

        {/* Section 2: Clear Data & Local Storage Info */}
        <div className="xl:col-span-5 space-y-5">
          {/* Danger Zone: Clear All Previous Data */}
          <div className="bg-emeraldos-900/90 border border-rose-500/40 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-rose-500/25 pb-3">
              <div>
                <h3 className="text-base font-black text-rose-200">🗑️ إدارة ومسح البيانات</h3>
                <p className="text-xs text-slate-300 mt-0.5">حذف البيانات المؤقتة وسجل التحليلات المحفوظة</p>
              </div>
              <span className="text-2xl">⚠️</span>
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

            <p className="text-xs text-slate-300 leading-relaxed">
              عند مسح جميع البيانات السابقة، سيتم حذف الملفات المرفوعة ونتائج التحليلات المحفوظة وإعدادات الشركة الخاصة بك فقط، ولن تتأثر ملفات البرنامج الأساسية.
            </p>

            <button
              type="button"
              onClick={onRequestClearAllData}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black border border-rose-400/50 cursor-pointer transition"
            >
              🗑️ مسح جميع البيانات السابقة
            </button>
          </div>

          <div className="bg-emeraldos-900/90 border border-platgold-500/30 rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-black text-platgold-300">☁️ المزامنة والحفظ المزدوج</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {firebaseUser
                ? 'أنت مسجل الدخول حالياً؛ تتم مزامنة ملفك الشخصي وبيانات الشركة والتحليلات المحفوظة مع حسابك السحابي والمحلي تلقائياً.'
                : 'التطبيق جاهز للعمل مباشرة محلياً، وعند تسجيل دخولك من قسم «حول حسابك» أعلاه يتم إنشاء ملف مستخدم خاص بك ومزامنة بياناتك سحابياً.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
