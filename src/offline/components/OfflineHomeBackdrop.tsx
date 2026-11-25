import React from 'react';
import { OfflineRubyGem } from './OfflineRubyGem';

export const OfflineHomeBackdrop: React.FC = () => {
  return (
    <section
      id="offline-page-home"
      className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center select-none pointer-events-none"
    >
      {/* Fixed Multi-Tone Aurora Backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.28),transparent_52%),radial-gradient(ellipse_at_bottom_left,rgba(6,182,212,0.24),transparent_52%),radial-gradient(ellipse_at_top_left,rgba(226,201,116,0.20),transparent_48%),radial-gradient(circle_at_50%_50%,rgba(6,54,48,0.85),#010a0d_88%)]" />

      {/* Animated Multi-Color Center Orbs (Red, Pink, Blue, Emerald) */}
      <div className="cinema-orb-1 absolute -top-28 right-1/5 w-[560px] h-[560px] rounded-full bg-rose-500/24 blur-[120px]" />
      <div className="cinema-orb-2 absolute -bottom-28 left-1/5 w-[620px] h-[620px] rounded-full bg-blue-500/26 blur-[130px]" />
      <div className="cinema-orb-1 absolute top-1/4 left-1/3 w-[480px] h-[480px] rounded-full bg-pink-500/22 blur-[115px]" />

      {/* Pure Local SVG Grid, Spectrum Lines, Flowing Waves & Orbital Rings */}
      <svg
        className="absolute inset-0 w-full h-full spectrum-lines-anim"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="offSpectrumAll" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.15" />
            <stop offset="18%" stopColor="#ef4444" stopOpacity="0.85" />
            <stop offset="36%" stopColor="#ec4899" stopOpacity="0.9" />
            <stop offset="54%" stopColor="#a855f7" stopOpacity="0.88" />
            <stop offset="72%" stopColor="#3b82f6" stopOpacity="0.9" />
            <stop offset="86%" stopColor="#06b6d4" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.2" />
          </linearGradient>

          <linearGradient id="offSpectrumRedPinkBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.92" />
            <stop offset="33%" stopColor="#ec4899" stopOpacity="0.92" />
            <stop offset="66%" stopColor="#3b82f6" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.85" />
          </linearGradient>

          <linearGradient id="offSpectrumVertical" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
            <stop offset="28%" stopColor="#ec4899" stopOpacity="0.75" />
            <stop offset="52%" stopColor="#ef4444" stopOpacity="0.85" />
            <stop offset="76%" stopColor="#3b82f6" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.15" />
          </linearGradient>

          <linearGradient id="offWavePinkBlueRed" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
            <stop offset="22%" stopColor="#3b82f6" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#ec4899" stopOpacity="0.95" />
            <stop offset="68%" stopColor="#ef4444" stopOpacity="0.92" />
            <stop offset="85%" stopColor="#f59e0b" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="offAreaFillGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ec4899" stopOpacity="0.18" />
            <stop offset="55%" stopColor="#3b82f6" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#010a0d" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g opacity="0.28" strokeWidth="0.9">
          <line x1="0" y1="150" x2="1440" y2="150" stroke="url(#offSpectrumAll)" />
          <line x1="0" y1="300" x2="1440" y2="300" stroke="url(#offWavePinkBlueRed)" />
          <line x1="0" y1="600" x2="1440" y2="600" stroke="url(#offWavePinkBlueRed)" />
          <line x1="0" y1="750" x2="1440" y2="750" stroke="url(#offSpectrumAll)" />
          <line x1="240" y1="0" x2="240" y2="900" stroke="url(#offSpectrumVertical)" />
          <line x1="480" y1="0" x2="480" y2="900" stroke="url(#offSpectrumVertical)" />
          <line x1="960" y1="0" x2="960" y2="900" stroke="url(#offSpectrumVertical)" />
          <line x1="1200" y1="0" x2="1200" y2="900" stroke="url(#offSpectrumVertical)" />
        </g>

        <g opacity="0.58" strokeWidth="1.5">
          <line x1="0" y1="450" x2="1440" y2="450" stroke="url(#offSpectrumAll)" strokeDasharray="10 6" />
          <line x1="720" y1="0" x2="720" y2="900" stroke="url(#offSpectrumVertical)" strokeDasharray="10 6" />
          <line x1="160" y1="100" x2="1280" y2="800" stroke="url(#offSpectrumRedPinkBlue)" strokeOpacity="0.45" strokeDasharray="7 9" />
          <line x1="1280" y1="100" x2="160" y2="800" stroke="url(#offWavePinkBlueRed)" strokeOpacity="0.45" strokeDasharray="7 9" />
        </g>

        <path
          className="line-anim"
          d="M 0 450 Q 240 340 480 450 T 960 450 T 1440 450"
          fill="none"
          stroke="url(#offSpectrumAll)"
          strokeWidth="2.4"
          opacity="0.8"
        />
        <path
          className="line-anim"
          d="M 0 450 Q 240 560 480 450 T 960 450 T 1440 450"
          fill="none"
          stroke="url(#offWavePinkBlueRed)"
          strokeWidth="2.2"
          opacity="0.75"
        />

        <g className="cinema-ring-ccw" style={{ transformOrigin: '720px 450px' }}>
          <circle
            cx="720"
            cy="450"
            r="205"
            fill="none"
            stroke="url(#offSpectrumRedPinkBlue)"
            strokeWidth="2.2"
            strokeDasharray="14 9"
            opacity="0.9"
          />
          <circle cx="720" cy="245" r="5" fill="#ef4444" opacity="0.95" />
          <circle cx="925" cy="450" r="5" fill="#ec4899" opacity="0.95" />
          <circle cx="515" cy="450" r="5" fill="#3b82f6" opacity="0.95" />
        </g>

        <g className="cinema-ring-cw" style={{ transformOrigin: '720px 450px' }}>
          <circle
            cx="720"
            cy="450"
            r="285"
            fill="none"
            stroke="url(#offSpectrumAll)"
            strokeWidth="2.4"
            strokeDasharray="20 10"
            opacity="0.92"
          />
          <circle cx="720" cy="165" r="5.5" fill="#ec4899" opacity="0.95" />
          <circle cx="720" cy="735" r="5.5" fill="#3b82f6" opacity="0.95" />
          <circle cx="1005" cy="450" r="5" fill="#ef4444" opacity="0.95" />
          <circle cx="435" cy="450" r="5" fill="#06b6d4" opacity="0.95" />
        </g>

        <g className="cinema-ring-ccw" style={{ transformOrigin: '720px 450px' }}>
          <circle
            cx="720"
            cy="450"
            r="365"
            fill="none"
            stroke="url(#offWavePinkBlueRed)"
            strokeOpacity="0.72"
            strokeWidth="1.8"
            strokeDasharray="8 12"
          />
          <circle cx="355" cy="450" r="4.8" fill="#ef4444" opacity="0.95" />
          <circle cx="1085" cy="450" r="4.8" fill="#3b82f6" opacity="0.95" />
          <circle cx="720" cy="85" r="4.8" fill="#f59e0b" opacity="0.95" />
          <circle cx="720" cy="815" r="4.8" fill="#ec4899" opacity="0.95" />
        </g>

        <path
          d="M -40 720 Q 280 560 580 650 T 1180 560 T 1500 640 L 1500 920 L -40 920 Z"
          fill="url(#offAreaFillGrad)"
        />
        <path
          className="line-anim"
          d="M -40 700 Q 280 540 580 630 T 1180 540 T 1500 620"
          fill="none"
          stroke="url(#offSpectrumAll)"
          strokeWidth="2.4"
        />
      </svg>

      {/* Ambient Floating Mini Chart Holograms */}
      <div className="cinema-card-a hidden md:block absolute top-8 right-8 w-60 rounded-2xl bg-emeraldos-950/70 border border-emerald-400/30 backdrop-blur-md p-4 shadow-[0_0_38px_rgba(16,185,129,0.22)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-emerald-300">توزيع البيانات</span>
        </div>
        <svg viewBox="0 0 160 72" className="w-full h-20">
          <line x1="0" y1="68" x2="160" y2="68" stroke="#334155" strokeWidth="1" />
          <rect className="bar-anim-1" x="10" y="24" width="16" height="44" rx="4" fill="#10b981" />
          <rect className="bar-anim-2" x="36" y="10" width="16" height="58" rx="4" fill="#06b6d4" />
          <rect className="bar-anim-3" x="62" y="28" width="16" height="40" rx="4" fill="#e2c974" />
          <rect className="bar-anim-1" x="88" y="14" width="16" height="54" rx="4" fill="#148b64" />
          <rect className="bar-anim-2" x="114" y="6" width="16" height="62" rx="4" fill="#38bdf8" />
          <rect className="bar-anim-3" x="140" y="22" width="14" height="46" rx="4" fill="#c5a059" />
        </svg>
      </div>

      <div className="cinema-card-b hidden md:block absolute top-10 left-8 w-56 rounded-2xl bg-emeraldos-950/70 border border-platgold-400/30 backdrop-blur-md p-4 shadow-[0_0_38px_rgba(197,160,89,0.20)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-platgold-300">المؤشر النسبي</span>
        </div>
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 64 64" className="w-16 h-16 cinema-ring-cw">
            <circle cx="32" cy="32" r="22" fill="none" stroke="#063626" strokeWidth="8" />
            <circle cx="32" cy="32" r="22" fill="none" stroke="#10b981" strokeWidth="8" strokeDasharray="55 140" />
            <circle cx="32" cy="32" r="22" fill="none" stroke="#e2c974" strokeWidth="8" strokeDasharray="40 140" strokeDashoffset="-58" />
            <circle cx="32" cy="32" r="22" fill="none" stroke="#06b6d4" strokeWidth="8" strokeDasharray="32 140" strokeDashoffset="-100" />
          </svg>
          <div className="space-y-1 text-[10px] font-bold text-slate-300">
            <p className="text-emerald-300">نمو</p>
            <p className="text-platgold-200">كفاءة</p>
            <p className="text-cyan-300">دقة</p>
          </div>
        </div>
      </div>

      <div className="cinema-card-b hidden md:block absolute bottom-8 right-10 w-64 rounded-2xl bg-emeraldos-950/70 border border-cyan-400/30 backdrop-blur-md p-4 shadow-[0_0_38px_rgba(6,182,212,0.20)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-cyan-300">مسار السلاسل الزمنية</span>
        </div>
        <svg viewBox="0 0 180 60" className="w-full h-16">
          <path d="M 5 48 L 35 34 L 68 42 L 102 18 L 138 26 L 175 8 L 175 58 L 5 58 Z" fill="rgba(6,182,212,0.16)" />
          <path
            className="line-anim"
            d="M 5 48 L 35 34 L 68 42 L 102 18 L 138 26 L 175 8"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="35" cy="34" r="3" fill="#efdb8a" />
          <circle cx="102" cy="18" r="3" fill="#10b981" />
          <circle cx="175" cy="8" r="3.5" fill="#efdb8a" />
        </svg>
      </div>

      <div className="cinema-card-a hidden md:block absolute bottom-8 left-10 w-60 rounded-2xl bg-emeraldos-950/70 border border-emerald-400/30 backdrop-blur-md p-4 shadow-[0_0_38px_rgba(16,185,129,0.20)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-emerald-300">مصفوفة الارتباط</span>
        </div>
        <svg viewBox="0 0 160 56" className="w-full h-12">
          <circle cx="20" cy="42" r="4" fill="#10b981" opacity="0.85" />
          <circle cx="42" cy="30" r="5.5" fill="#06b6d4" opacity="0.8" />
          <circle cx="68" cy="36" r="3.5" fill="#e2c974" opacity="0.9" />
          <circle cx="92" cy="20" r="6" fill="#10b981" opacity="0.75" />
          <circle cx="118" cy="26" r="4.5" fill="#38bdf8" opacity="0.85" />
          <circle cx="142" cy="12" r="5" fill="#e2c974" opacity="0.95" />
          <line x1="12" y1="46" x2="148" y2="10" stroke="#e2c974" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
        </svg>
      </div>

      {/* Center Visual Identity Emblem */}
      <div className="relative z-10 text-center px-6">
        <div className="w-32 h-32 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-rose-500/20 via-red-900/20 to-platgold-400/15 border border-rose-400/45 shadow-[0_0_65px_rgba(225,29,72,0.38)] flex items-center justify-center backdrop-blur-md">
          <OfflineRubyGem size="lg" />
        </div>
        <h2 className="text-2xl sm:text-4xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-l from-platgold-100 via-rose-200 to-emerald-300 drop-shadow">
          تطبيق بن فيصل • النسخة المحلية (بدون إنترنت)
        </h2>
        <p className="text-xs sm:text-sm font-bold text-platgold-200/80 mt-2.5 tracking-widest">
          يعمل بالكامل على قاعدة بيانات محلية (IndexedDB) — افتح لوحة التحكم للتحليل والرسوم والتقارير
        </p>
      </div>
    </section>
  );
};
