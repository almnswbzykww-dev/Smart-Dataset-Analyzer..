import React from 'react';

interface OfflineRubyGemProps {
  size?: 'sm' | 'lg';
}

export const OfflineRubyGem: React.FC<OfflineRubyGemProps> = ({ size = 'lg' }) => {
  const isLg = size === 'lg';
  const uid = isLg ? 'offRubyLg' : 'offRubySm';

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${
        isLg ? 'w-28 h-28' : 'w-10 h-10'
      }`}
      aria-hidden="true"
    >
      <div
        className={`ruby-glow-pulse absolute inset-0 rounded-full ${
          isLg
            ? 'bg-radial from-rose-500/45 via-red-600/20 to-transparent blur-xl scale-125'
            : 'bg-radial from-rose-500/40 via-red-600/15 to-transparent blur-md scale-115'
        }`}
      />

      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
      >
        <g className="ruby-sparkle-1" style={{ transformOrigin: '16px 20px' }}>
          <path d="M16 10 L18 18 L26 20 L18 22 L16 30 L14 22 L6 20 L14 18 Z" fill="#ffe4e6" />
        </g>
        <g className="ruby-sparkle-2" style={{ transformOrigin: '84px 24px' }}>
          <path d="M84 15 L85.7 22.3 L93 24 L85.7 25.7 L84 33 L82.3 25.7 L75 24 L82.3 22.3 Z" fill="#fda4af" />
        </g>
        <g className="ruby-sparkle-3" style={{ transformOrigin: '78px 78px' }}>
          <path d="M78 70 L79.5 76.5 L86 78 L79.5 79.5 L78 86 L76.5 79.5 L70 78 L76.5 76.5 Z" fill="#ffffff" />
        </g>
      </svg>

      <svg
        viewBox="0 0 120 110"
        className={`ruby-gem-float relative z-10 drop-shadow-[0_0_18px_rgba(244,63,94,0.72)] ${
          isLg ? 'w-24 h-22' : 'w-8 h-8'
        }`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`${uid}_crownTop`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fecdd3" />
            <stop offset="45%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#e11d48" />
          </linearGradient>
          <linearGradient id={`${uid}_crownSide`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#9f1239" />
          </linearGradient>
          <linearGradient id={`${uid}_pavilionCenter`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e11d48" />
            <stop offset="55%" stopColor="#be123c" />
            <stop offset="100%" stopColor="#881337" />
          </linearGradient>
          <linearGradient id={`${uid}_pavilionDark`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9f1239" />
            <stop offset="100%" stopColor="#4c0519" />
          </linearGradient>
          <linearGradient id={`${uid}_shimmerSweep`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="45%" stopColor="#ffe4e6" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.78" />
            <stop offset="55%" stopColor="#ffe4e6" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${uid}_gemClip`}>
            <polygon points="28,14 92,14 114,42 60,102 6,42" />
          </clipPath>
        </defs>

        <g clipPath={`url(#${uid}_gemClip)`}>
          <polygon points="28,14 92,14 82,42 38,42" fill={`url(#${uid}_crownTop)`} />
          <polygon points="28,14 38,42 6,42" fill="#fda4af" opacity="0.92" />
          <polygon points="92,14 114,42 82,42" fill={`url(#${uid}_crownSide)`} />
          <polygon points="38,42 60,14 82,42" fill="#ffe4e6" opacity="0.35" />

          <polygon points="6,42 38,42 60,102" fill={`url(#${uid}_crownSide)`} />
          <polygon points="38,42 82,42 60,102" fill={`url(#${uid}_pavilionCenter)`} />
          <polygon points="82,42 114,42 60,102" fill={`url(#${uid}_pavilionDark)`} />

          <polygon points="44,20 76,20 70,36 50,36" fill="#ffffff" opacity="0.28" />

          <rect
            x="-60"
            y="0"
            width="42"
            height="120"
            fill={`url(#${uid}_shimmerSweep)`}
            transform="skewX(-24)"
            className="ruby-shimmer-band"
          />
        </g>

        <g
          fill="none"
          stroke="#fecdd3"
          strokeOpacity="0.65"
          strokeWidth={isLg ? '1.3' : '1.8'}
          strokeLinejoin="round"
        >
          <polygon points="28,14 92,14 114,42 60,102 6,42" />
          <line x1="6" y1="42" x2="114" y2="42" />
          <polyline points="28,14 38,42 60,102 82,42 92,14" />
          <line x1="38" y1="42" x2="60" y2="14" />
          <line x1="82" y1="42" x2="60" y2="14" />
        </g>
      </svg>
    </div>
  );
};
