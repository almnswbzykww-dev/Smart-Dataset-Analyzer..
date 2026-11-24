import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  getFirebaseAuthErrorArabic,
  loginWithApple,
  loginWithEmail,
  loginWithFacebook,
  loginWithGoogle,
  registerWithEmail,
  resetPasswordByEmail,
} from '../firebase';
import type { UserProfileRecord } from '../types/app';
import { AccountIcon } from './FeatureIcon';

interface AccountSettingsCardProps {
  firebaseUser: User | null;
  userProfile: UserProfileRecord | null;
  companyName: string;
  savedCount: number;
  customDatasetsCount: number;
  onRequestUpdateAccount: (next: { displayName: string; phone: string }) => Promise<boolean>;
  onRequestLogout: () => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

type AuthTab = 'login' | 'register' | 'reset';

function formatProviderAr(provider?: string): string {
  switch (provider) {
    case 'google.com':
      return 'حساب Google';
    case 'password':
      return 'البريد الإلكتروني وكلمة المرور';
    case 'facebook.com':
      return 'حساب Facebook';
    case 'apple.com':
      return 'حساب Apple';
    default:
      return provider || 'مصادقة Firebase';
  }
}

function formatDateTimeAr(raw?: string): string {
  if (!raw) return 'غير متوفر';
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return 'غير متوفر';
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(dt);
  } catch {
    return dt.toLocaleString();
  }
}

