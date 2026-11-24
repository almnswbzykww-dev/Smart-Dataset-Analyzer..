import React from 'react';
import type { OfflinePageType } from '../offline.types';

interface OfflineFeatureBadgeProps {
  type: OfflinePageType;
  active?: boolean;
  size?: 'xs' | 'sm' | 'md';
}

const OFFLINE_ICON_THEMES: Record<
  OfflinePageType,
  { badge: string; activeBadge: string; primary: string; accent: string }
> = {
  dashboard: {
    badge: 'bg-gradient-to-br from-sky-500/30 to-blue-600/30 border-sky-400/60 shadow-[0_0_12px_rgba(56,189,248,0.28)]',
    activeBadge: 'bg-emeraldos-950 border-sky-400/80 shadow-[0_0_10px_rgba(56,189,248,0.4)]',
    primary: '#38bdf8',
    accent: '#fde047',
  },
  studio: {
    badge: 'bg-gradient-to-br from-rose-500/30 to-pink-600/30 border-rose-400/60 shadow-[0_0_12px_rgba(244,63,94,0.28)]',
    activeBadge: 'bg-emeraldos-950 border-rose-400/80 shadow-[0_0_10px_rgba(244,63,94,0.4)]',
    primary: '#fb7185',
    accent: '#f472b6',
  },
  stats: {
    badge: 'bg-gradient-to-br from-violet-500/30 to-indigo-600/30 border-violet-400/60 shadow-[0_0_12px_rgba(167,139,250,0.28)]',
    activeBadge: 'bg-emeraldos-950 border-violet-400/80 shadow-[0_0_10px_rgba(167,139,250,0.4)]',
    primary: '#c4b5fd',
    accent: '#38bdf8',
  },
  reports: {
    badge: 'bg-gradient-to-br from-amber-400/30 to-yellow-600/30 border-amber-400/60 shadow-[0_0_12px_rgba(251,191,36,0.28)]',
    activeBadge: 'bg-emeraldos-950 border-amber-400/80 shadow-[0_0_10px_rgba(251,191,36,0.4)]',
    primary: '#fcd34d',
    accent: '#34d399',
  },
  details: {
    badge: 'bg-gradient-to-br from-emerald-400/30 to-teal-600/30 border-emerald-400/60 shadow-[0_0_12px_rgba(52,211,153,0.28)]',
    activeBadge: 'bg-emeraldos-950 border-emerald-400/80 shadow-[0_0_10px_rgba(52,211,153,0.4)]',
    primary: '#34d399',
    accent: '#a7f3d0',
  },
  loader: {
    badge: 'bg-gradient-to-br from-cyan-400/30 to-sky-600/30 border-cyan-400/60 shadow-[0_0_12px_rgba(34,211,238,0.28)]',
    activeBadge: 'bg-emeraldos-950 border-cyan-400/80 shadow-[0_0_10px_rgba(34,211,238,0.4)]',
    primary: '#22d3ee',
    accent: '#fde047',
  },
  settings: {
    badge: 'bg-gradient-to-br from-orange-400/30 to-amber-600/30 border-orange-400/60 shadow-[0_0_12px_rgba(251,146,60,0.28)]',
    activeBadge: 'bg-emeraldos-950 border-orange-400/80 shadow-[0_0_10px_rgba(251,146,60,0.4)]',
    primary: '#fb923c',
    accent: '#fde68a',
  },
  about: {
    badge: 'bg-gradient-to-br from-pink-500/30 to-fuchsia-600/30 border-pink-400/60 shadow-[0_0_12px_rgba(236,72,153,0.28)]',
    activeBadge: 'bg-emeraldos-950 border-pink-400/80 shadow-[0_0_10px_rgba(236,72,153,0.4)]',
    primary: '#f472b6',
    accent: '#fbcfe8',
  },
};

