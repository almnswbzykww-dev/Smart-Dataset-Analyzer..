import React, { useMemo } from 'react';
import {
  OFFLINE_AGG_LABELS_AR,
  OFFLINE_CHART_LABELS_AR,
  type OfflineCompanySettings,
  type OfflineDataset,
  type OfflinePageInstance,
  type OfflinePrintPayload,
  type OfflineSavedAnalysis,
} from '../offline.types';
import { aggregateOfflineData, computeOfflineColumnStats, formatOfflineNum } from '../offlineDataEngine';
import { OfflineToolbar } from '../components/OfflineToolbar';

interface OfflineReportsPageProps {
  instance: OfflinePageInstance;
  dataset: OfflineDataset;
  datasets: Record<string, OfflineDataset>;
  company: OfflineCompanySettings;
  savedAnalyses: OfflineSavedAnalysis[];
  onChangeDataset: (instanceId: string, datasetKey: string) => void;
  onUpdateConfig: (instanceId: string, patch: Partial<OfflinePageInstance>) => void;
  onRefresh: (instanceId: string) => void;
  onRequestSave: (summaryText: string) => void;
  onRequestPrint: (payload: OfflinePrintPayload) => void;
  onDeleteAnalysis: (rec: OfflineSavedAnalysis) => void;
  onCloseToHome: (instanceId: string) => void;
}

