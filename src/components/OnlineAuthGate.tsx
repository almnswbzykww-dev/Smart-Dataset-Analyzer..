import React, { useState } from 'react';
import {
  getFirebaseAuthErrorArabic,
  loginWithApple,
  loginWithEmail,
  loginWithFacebook,
  loginWithGoogle,
  registerWithEmail,
  resetPasswordByEmail,
} from '../firebase';
import { RedRubyGem } from './RedRubyGem';

interface OnlineAuthGateProps {
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

type AuthTab = 'login' | 'register' | 'reset';

export const OnlineAuthGate: React.FC<OnlineAuthGateProps> = ({ onToast }) => {
  const [authTab, setAuthTab] = useState<AuthTab>('login');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [resetEmail, setResetEmail] = useState('');

  const handleSocialLogin = async (provider: 'google' | 'facebook' | 'apple') => {
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
        onToast(`مرحباً بك ${user.displayName || user.email || ''} — تم تسجيل الدخول بنجاح!`);
      }
    } catch (err) {
      const msg = getFirebaseAuthErrorArabic(err);
      setAuthError(msg);
      onToast(msg, 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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
      onToast(`مرحباً بك ${user.displayName || user.email || ''}!`);
    } catch (err) {
      const msg = getFirebaseAuthErrorArabic(err);
      setAuthError(msg);
      onToast(msg, 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
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
      onToast(`تم إنشاء حساب "${user.displayName || regName}" والدخول بنجاح!`);
    } catch (err) {
      const msg = getFirebaseAuthErrorArabic(err);
      setAuthError(msg);
      onToast(msg, 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    if (!resetEmail.trim() || !resetEmail.includes('@')) {
      setAuthError('يرجى إدخال البريد الإلكتروني المسجل لاستعادة كلمة المرور.');
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

  return (
    <div
      className="min-h-screen w-screen emerald-wallpaper relative flex items-center justify-center p-4 overflow-y-auto"
      dir="rtl"
    >
      <div className="relative z-10 w-full max-w-xl glass-panel-emerald emerald-glow-border rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-3 border-b border-platgold-500/25 pb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-950/90 to-emeraldos-950 border border-rose-400/50 flex items-center justify-center shadow-[0_0_24px_rgba(244,63,94,0.4)]">
            <RedRubyGem size="lg" />
          </div>
          <div className="space-y-1">
            <span className="inline-block text-[11px] font-black px-3 py-1 rounded-lg bg-sky-500/20 text-sky-200 border border-sky-400/35">
              🌐 Dataset Analyzer Online — النسخة السحابية
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white">
              <span className="text-platgold-400">تطبيق بن فيصل</span> لتحليل البيانات الذكي
            </h1>
            <p className="text-xs text-slate-300 font-bold">
              سجّل دخولك للوصول إلى مساحة العمل والمزامنة السحابية الآمنة عبر Firebase
            </p>
          </div>
        </div>

        {/* Auth Mode Tabs */}
        <div className="grid grid-cols-3 gap-2 bg-emeraldos-950/85 p-1.5 rounded-xl border border-white/10">
          <button
            type="button"
            onClick={() => {
              setAuthTab('login');
              setAuthError('');
              setAuthSuccess('');
            }}
            className={`py-2 px-2 rounded-lg text-xs font-black cursor-pointer transition ${
              authTab === 'login' ? 'platgold-gradient text-emeraldos-950 shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            🔐 تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthTab('register');
              setAuthError('');
              setAuthSuccess('');
            }}
            className={`py-2 px-2 rounded-lg text-xs font-black cursor-pointer transition ${
              authTab === 'register' ? 'platgold-gradient text-emeraldos-950 shadow' : 'text-slate-300 hover:text-white'
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
            className={`py-2 px-2 rounded-lg text-xs font-black cursor-pointer transition ${
              authTab === 'reset' ? 'platgold-gradient text-emeraldos-950 shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            🔑 نسيت كلمة المرور؟
          </button>
        </div>

        {authError && (
          <div className="bg-rose-950/85 border border-rose-500/50 text-rose-200 text-xs font-bold px-4 py-3 rounded-xl">
            ⚠️ {authError}
          </div>
        )}

        {authSuccess && (
          <div className="bg-emerald-950/85 border border-emerald-500/50 text-emerald-200 text-xs font-bold px-4 py-3 rounded-xl">
            ✅ {authSuccess}
          </div>
        )}

        {/* Email Login Form */}
        {authTab === 'login' && (
          <form onSubmit={handleEmailLogin} className="space-y-3.5">
            <div>
              <label htmlFor="gateLoginEmail" className="block text-xs font-bold text-platgold-300 mb-1.5">
                البريد الإلكتروني
              </label>
              <input
                id="gateLoginEmail"
                type="email"
                autoComplete="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                dir="ltr"
                placeholder="name@example.com"
                className="w-full bg-emeraldos-950 text-white text-sm font-bold rounded-xl px-4 py-2.5 border border-platgold-500/35 outline-none focus:border-platgold-400"
              />
            </div>

            <div>
              <label htmlFor="gateLoginPass" className="block text-xs font-bold text-platgold-300 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  id="gateLoginPass"
                  type={showLoginPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  dir="ltr"
                  placeholder="••••••••"
                  className="w-full bg-emeraldos-950 text-white text-sm font-bold rounded-xl px-4 py-2.5 pl-10 border border-platgold-500/35 outline-none focus:border-platgold-400"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPass((v) => !v)}
                  title={showLoginPass ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-platgold-300 text-sm cursor-pointer px-1"
                >
                  {showLoginPass ? '🙈' : '👁️'}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('reset');
                    setResetEmail(loginEmail);
                    setAuthError('');
                    setAuthSuccess('');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-black text-sky-300 hover:text-sky-200 underline underline-offset-4 cursor-pointer transition"
                >
                  <span>🔑</span>
                  <span>هل نسيت كلمة المرور؟</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={authBusy}
              className="w-full platgold-gradient text-emeraldos-950 font-black text-sm py-3 rounded-xl cursor-pointer transition disabled:opacity-60 shadow-lg"
            >
              {authBusy ? '⏳ جاري التحقق والدخول...' : '🔐 تسجيل الدخول بالبريد الإلكتروني'}
            </button>
          </form>
        )}

        {/* Register Form */}
        {authTab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="gateRegName" className="block text-xs font-bold text-platgold-300 mb-1">
                  الاسم الكامل
                </label>
                <input
                  id="gateRegName"
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="أدخل اسمك الكامل"
                  className="w-full bg-emeraldos-950 text-white text-sm font-bold rounded-xl px-3.5 py-2 border border-platgold-500/35 outline-none focus:border-platgold-400"
                />
              </div>
              <div>
                <label htmlFor="gateRegPhone" className="block text-xs font-bold text-platgold-300 mb-1">
                  رقم الهاتف (اختياري)
                </label>
                <input
                  id="gateRegPhone"
                  type="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  dir="ltr"
                  placeholder="+967..."
                  className="w-full bg-emeraldos-950 text-white text-sm font-bold rounded-xl px-3.5 py-2 border border-platgold-500/35 outline-none focus:border-platgold-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="gateRegEmail" className="block text-xs font-bold text-platgold-300 mb-1">
                البريد الإلكتروني
              </label>
              <input
                id="gateRegEmail"
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                dir="ltr"
                placeholder="name@example.com"
                className="w-full bg-emeraldos-950 text-white text-sm font-bold rounded-xl px-3.5 py-2 border border-platgold-500/35 outline-none focus:border-platgold-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="gateRegPass" className="block text-xs font-bold text-platgold-300 mb-1">
                  كلمة المرور
                </label>
                <input
                  id="gateRegPass"
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  dir="ltr"
                  placeholder="6 أحرف على الأقل"
                  className="w-full bg-emeraldos-950 text-white text-sm font-bold rounded-xl px-3.5 py-2 border border-platgold-500/35 outline-none focus:border-platgold-400"
                />
              </div>
              <div>
                <label htmlFor="gateRegConfirm" className="block text-xs font-bold text-platgold-300 mb-1">
                  تأكيد كلمة المرور
                </label>
                <input
                  id="gateRegConfirm"
                  type="password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  dir="ltr"
                  placeholder="أعد كتابة كلمة المرور"
                  className="w-full bg-emeraldos-950 text-white text-sm font-bold rounded-xl px-3.5 py-2 border border-platgold-500/35 outline-none focus:border-platgold-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authBusy}
              className="w-full platgold-gradient text-emeraldos-950 font-black text-sm py-3 rounded-xl cursor-pointer transition disabled:opacity-60 shadow-lg"
            >
              {authBusy ? '⏳ جاري إنشاء الحساب...' : '✓ إنشاء حساب جديد والدخول'}
            </button>
          </form>
        )}

        {/* Reset Password Form */}
        {authTab === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-3.5">
            <div>
              <label htmlFor="gateResetEmail" className="block text-xs font-bold text-platgold-300 mb-1.5">
                أدخل بريدك الإلكتروني المسجل لإرسال رابط إعادة تعيين كلمة المرور
              </label>
              <input
                id="gateResetEmail"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                dir="ltr"
                placeholder="name@example.com"
                className="w-full bg-emeraldos-950 text-white text-sm font-bold rounded-xl px-4 py-2.5 border border-platgold-500/35 outline-none focus:border-platgold-400"
              />
            </div>

            <button
              type="submit"
              disabled={authBusy}
              className="w-full platgold-gradient text-emeraldos-950 font-black text-sm py-3 rounded-xl cursor-pointer transition disabled:opacity-60 shadow-lg"
            >
              {authBusy ? '⏳ جاري الإرسال...' : '📧 إرسال رابط استعادة كلمة المرور'}
            </button>
          </form>
        )}

        {/* Social Providers Divider */}
        <div className="space-y-3 pt-2 border-t border-white/15">
          <p className="text-center text-[11px] font-extrabold text-slate-300">
            أو سجّل الدخول السريع عبر حساباتك:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Google */}
            <button
              type="button"
              disabled={authBusy}
              onClick={() => handleSocialLogin('google')}
              className="bg-white hover:bg-slate-100 text-slate-900 font-black text-xs px-3 py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition shadow disabled:opacity-60"
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

            {/* Facebook */}
            <button
              type="button"
              disabled={authBusy}
              onClick={() => handleSocialLogin('facebook')}
              className="bg-[#1877F2] hover:bg-[#166FE5] text-white font-black text-xs px-3 py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition shadow disabled:opacity-60"
            >
              <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span>Facebook</span>
            </button>

            {/* Apple */}
            <button
              type="button"
              disabled={authBusy}
              onClick={() => handleSocialLogin('apple')}
              className="bg-black hover:bg-neutral-900 text-white border border-white/25 font-black text-xs px-3 py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition shadow disabled:opacity-60"
            >
              <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              <span>Apple</span>
            </button>
          </div>
        </div>

        {/* Bottom Feature: Contact Developer for Help */}
        <div className="pt-4 border-t border-platgold-500/25 space-y-3">
          <div className="rounded-2xl bg-gradient-to-br from-emeraldos-950/95 via-emeraldos-900/90 to-emeraldos-950/95 border border-platgold-400/40 p-4 shadow-xl space-y-3">
            <div className="flex items-start gap-3">
              {/* Custom Developer Support Icon */}
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/25 via-sky-500/25 to-amber-400/25 border border-platgold-400/55 flex items-center justify-center shrink-0 shadow-[0_0_16px_rgba(16,185,129,0.3)]">
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 13v-1a8 8 0 0 1 16 0v1" stroke="#fde047" strokeWidth="2" />
                  <rect x="2.5" y="12.5" width="3.5" height="5.5" rx="1.5" fill="#34d399" fillOpacity="0.35" stroke="#34d399" strokeWidth="1.8" />
                  <rect x="18" y="12.5" width="3.5" height="5.5" rx="1.5" fill="#38bdf8" fillOpacity="0.35" stroke="#38bdf8" strokeWidth="1.8" />
                  <path d="M18 18a3 3 0 0 1-3 3h-3" stroke="#fde047" strokeWidth="1.8" />
                  <circle cx="11" cy="21" r="1.2" fill="#fde047" />
                </svg>
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="text-sm font-black text-platgold-300">
                  تواصل مع المطور للمساعدة
                </h2>
                <p className="text-xs text-slate-200 leading-relaxed font-semibold">
                  إذا واجهتك أي مشكلة أثناء تسجيل الدخول تواصل مع المطور، وإذا تريد النسخة التي تعمل بدون إنترنت تواصل مع المطور للحصول عليها وتفعيلها.
                </p>
              </div>
            </div>

            <div className="bg-emeraldos-950/90 border border-white/10 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-300">رقم المطور:</span>
                <span className="text-sm font-black text-white font-mono tracking-wide" dir="ltr">
                  +967771312997
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`https://wa.me/967771312997?text=${encodeURIComponent(
                    'مرحباً مهندس زكريا، أحتاج مساعدة بخصوص تسجيل الدخول أو الحصول على النسخة التي تعمل بدون إنترنت من تطبيق بن فيصل لتحليل البيانات الذكي.'
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-black inline-flex items-center gap-1.5 shadow transition"
                >
                  <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.15 1.59 5.96L0 24l6.31-1.65a11.84 11.84 0 0 0 5.75 1.47h.01c6.55 0 11.9-5.35 11.9-11.91 0-3.18-1.24-6.17-3.45-8.43ZM12.06 21.8a9.86 9.86 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.87 9.87 0 0 1-1.52-5.27c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.9 7c0 5.45-4.44 9.89-9.9 9.89Zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35Z" />
                  </svg>
                  <span>واتساب</span>
                </a>

                <a
                  href="tel:+967771312997"
                  className="bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-xl text-xs font-black inline-flex items-center gap-1.5 shadow transition"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span>اتصال</span>
                </a>
              </div>
            </div>

            <p className="text-[11px] font-bold text-platgold-300 text-center">
              💻 تطوير: المهندس زكريا فيصل العزعزي
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