export const AccountSettingsCard: React.FC<AccountSettingsCardProps> = ({
  firebaseUser,
  userProfile,
  companyName,
  savedCount,
  customDatasetsCount,
  onRequestUpdateAccount,
  onRequestLogout,
  onToast,
}) => {
  const [authTab, setAuthTab] = useState<AuthTab>('login');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Login / Register / Reset fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [resetEmail, setResetEmail] = useState('');

  // Signed-in account profile editor
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setEditName(userProfile?.displayName || firebaseUser?.displayName || '');
    setEditPhone(userProfile?.phone || firebaseUser?.phoneNumber || '');
    setAvatarFailed(false);
  }, [userProfile, firebaseUser]);

  const handleSocialAuth = async (provider: 'google' | 'facebook' | 'apple') => {
    setAuthError('');
    setAuthSuccess('');
    setAuthBusy(true);
    try {
      const user =
        provider === 'google'
          ? await loginWithGoogle(false)
          : provider === 'facebook'
            ? await loginWithFacebook()
            : await loginWithApple();
      if (user) {
        onToast(`مرحباً بك ${user.displayName || user.email || ''} — تم تسجيل الدخول وإنشاء حسابك بنجاح!`);
      }
    } catch (err) {
      const msg = getFirebaseAuthErrorArabic(err);
      setAuthError(msg);
      onToast(msg, 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleEmailLogin = async () => {
    setAuthError('');
    setAuthSuccess('');
    if (!loginEmail.trim() || !loginEmail.includes('@')) {
      setAuthError('يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }
    if (!loginPassword) {
      setAuthError('يرجى إدخال كلمة المرور.');
      return;
    }

    setAuthBusy(true);
    try {
      const user = await loginWithEmail(loginEmail, loginPassword);
      setLoginPassword('');
      onToast(`تم تسجيل الدخول بنجاح (${user.displayName || user.email})`);
    } catch (err) {
      const msg = getFirebaseAuthErrorArabic(err);
      setAuthError(msg);
      onToast(msg, 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRegister = async () => {
    setAuthError('');
    setAuthSuccess('');
    if (!regName.trim()) {
      setAuthError('يرجى إدخال الاسم الكامل.');
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(regEmail.trim())) {
      setAuthError('صيغة البريد الإلكتروني غير صحيحة.');
      return;
    }
    if (regPassword.length < 6) {
      setAuthError('كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setAuthError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setAuthBusy(true);
    try {
      const user = await registerWithEmail({
        name: regName,
        email: regEmail,
        password: regPassword,
        phone: regPhone,
      });
      setRegPassword('');
      setRegConfirmPassword('');
      onToast(`تم إنشاء حساب المستخدم "${user.displayName || regName}" وتسجيل الدخول بنجاح!`);
    } catch (err) {
      const msg = getFirebaseAuthErrorArabic(err);
      setAuthError(msg);
      onToast(msg, 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleResetPassword = async () => {
    setAuthError('');
    setAuthSuccess('');
    if (!resetEmail.trim() || !resetEmail.includes('@')) {
      setAuthError('يرجى إدخال البريد الإلكتروني لاستعادة كلمة المرور.');
      return;
    }

    setAuthBusy(true);
    try {
      await resetPasswordByEmail(resetEmail);
      const okMsg = 'تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني بنجاح.';
      setAuthSuccess(okMsg);
      onToast(okMsg);
    } catch (err) {
      const msg = getFirebaseAuthErrorArabic(err);
      setAuthError(msg);
      onToast(msg, 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCopyUid = async () => {
    if (!firebaseUser?.uid) return;
    try {
      await navigator.clipboard.writeText(firebaseUser.uid);
      onToast('تم نسخ معرّف المستخدم (UID)');
    } catch {
      onToast('تعذر النسخ التلقائي؛ يمكنك نسخ المعرّف يدوياً.', 'error');
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      onToast('يرجى إدخال اسم المستخدم قبل الحفظ.', 'error');
      return;
    }
    setSavingProfile(true);
    try {
      const saved = await onRequestUpdateAccount({
        displayName: editName,
        phone: editPhone,
      });
      if (saved) {
        onToast('تم تحديث بيانات حسابك وحفظها بنجاح!');
      }
    } finally {
      setSavingProfile(false);
    }
  };

  // ==================== SIGNED-IN ACCOUNT VIEW ====================
  if (firebaseUser) {
    const displayName = userProfile?.displayName || firebaseUser.displayName || 'مستخدم';
    const email = userProfile?.email || firebaseUser.email || 'غير متوفر';
    const providerId = userProfile?.provider || firebaseUser.providerData[0]?.providerId || 'firebase';
    const phone = userProfile?.phone || firebaseUser.phoneNumber || 'غير مضاف';
    const initialChar = displayName.trim().charAt(0).toUpperCase() || 'م';

    return (
      <section className="xl:col-span-12 bg-emeraldos-900/90 border border-platgold-500/35 rounded-2xl p-6 space-y-6">
        {/* Account Header + Logout Button */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/15 pb-5">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-16 h-16 rounded-2xl bg-emeraldos-950 border border-platgold-400/50 flex items-center justify-center overflow-hidden shrink-0">
              {firebaseUser.photoURL && !avatarFailed ? (
                <img
                  src={firebaseUser.photoURL}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-black text-platgold-300">{initialChar}</span>
              )}
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-emerald-300">
                <AccountIcon size="sm" />
                <span>حول حسابك</span>
                <span aria-hidden="true">·</span>
                <span>حساب نشط ومتصل</span>
              </div>
              <h3 className="text-lg font-black text-white truncate">{displayName}</h3>
              <p className="text-xs text-slate-300 font-mono truncate" dir="ltr">
                {email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onRequestLogout}
            className="bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/50 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black cursor-pointer transition whitespace-nowrap shrink-0"
          >
            🚪 تسجيل الخروج من الحساب
          </button>
        </div>

        {/* Full Account Details & Contents */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Account Metadata Table */}
          <div className="lg:col-span-7 space-y-3">
            <h4 className="text-sm font-black text-platgold-300">📋 تفاصيل ومحتويات حساب المستخدم</h4>
            <div className="overflow-x-auto rounded-xl border border-white/15">
              <table className="w-full text-right border-collapse text-xs sm:text-sm">
                <tbody className="divide-y divide-white/10 bg-emeraldos-950/75">
                  <tr>
                    <td className="py-2.5 px-4 font-bold text-slate-400 w-44">الاسم المسجل</td>
                    <td className="py-2.5 px-4 font-black text-white">{displayName}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-bold text-slate-400">البريد الإلكتروني</td>
                    <td className="py-2.5 px-4 font-bold text-slate-100 font-mono" dir="ltr">
                      {email}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-bold text-slate-400">رقم الهاتف</td>
                    <td className="py-2.5 px-4 font-bold text-slate-100 tabular-nums" dir="ltr">
                      {phone}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-bold text-slate-400">طريقة تسجيل الدخول</td>
                    <td className="py-2.5 px-4 font-bold text-emerald-300">{formatProviderAr(providerId)}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-bold text-slate-400">تأكيد البريد</td>
                    <td className="py-2.5 px-4 font-bold text-slate-200">
                      {firebaseUser.emailVerified ? '✓ بريد إلكتروني موثق' : 'مسجل عبر التطبيق'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-bold text-slate-400">معرّف المستخدم (UID)</td>
                    <td className="py-2.5 px-4 font-mono text-xs text-platgold-200 tabular-nums">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="truncate max-w-[230px]" dir="ltr">
                          {firebaseUser.uid}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyUid}
                          className="bg-emeraldos-800 hover:bg-emeraldos-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition"
                        >
                          📋 نسخ
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-bold text-slate-400">تاريخ إنشاء الحساب</td>
                    <td className="py-2.5 px-4 font-bold text-slate-200 tabular-nums">
                      {formatDateTimeAr(firebaseUser.metadata?.creationTime)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-bold text-slate-400">آخر تسجيل دخول</td>
                    <td className="py-2.5 px-4 font-bold text-slate-200 tabular-nums">
                      {formatDateTimeAr(firebaseUser.metadata?.lastSignInTime)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-bold text-slate-400">محتويات الحساب</td>
                    <td className="py-2.5 px-4 font-bold text-slate-100 tabular-nums">
                      {savedCount} تحليل محفوظ · {customDatasetsCount} ملف مستورد · الشركة:{' '}
                      {companyName.trim() ? companyName : 'غير محددة'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Update User Profile Form */}
          <div className="lg:col-span-5 bg-emeraldos-950/75 border border-platgold-500/25 rounded-xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-white/10 pb-2.5">
                <h4 className="text-sm font-black text-white">✏️ تحديث بيانات الحساب</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  يمكنك تعديل اسم المستخدم ورقم الهاتف المحفوظين في ملفك الشخصي
                </p>
              </div>

              <div>
                <label htmlFor="accEditName" className="block text-xs font-extrabold text-platgold-300 mb-1.5">
                  اسم المستخدم
                </label>
                <input
                  id="accEditName"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={120}
                  placeholder="أدخل اسمك الكامل"
                  className="w-full bg-emeraldos-900 text-white text-sm font-bold rounded-xl px-3.5 py-2.5 border border-platgold-500/30 outline-none focus:border-platgold-400"
                />
              </div>

              <div>
                <label htmlFor="accEditPhone" className="block text-xs font-extrabold text-platgold-300 mb-1.5">
                  رقم الهاتف
                </label>
                <input
                  id="accEditPhone"
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  maxLength={32}
                  dir="ltr"
                  placeholder="+967..."
                  className="w-full bg-emeraldos-900 text-white text-sm font-bold rounded-xl px-3.5 py-2.5 border border-platgold-500/30 outline-none focus:border-platgold-400"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={savingProfile}
              onClick={handleSaveProfile}
              className="w-full platgold-gradient text-emeraldos-950 font-black text-xs sm:text-sm py-2.5 px-4 rounded-xl cursor-pointer transition disabled:opacity-60"
            >
              {savingProfile ? '⏳ جاري الحفظ...' : '💾 حفظ تعديلات الحساب'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ==================== SIGNED-OUT / SIGN-IN & REGISTER VIEW ====================
  return (
    <section className="xl:col-span-12 bg-emeraldos-900/90 border border-platgold-500/35 rounded-2xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-4">
        <div className="flex items-center gap-3">
          <AccountIcon size="md" />
          <div>
            <h3 className="text-base font-black text-white">حول حسابك وتسجيل الدخول</h3>
            <p className="text-xs text-platgold-300 mt-0.5">
              وضع التشغيل الحالي: ضيف محلي · سجّل دخولك أو أنشئ حساباً ليُنشأ ملف مستخدم خاص بك وتظهر جميع بياناته
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={authBusy}
            onClick={() => handleSocialAuth('google')}
            className="bg-white hover:bg-slate-100 text-slate-900 font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer transition shadow disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.3 0 6.08-1.09 8.11-2.96l-3.88-3.05c-1.09.73-2.48 1.16-4.23 1.16-3.25 0-6.01-2.19-7-5.14H1.01v3.14C3.05 21.2 7.21 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5 14.01c-.25-.73-.39-1.51-.39-2.31s.14-1.58.39-2.31V6.25H1.01C.37 7.53 0 8.97 0 10.5s.37 2.97 1.01 4.25l3.99-3.14v2.4Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.21 0 3.05 2.8 1.01 6.86l3.99 3.14c.99-2.95 3.75-5.25 7-5.25Z"
              />
            </svg>
            <span>Google</span>
          </button>

          <button
            type="button"
            disabled={authBusy}
            onClick={() => handleSocialAuth('facebook')}
            className="bg-[#1877F2] hover:bg-[#166FE5] text-white font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer transition shadow disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <span>Facebook</span>
          </button>

          <button
            type="button"
            disabled={authBusy}
            onClick={() => handleSocialAuth('apple')}
            className="bg-black hover:bg-neutral-900 text-white border border-white/25 font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer transition shadow disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <span>Apple</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-emeraldos-950/80 p-1.5 rounded-xl border border-white/10 w-fit">
        <button
          type="button"
          onClick={() => {
            setAuthTab('login');
            setAuthError('');
            setAuthSuccess('');
          }}
          className={`px-4 py-2 rounded-lg text-xs font-black cursor-pointer transition ${
            authTab === 'login' ? 'platgold-gradient text-emeraldos-950' : 'text-slate-300 hover:text-white'
          }`}
        >
          🔐 تسجيل الدخول بالبريد
        </button>
        <button
          type="button"
          onClick={() => {
            setAuthTab('register');
            setAuthError('');
            setAuthSuccess('');
          }}
          className={`px-4 py-2 rounded-lg text-xs font-black cursor-pointer transition ${
            authTab === 'register' ? 'platgold-gradient text-emeraldos-950' : 'text-slate-300 hover:text-white'
          }`}
        >
          ➕ إنشاء حساب جديد
        </button>
        <button
          type="button"
          onClick={() => {
            setAuthTab('reset');
            setAuthError('');
            setAuthSuccess('');
          }}
          className={`px-4 py-2 rounded-lg text-xs font-black cursor-pointer transition ${
            authTab === 'reset' ? 'platgold-gradient text-emeraldos-950' : 'text-slate-300 hover:text-white'
          }`}
        >
          🔑 استعادة كلمة المرور
        </button>
      </div>

      {authError && (
        <div className="bg-rose-950/80 border border-rose-500/45 text-rose-200 text-xs font-bold px-4 py-3 rounded-xl">
          ⚠️ {authError}
        </div>
      )}

      {authSuccess && (
        <div className="bg-emerald-950/80 border border-emerald-500/45 text-emerald-200 text-xs font-bold px-4 py-3 rounded-xl">
          ✅ {authSuccess}
        </div>
      )}

      {authTab === 'login' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label htmlFor="accLoginEmail" className="block text-xs font-bold text-platgold-300 mb-1.5">
              البريد الإلكتروني
            </label>
            <input
              id="accLoginEmail"
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              dir="ltr"
              placeholder="name@example.com"
              className="w-full bg-emeraldos-950 text-white text-sm font-bold rounded-xl px-3.5 py-2.5 border border-platgold-500/30 outline-none focus:border-platgold-400"
            />
          </div>
          <div>
            <label htmlFor="accLoginPass" className="block text-xs font-bold text-platgold-300 mb-1.5">
              كلمة المرور
            </label>
            <input
              id="accLoginPass"
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              dir="ltr"
              placeholder="••••••••"
              className="w-full bg-emeraldos-950 text-white text-sm font-bold rounded-xl px-3.5 py-2.5 border border-platgold-500/30 outline-none focus:border-platgold-400"
            />
          </div>
          <button
            type="button"
            disabled={authBusy}
            onClick={handleEmailLogin}
            className="platgold-gradient text-emeraldos-950 font-black text-xs sm:text-sm py-2.5 px-5 rounded-xl cursor-pointer transition disabled:opacity-60"
          >
            {authBusy ? '⏳ جاري الدخول...' : '🔐 تسجيل الدخول'}
          </button>
        </div>
      )}

      {authTab === 'register' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
          <div>
            <label htmlFor="accRegName" className="block text-xs font-bold text-platgold-300 mb-1.5">
              الاسم الكامل
            </label>
            <input
              id="accRegName"
              type="text"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              placeholder="أدخل اسمك الكامل"
              className="w-full bg-emeraldos-950 text-white text-sm font-bold rounded-xl px-3.5 py-2.5 border border-platgold-500/30 outline-none focus:border-platgold-400"
            />
          </div>
          <div>
            <label htmlFor="accRegEmail" className="block text-xs font-bold text-platgold-300 mb-1.5">
              البريد الإلكتروني
            </label>
            <input
              id="accRegEmail"
              type="email"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              dir="ltr"
              placeholder="name@example.com"
              className="w-full bg-emeraldos-950 text-white text-sm font-bold rounded-xl px-3.5 py-2.5 border border-platgold-500/30 outline-none focus:border-platgold-400"
            />
          </div>
          <div>
            <label htmlFor="accRegPhone" className="block text-xs font-bold text-platgold-300 mb-1.5">
              رقم الهاتف (اختياري)
            </label>
            <input
              id="accRegPhone"
              type="tel"
              value={regPhone}
              onChange={(e) => setRegPhone(e.target.value)}
              dir="ltr"
              placeholder="+967..."
              className="w-full bg-emeraldos-950 text-white text-sm font-bold rounded-xl px-3.5 py-2.5 border border-platgold-500/30 outline-none focus:border-platgold-400"
            />
          </div>
          <div>
            <label htmlFor="accRegPass" className="block text-xs font-bold text-platgold-300 mb-1.5">
              كلمة المرور
            </label>
            <input
              id="accRegPass"
              type="password"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              dir="ltr"
              placeholder="6 أحرف على الأقل"
              className="w-full bg-emeraldos-950 text-white text-sm font-bold rounded-xl px-3.5 py-2.5 border border-platgold-500/30 outline-none focus:border-platgold-400"
            />
          </div>
          <div>
            <label htmlFor="accRegConfirm" className="block text-xs font-bold text-platgold-300 mb-1.5">
              تأكيد كلمة المرور
            </label>
            <input
              id="accRegConfirm"
              type="password"
              value={regConfirmPassword}
              onChange={(e) => setRegConfirmPassword(e.target.value)}
              dir="ltr"
              placeholder="أعد كتابة كلمة المرور"
              className="w-full bg-emeraldos-950 text-white text-sm font-bold rounded-xl px-3.5 py-2.5 border border-platgold-500/30 outline-none focus:border-platgold-400"
            />
          </div>
          <button
            type="button"
            disabled={authBusy}
            onClick={handleRegister}
            className="platgold-gradient text-emeraldos-950 font-black text-xs sm:text-sm py-2.5 px-5 rounded-xl cursor-pointer transition disabled:opacity-60"
          >
            {authBusy ? '⏳ جاري الإنشاء...' : '✓ إنشاء الحساب'}
          </button>
        </div>
      )}

      {authTab === 'reset' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2">
            <label htmlFor="accResetEmail" className="block text-xs font-bold text-platgold-300 mb-1.5">
              البريد الإلكتروني المسجل
            </label>
            <input
              id="accResetEmail"
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              dir="ltr"
              placeholder="name@example.com"
              className="w-full bg-emeraldos-950 text-white text-sm font-bold rounded-xl px-3.5 py-2.5 border border-platgold-500/30 outline-none focus:border-platgold-400"
            />
          </div>
          <button
            type="button"
            disabled={authBusy}
            onClick={handleResetPassword}
            className="platgold-gradient text-emeraldos-950 font-black text-xs sm:text-sm py-2.5 px-5 rounded-xl cursor-pointer transition disabled:opacity-60"
          >
            {authBusy ? '⏳ جاري الإرسال...' : '📧 إرسال رابط الاستعادة'}
          </button>
        </div>
      )}
    </section>
  );
};