export const OfflineReportsPage: React.FC<OfflineReportsPageProps> = ({
  instance,
  dataset,
  datasets,
  company,
  savedAnalyses,
  onChangeDataset,
  onUpdateConfig,
  onRefresh,
  onRequestSave,
  onRequestPrint,
  onDeleteAnalysis,
  onCloseToHome,
}) => {
  const reportData = useMemo(() => {
    const agg = aggregateOfflineData(dataset, instance.xCol, instance.yCol, instance.aggMode);
    let total = 0;
    let maxVal = agg.values.length ? -Infinity : 0;
    let minVal = agg.values.length ? Infinity : 0;
    let maxIdx = 0;
    let minIdx = 0;
    for (let i = 0; i < agg.values.length; i++) {
      const v = agg.values[i];
      total += v;
      if (v > maxVal) {
        maxVal = v;
        maxIdx = i;
      }
      if (v < minVal) {
        minVal = v;
        minIdx = i;
      }
    }
    const avg = agg.values.length ? total / agg.values.length : 0;
    const maxLabel = agg.labels[maxIdx] || '—';
    const minLabel = agg.labels[minIdx] || '—';
    const colStats = computeOfflineColumnStats(dataset, instance.yCol);

    const summaryPairs: Array<{ name: string; value: string }> = [
      { name: 'اسم ملف البيانات', value: dataset.label || dataset.name },
      { name: 'عدد السجلات', value: formatOfflineNum(dataset.rowsCount, 0) },
      { name: 'عدد الأعمدة', value: String(dataset.colsCount) },
      { name: 'الأعمدة الرقمية', value: dataset.numericCols.join('، ') || 'لا يوجد' },
      ...(dataset.dateCols && dataset.dateCols.length
        ? [{ name: 'أعمدة التواريخ', value: dataset.dateCols.join('، ') }]
        : []),
      { name: 'الأعمدة الفئوية / النصية', value: dataset.catCols.join('، ') || 'لا يوجد' },
      { name: 'معيار التجميع المختار', value: `${instance.yCol} حسب ${instance.xCol} (${OFFLINE_AGG_LABELS_AR[instance.aggMode]})` },
      { name: `إجمالي ${instance.yCol}`, value: formatOfflineNum(total) },
      { name: 'المتوسط الحسابي', value: formatOfflineNum(colStats ? colStats.mean : avg) },
      { name: 'الوسيط الإحصائي', value: formatOfflineNum(colStats ? colStats.median : avg) },
      { name: 'الانحراف المعياري', value: formatOfflineNum(colStats ? colStats.stdDev : 0) },
      { name: 'أعلى فئة / قيمة', value: `${maxLabel} (${formatOfflineNum(maxVal)})` },
      { name: 'أدنى فئة / قيمة', value: `${minLabel} (${formatOfflineNum(minVal)})` },
    ];

    const breakdown = agg.labels
      .map((l, i) => ({
        label: l,
        val: agg.values[i],
        pct: total ? ((agg.values[i] / total) * 100).toFixed(1) : '0.0',
      }))
      .sort((a, b) => b.val - a.val);

    return { summaryPairs, breakdown, total, maxLabel };
  }, [dataset, instance.xCol, instance.yCol, instance.aggMode]);

  const hasCompany = Boolean(
    company.companyName.trim() || company.location.trim() || company.address.trim() || company.logoDataUrl
  );

  const handlePrintReport = () => {
    onRequestPrint({
      kind: 'report',
      title: `التقرير التحليلي الشامل — ${dataset.name}`,
      subtitle: `ملف البيانات: ${dataset.name} • ${instance.yCol} حسب ${instance.xCol} (${OFFLINE_AGG_LABELS_AR[instance.aggMode]})`,
      summaryPairs: reportData.summaryPairs,
      tableHeaders: ['#', `التصنيف (${instance.xCol})`, `القيمة (${instance.yCol})`, 'النسبة المئوية (%)'],
      tableRows: reportData.breakdown.slice(0, 200).map((b, i) => [i + 1, b.label, formatOfflineNum(b.val), `${b.pct}%`]),
      notes: 'تم إنشاء هذا التقرير محلياً بالكامل عبر تطبيق بن فيصل لتحليل البيانات الذكي (بدون إنترنت).',
    });
  };

  return (
    <div className="flex flex-col gap-5 min-h-full">
      <OfflineToolbar
        instance={instance}
        datasetName={dataset.name}
        onRefresh={onRefresh}
        onPrint={handlePrintReport}
        printLabel="🖨️ طباعة التقرير"
        onSave={() =>
          onRequestSave(
            `تقرير شامل (${dataset.name}): ${instance.yCol} حسب ${instance.xCol} — الإجمالي ${formatOfflineNum(reportData.total)} — الأعلى: ${reportData.maxLabel}`
          )
        }
        onCloseToHome={onCloseToHome}
      />

      <div className="bg-emeraldos-900/90 border border-platgold-500/30 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-[10px] font-bold text-platgold-300 mb-1">📂 ملف البيانات:</label>
          <select
            value={instance.datasetKey}
            onChange={(e) => onChangeDataset(instance.instanceId, e.target.value)}
            className="w-full bg-emeraldos-950 text-white font-bold text-xs rounded-xl p-2.5 border border-platgold-500/30"
          >
            {Object.values(datasets).map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-platgold-300 mb-1">عمود التصنيف (X):</label>
          <select
            value={instance.xCol}
            onChange={(e) => onUpdateConfig(instance.instanceId, { xCol: e.target.value })}
            className="w-full bg-emeraldos-950 text-white font-bold text-xs rounded-xl p-2.5 border border-platgold-500/30"
          >
            {dataset.columns
              .filter((c) => c !== '#')
              .map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-platgold-300 mb-1">عمود القيمة (Y):</label>
          <select
            value={instance.yCol}
            onChange={(e) => onUpdateConfig(instance.instanceId, { yCol: e.target.value })}
            className="w-full bg-emeraldos-950 text-white font-bold text-xs rounded-xl p-2.5 border border-platgold-500/30"
          >
            {dataset.columns
              .filter((c) => c !== '#')
              .map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handlePrintReport}
          className="platgold-gradient text-emeraldos-950 font-black text-xs py-2.5 px-4 rounded-xl cursor-pointer transition"
        >
          🖨️ طباعة التقرير الرسمي
        </button>
      </div>

      {hasCompany && (
        <div className="bg-white text-slate-900 rounded-2xl p-5 border-2 border-platgold-500/50 shadow-lg flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
              ترويسة الشركة في الطباعة
            </span>
            {company.companyName && <h3 className="text-lg font-black text-slate-900">{company.companyName}</h3>}
            {company.location && <p className="text-xs font-bold text-slate-600">📍 الموقع: {company.location}</p>}
            {company.address && <p className="text-xs font-medium text-slate-500">🏢 العنوان: {company.address}</p>}
          </div>
          {company.logoDataUrl && (
            <img
              src={company.logoDataUrl}
              alt={company.companyName || 'شعار الشركة'}
              className="max-h-16 max-w-[140px] object-contain rounded-lg border border-slate-200 p-1"
            />
          )}
        </div>
      )}

      <div className="bg-emeraldos-900/90 rounded-2xl p-6 border border-platgold-500/30 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-3">
          <div>
            <h3 className="text-base font-black text-white">📋 ملخص التقرير التنفيذي</h3>
            <p className="text-xs text-platgold-300 mt-0.5">جدول المؤشرات والنتائج المحسوبة محلياً</p>
          </div>
          <span className="text-xs font-bold text-emerald-300 bg-emerald-500/15 px-3 py-1 rounded-lg border border-emerald-400/30">
            جاهز للطباعة والحفظ بدون إنترنت
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/15">
          <table className="w-full text-right border-collapse text-sm">
            <thead className="bg-emeraldos-950 text-platgold-300 border-b border-platgold-500/35">
              <tr>
                <th className="py-3 px-4 font-black w-1/2">البند</th>
                <th className="py-3 px-4 font-black w-1/2">القيمة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-emeraldos-950/60">
              {reportData.summaryPairs.map((pair) => (
                <tr key={pair.name} className="hover:bg-emeraldos-800/70 transition">
                  <td className="py-3 px-4 font-bold text-slate-200">{pair.name}</td>
                  <td className="py-3 px-4 font-black text-emerald-300 tabular-nums">{pair.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-2 space-y-3">
          <h4 className="text-sm font-black text-platgold-300">📊 جدول توزيع القيم حسب ({instance.xCol})</h4>
          <div className="overflow-x-auto rounded-xl border border-white/15">
            <table className="w-full text-right border-collapse text-xs sm:text-sm">
              <thead className="bg-emeraldos-950 text-platgold-300 border-b border-platgold-500/35">
                <tr>
                  <th className="py-2.5 px-4 font-black">#</th>
                  <th className="py-2.5 px-4 font-black">التصنيف</th>
                  <th className="py-2.5 px-4 font-black">القيمة</th>
                  <th className="py-2.5 px-4 font-black">النسبة المئوية (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-emeraldos-950/60">
                {reportData.breakdown.slice(0, 150).map((row, idx) => (
                  <tr key={row.label + idx} className="hover:bg-emeraldos-800/70 transition">
                    <td className="py-2.5 px-4 font-bold text-platgold-400 tabular-nums">{idx + 1}</td>
                    <td className="py-2.5 px-4 font-bold text-white">{row.label}</td>
                    <td className="py-2.5 px-4 font-black text-emerald-400 tabular-nums">{formatOfflineNum(row.val)}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-200 tabular-nums">{row.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-emeraldos-900/90 rounded-2xl p-6 border border-platgold-500/30 space-y-3">
        <h3 className="text-sm font-black text-white">🗂️ سجل التحليلات والتقارير المحفوظة في قاعدة البيانات المحلية ({savedAnalyses.length})</h3>
        {savedAnalyses.length === 0 ? (
          <p className="text-xs text-slate-400 bg-emeraldos-950/60 p-4 rounded-xl border border-white/10">
            لم يتم حفظ أي تحليلات محلياً بعد. استخدم زر «💾 حفظ محلياً» لحفظ لقطة التحليل الحالية في قاعدة IndexedDB.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {savedAnalyses.map((rec) => (
              <div
                key={rec.id}
                className="bg-emeraldos-950/90 border border-platgold-500/25 rounded-xl p-3.5 flex flex-col justify-between gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-black text-platgold-300">{rec.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      الملف: {rec.datasetName} • {rec.xCol} / {rec.yCol} ({OFFLINE_CHART_LABELS_AR[rec.chartType] || rec.chartType})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteAnalysis(rec)}
                    className="text-xs bg-rose-900/60 hover:bg-rose-700 text-rose-200 px-2.5 py-1 rounded-lg cursor-pointer transition shrink-0"
                  >
                    🗑️ حذف
                  </button>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">{rec.summaryText}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
