import React from 'react';

export interface ConfirmModalConfig {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalConfig> = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = '✕ إلغاء',
  tone = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 no-print"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div className="glass-panel-emerald emerald-glow-border rounded-2xl max-w-md w-full p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-platgold-500/30 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{tone === 'danger' ? '⚠️' : '💾'}</span>
            <h3 className="text-sm font-black text-white">{title}</h3>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="text-slate-300 hover:text-white text-base cursor-pointer px-1.5"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{message}</p>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-emeraldos-900 hover:bg-emeraldos-800 text-slate-200 border border-white/15 text-xs font-bold cursor-pointer transition disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-black cursor-pointer transition disabled:opacity-60 ${
              tone === 'danger'
                ? 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/50'
                : 'platgold-gradient text-emeraldos-950'
            }`}
          >
            {loading ? '⏳ جاري التنفيذ...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
