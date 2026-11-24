import React from 'react';
import type { PageInstance, PageType } from '../types/app';
import { FeatureIcon } from './FeatureIcon';

export const PAGE_META: Record<PageType, { title: string; icon: string }> = {
  dashboard: { title: 'لوحة القيادة', icon: '📊' },
  studio: { title: 'عرض الرسوم البيانية', icon: '📈' },
  stats: { title: 'التحليل الإحصائي', icon: '🧮' },
  reports: { title: 'التقارير', icon: '📋' },
  details: { title: 'مستعرض البيانات', icon: '🗂️' },
  loader: { title: 'استيراد البيانات', icon: '📂' },
  settings: { title: 'الإعدادات', icon: '⚙️' },
  about: { title: 'حول التطبيق', icon: 'ℹ️' },
};

interface PageToolbarProps {
  instance: PageInstance;
  datasetName?: string;
  extraControls?: React.ReactNode;
  onRefresh: (instanceId: string) => void;
  onSave?: () => void;
  onPrint?: () => void;
  printLabel?: string;
  onCloseToHome: (instanceId: string) => void;
}

export const PageToolbar: React.FC<PageToolbarProps> = ({
  instance,
  datasetName,
  extraControls,
  onRefresh,
  onSave,
  onPrint,
  printLabel = '🖨️ طباعة',
  onCloseToHome,
}) => {
  return (
    <div className="bg-emeraldos-950/90 border border-platgold-500/30 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2.5 shadow-lg">
      <div className="flex items-center gap-2.5">
        <FeatureIcon type={instance.type} size="md" active />
        <div>
          <h2 className="text-sm font-black text-white">{instance.title}</h2>
          <p className="text-[10px] text-emeraldos-400 font-bold">
            {datasetName
              ? `📂 البيانات النشطة: ${datasetName}`
              : 'صفحة عمل مستقلة • تعمل محلياً حتى بدون إنترنت'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {extraControls}

        {onPrint && (
          <button
            type="button"
            onClick={onPrint}
            className="bg-emeraldos-800 hover:bg-emeraldos-700 text-white border border-emerald-400/35 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap"
          >
            <span>{printLabel}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onRefresh(instance.instanceId)}
          className="bg-sky-900/60 hover:bg-sky-800/80 text-sky-200 border border-sky-400/35 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap"
        >
          <span>🔄 تحديث</span>
        </button>

        {onSave && (
          <button
            type="button"
            onClick={onSave}
            className="platgold-gradient text-emeraldos-950 px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap"
          >
            <span>💾 حفظ</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onCloseToHome(instance.instanceId)}
          className="bg-rose-600/85 hover:bg-rose-500 text-white border border-rose-400/40 px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap"
        >
          <span>✕ إغلاق</span>
        </button>
      </div>
    </div>
  );
};