export const OfflineFeatureBadge: React.FC<OfflineFeatureBadgeProps> = ({
  type,
  active = false,
  size = 'sm',
}) => {
  const theme = OFFLINE_ICON_THEMES[type];
  const sizeClass =
    size === 'md'
      ? 'w-9 h-9 rounded-xl'
      : size === 'xs'
      ? 'w-5 h-5 rounded-md'
      : 'w-8 h-8 rounded-xl';
  const svgSize = size === 'md' ? 'w-5 h-5' : size === 'xs' ? 'w-3.5 h-3.5' : 'w-[18px] h-[18px]';
  const boxClass = `${sizeClass} border ${active ? theme.activeBadge : theme.badge}`;

  const iconSvg = (() => {
    switch (type) {
      case 'dashboard':
        return (
          <svg viewBox="0 0 24 24" className={svgSize} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="8" height="8" rx="2" fill={theme.primary} fillOpacity="0.35" stroke={theme.primary} strokeWidth="2" />
            <rect x="13" y="3" width="8" height="5" rx="1.5" fill={theme.accent} fillOpacity="0.35" stroke={theme.accent} strokeWidth="2" />
            <rect x="13" y="10" width="8" height="11" rx="2" fill={theme.primary} fillOpacity="0.35" stroke={theme.primary} strokeWidth="2" />
            <rect x="3" y="13" width="8" height="8" rx="2" stroke={theme.accent} strokeWidth="2" />
          </svg>
        );
      case 'studio':
        return (
          <svg viewBox="0 0 24 24" className={svgSize} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 20h18" stroke="#cbd5e1" strokeWidth="1.8" />
            <rect x="4.5" y="12" width="3.8" height="6" rx="1" fill="#38bdf8" stroke="#7dd3fc" strokeWidth="1.2" />
            <rect x="10.1" y="8" width="3.8" height="10" rx="1" fill={theme.accent} stroke="#f9a8d4" strokeWidth="1.2" />
            <rect x="15.7" y="5" width="3.8" height="13" rx="1" fill={theme.primary} stroke="#fecdd3" strokeWidth="1.2" />
            <path d="M4.5 9l5.5-4 4 2.5L19.5 3" stroke="#fde047" strokeWidth="2" />
          </svg>
        );
      case 'stats':
        return (
          <svg viewBox="0 0 24 24" className={svgSize} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="3" width="16" height="18" rx="2.5" fill={theme.primary} fillOpacity="0.22" stroke={theme.primary} strokeWidth="2" />
            <path d="M8 7h8" stroke={theme.accent} strokeWidth="2.2" />
            <path d="M8 11.5h2.5M13 11.5h3" stroke="#ffffff" strokeWidth="2" />
            <path d="M8 15.5h2.5M13 15.5h3" stroke={theme.accent} strokeWidth="2" />
            <path d="M8 18.5h8" stroke={theme.primary} strokeWidth="1.8" />
          </svg>
        );
      case 'reports':
        return (
          <svg viewBox="0 0 24 24" className={svgSize} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" fill={theme.primary} fillOpacity="0.22" stroke={theme.primary} strokeWidth="2" />
            <polyline points="14 3 14 8 19 8" stroke={theme.primary} strokeWidth="2" />
            <path d="M8.5 13h7" stroke="#ffffff" strokeWidth="2" />
            <path d="M8.5 17h4" stroke={theme.primary} strokeWidth="2" />
            <circle cx="16.5" cy="16.5" r="2" fill={theme.accent} />
          </svg>
        );
      case 'details':
        return (
          <svg viewBox="0 0 24 24" className={svgSize} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2.5" fill={theme.primary} fillOpacity="0.22" stroke={theme.primary} strokeWidth="2" />
            <path d="M3 9h18" stroke={theme.accent} strokeWidth="2" />
            <path d="M3 14h18" stroke={theme.primary} strokeWidth="1.8" />
            <path d="M9 9v11" stroke={theme.accent} strokeWidth="1.8" />
          </svg>
        );
      case 'loader':
        return (
          <svg viewBox="0 0 24 24" className={svgSize} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h4.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" fill={theme.primary} fillOpacity="0.24" stroke={theme.primary} strokeWidth="2" />
            <path d="M12 16.5v-5.5" stroke={theme.accent} strokeWidth="2.2" />
            <path d="M9.5 13.5 12 11l2.5 2.5" stroke={theme.accent} strokeWidth="2.2" />
          </svg>
        );
      case 'settings':
        return (
          <svg viewBox="0 0 24 24" className={svgSize} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3.2" fill={theme.accent} fillOpacity="0.45" stroke={theme.accent} strokeWidth="2" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke={theme.primary} strokeWidth="1.9" />
          </svg>
        );
      case 'about':
        return (
          <svg viewBox="0 0 24 24" className={svgSize} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" fill={theme.primary} fillOpacity="0.25" stroke={theme.primary} strokeWidth="2" />
            <path d="M12 16v-4.5" stroke="#ffffff" strokeWidth="2.3" />
            <circle cx="12" cy="8.2" r="1.1" fill={theme.accent} />
          </svg>
        );
    }
  })();

  return (
    <span className={`inline-flex items-center justify-center shrink-0 transition ${boxClass}`}>
      {iconSvg}
    </span>
  );
};

interface OfflineAccountIconProps {
  size?: 'sm' | 'md' | 'lg';
}

export const OfflineAccountIcon: React.FC<OfflineAccountIconProps> = ({ size = 'sm' }) => {
  const boxSize =
    size === 'lg'
      ? 'w-12 h-12 rounded-2xl'
      : size === 'md'
      ? 'w-10 h-10 rounded-xl'
      : 'w-9 h-9 rounded-xl';
  const svgSize = size === 'lg' ? 'w-7 h-7' : size === 'md' ? 'w-6 h-6' : 'w-5 h-5';

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${boxSize} bg-gradient-to-br from-amber-400/25 via-emerald-500/25 to-cyan-500/25 border border-platgold-400/65 shadow-[0_0_16px_rgba(245,158,11,0.3)]`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className={svgSize} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <defs>
          <linearGradient id="offAccGrad" x1="0" y1="0" x2="24" y2="24">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="55%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#offAccGrad)" fillOpacity="0.16" stroke="url(#offAccGrad)" strokeWidth="1.7" />
        <circle cx="12" cy="9" r="3.2" fill="#fde047" fillOpacity="0.35" stroke="#fde047" strokeWidth="1.9" />
        <path
          d="M6.4 18.6c1.1-2.5 3.1-3.8 5.6-3.8s4.5 1.3 5.6 3.8"
          stroke="#34d399"
          strokeWidth="2.1"
        />
        <circle cx="18.2" cy="6.2" r="2.1" fill="#34d399" stroke="#022c22" strokeWidth="1" />
      </svg>
    </span>
  );
};
