import React, { useMemo, useState } from 'react';
import type { OfflineDataset, OfflinePageInstance, OfflinePrintPayload } from '../offline.types';
import {
  computeOfflineColumnStats,
  downloadOfflineBlobFile,
  formatOfflineNum,
  isOfflineNumericColumn,
} from '../offlineDataEngine';
import { OfflineToolbar } from '../components/OfflineToolbar';

interface OfflineStatsPageProps {
  instance: OfflinePageInstance;
  dataset: OfflineDataset;
  datasets: Record<string, OfflineDataset>;
  onChangeDataset: (instanceId: string, datasetKey: string) => void;
  onRefresh: (instanceId: string) => void;
  onRequestSave: (summaryText: string) => void;
  onRequestPrint: (payload: OfflinePrintPayload) => void;
  onCloseToHome: (instanceId: string) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

interface OfflineCategoricalSummary {
  column: string;
  nonEmptyCount: number;
  uniqueCount: number;
  topValue: string;
  topCount: number;
  topPct: string;
}

export const OfflineStatsPage: React.FC<OfflineStatsPageProps> = ({
  instance,
  dataset,
  datasets,
  onChangeDataset,
  onRefresh,
  onRequestSave,
  onRequestPrint,
  onCloseToHome,
  onToast,
}) => {
  const [colFilter, setColFilter] = useState('');

  const { statsList, catSummaries } = useMemo(() => {
    const featureCols = dataset.columns.filter((c) => c !== '#');
    const numericCols = featureCols.filter((c) => isOfflineNumericColumn(dataset.rows, c, dataset.columnTypes));
    const catCols = featureCols.filter((c) => !numericCols.includes(c));

    const computedNumeric = numericCols
      .map((col) => computeOfflineColumnStats(dataset, col))
      .filter((s): s is NonNullable<typeof s> => s !== null);

    const computedCat: OfflineCategoricalSummary[] = catCols.map((col) => {
      const freq = new Map<string, number>();
      let nonEmptyCount = 0;
      const rows = dataset.rows;
      for (let i = 0; i < rows.length; i++) {
        const raw = String(rows[i]?.[col] ?? '').trim();
        if (!raw) continue;
        nonEmptyCount++;
        freq.set(raw, (freq.get(raw) || 0) + 1);
      }
      let topValue = '—';
      let topCount = 0;
      for (const [val, cnt] of freq.entries()) {
        if (cnt > topCount) {
          topCount = cnt;
          topValue = val;
        }
      }
      const topPct = nonEmptyCount > 0 ? ((topCount / nonEmptyCount) * 100).toFixed(1) : '0.0';
      const isDateCol = dataset.dateCols?.includes(col);
      return {
        column: isDateCol ? `${col} (تاريخ)` : col,
        nonEmptyCount,
        uniqueCount: freq.size,
        topValue,
        topCount,
        topPct,
      };
    });

    return { statsList: computedNumeric, catSummaries: computedCat };
  }, [dataset]);

  const query = colFilter.trim().toLowerCase();
  const filteredStats = useMemo(
    () => (query ? statsList.filter((s) => s.column.toLowerCase().includes(query)) : statsList),
    [statsList, query]
  );
  const filteredCats = useMemo(
    () => (query ? catSummaries.filter((c) => c.column.toLowerCase().includes(query)) : catSummaries),
    [catSummaries, query]
  );

  const handleExportStatsCsv = () => {
    const lines = ['Column,Count,Sum,Mean,Median,StdDev,Min,Q1,Q3,Max,Range'];
    filteredStats.forEach((s) => {
      const range = s.max - s.min;
      lines.push(
        `"${s.column.replace(/"/g, '""')}",${s.count},${s.sum.toFixed(2)},${s.mean.toFixed(2)},${s.median.toFixed(2)},${s.stdDev.toFixed(2)},${s.min},${s.q1.toFixed(2)},${s.q3.toFixed(2)},${s.max},${range.toFixed(2)}`
      );
    });
    downloadOfflineBlobFile(
      '\uFEFF' + lines.join('\n'),
      `Offline_Stats_${dataset.name.split('.')[0]}.csv`,
      'text/csv;charset=utf-8;'
    );
    onToast('تم تصدير جدول الإحصاءات الوصفية محلياً (CSV) بنجاح!');
  };

  const handlePrintStats = () => {
    onRequestPrint({
      kind: 'report',
      title: `جدول التحليل الإحصائي الوصفي — ${dataset.name}`,
      subtitle: `إجمالي السجلات: ${dataset.rowsCount} • الأعمدة الرقمية: ${statsList.length} • الأعمدة النصية: ${catSummaries.length}`,
      summaryPairs: [
        { name: 'ملف البيانات', value: dataset.name },
        { name: 'عدد السجلات', value: formatOfflineNum(dataset.rowsCount, 0) },
        { name: 'الأعمدة الرقمية', value: String(statsList.length) },
        { name: 'الأعمدة النصية', value: String(catSummaries.length) },
      ],
      tableHeaders: [
        '#',
        'العمود',
        'العدد',
        'المجموع',
        'المتوسط',
        'الوسيط',
        'الانحراف المعياري',
        'الأدنى',
        'Q1',
        'Q3',
        'الأقصى',
        'المدى',
      ],
      tableRows: filteredStats.map((s, idx) => [
        idx + 1,
        s.column,
        s.count,
        formatOfflineNum(s.sum),
        formatOfflineNum(s.mean),
        formatOfflineNum(s.median),
        formatOfflineNum(s.stdDev),
        formatOfflineNum(s.min),
        formatOfflineNum(s.q1),
        formatOfflineNum(s.q3),
        formatOfflineNum(s.max),
        formatOfflineNum(s.max - s.min),
      ]),
    });
  };

  return (
    <div className="flex flex-col gap-4 min-h-full">
      <OfflineToolbar
        instance={instance}
        datasetName={dataset.name}
        onRefresh={onRefresh}
        onPrint={handlePrintStats}
        printLabel="🖨️ طباعة الجداول الإحصائية"
        onSave={() =>
          onRequestSave(
            `التحليل الإحصائي (${dataset.name}): ${statsList.length} عمود رقمي، ${catSummaries.length} عمود نصي، ${dataset.rowsCount} سجل`
          )
        }
        onCloseToHome={onCloseToHome}
      />

      {/* Organized Action & Filter Toolbar */}
      <div className="bg-emeraldos-900/95 border border-platgold-500/35 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end shadow-lg">
        <div className="md:col-span-4">
          <label htmlFor="offStatsDatasetSelect" className="block text-[11px] font-bold text-platgold-300 mb-1.5">
            📂 مصدر البيانات للتحليل الإحصائي
          </label>
          <select
            id="offStatsDatasetSelect"
            value={instance.datasetKey}
            onChange={(e) => onChangeDataset(instance.instanceId, e.target.value)}
            className="w-full bg-emeraldos-950 text-white font-bold text-xs rounded-xl px-3.5 py-2.5 border border-platgold-500/35 outline-none focus:border-platgold-400"
          >
            {Object.values(datasets).map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-4">
          <label htmlFor="offStatsColSearch" className="block text-[11px] font-bold text-platgold-300 mb-1.5">
            🔍 تصفية أو البحث باسم العمود
          </label>
          <input
            id="offStatsColSearch"
            type="text"
            value={colFilter}
            onChange={(e) => setColFilter(e.target.value)}
            placeholder="ابحث عن اسم عمود محدد..."
            className="w-full bg-emeraldos-950 text-white font-bold text-xs rounded-xl px-3.5 py-2.5 border border-platgold-500/35 outline-none focus:border-platgold-400"
          />
        </div>

        <div className="md:col-span-4 flex flex-wrap items-center justify-end gap-2">
          {colFilter && (
            <button
              type="button"
              onClick={() => setColFilter('')}
              className="bg-emeraldos-950 hover:bg-emeraldos-800 text-slate-200 border border-white/20 px-3.5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition"
            >
              ✕ مسح البحث
            </button>
          )}
          <button
            type="button"
            onClick={handleExportStatsCsv}
            disabled={filteredStats.length === 0}
            className="flex-1 sm:flex-initial bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white border border-sky-400/40 px-4 py-2.5 rounded-xl text-xs font-black cursor-pointer transition whitespace-nowrap"
          >
            📥 تصدير جدول الإحصائيات (CSV)
          </button>
        </div>
      </div>

      {/* Quick Summary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-emeraldos-900/90 border border-emerald-500/35 rounded-2xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-emerald-300">إجمالي السجلات</p>
            <p className="text-xl font-black text-white mt-0.5 tabular-nums">{formatOfflineNum(dataset.rowsCount, 0)}</p>
          </div>
          <span className="text-2xl">📄</span>
        </div>
        <div className="bg-emeraldos-900/90 border border-platgold-500/35 rounded-2xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-platgold-300">الأعمدة الرقمية المحللة</p>
            <p className="text-xl font-black text-white mt-0.5 tabular-nums">{statsList.length}</p>
          </div>
          <span className="text-2xl">🔢</span>
        </div>
        <div className="bg-emeraldos-900/90 border border-sky-500/35 rounded-2xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-sky-300">الأعمدة النصية / الفئوية</p>
            <p className="text-xl font-black text-white mt-0.5 tabular-nums">{catSummaries.length}</p>
          </div>
          <span className="text-2xl">🏷️</span>
        </div>
        <div className="bg-emeraldos-900/90 border border-violet-500/35 rounded-2xl p-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-violet-300">إجمالي الحقول</p>
            <p className="text-xl font-black text-white mt-0.5 tabular-nums">
              {statsList.length + catSummaries.length}
            </p>
          </div>
          <span className="text-2xl">📊</span>
        </div>
      </div>

      {/* Main Large Numeric Statistics Table */}
      <div className="bg-emeraldos-900/95 rounded-2xl p-5 border border-platgold-500/35 flex-1 flex flex-col gap-6 shadow-xl">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-3">
            <div>
              <h3 className="text-base font-black text-white">🧮 جدول التحليل الإحصائي الوصفي للأعمدة الرقمية</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                عرض جدولي شامل لجميع المقاييس الإحصائية محلياً (المجموع، المتوسط، الوسيط، الانحراف المعياري، الربيعيات، والمدى)
              </p>
            </div>
            <span className="text-xs bg-platgold-500/20 text-platgold-200 border border-platgold-400/35 px-3 py-1 rounded-xl font-bold tabular-nums">
              {filteredStats.length} عمود رقمي
            </span>
          </div>

          {filteredStats.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-300 bg-emeraldos-950/70 rounded-2xl border border-white/10">
              لا توجد أعمدة رقمية مطابقة لعرضها في الجدول الإحصائي.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-platgold-500/30 shadow-inner">
              <table className="w-full text-right border-collapse text-xs sm:text-sm min-w-[980px]">
                <thead className="bg-emeraldos-950 text-platgold-300 border-b border-platgold-500/40">
                  <tr>
                    <th className="py-3 px-3 font-black w-10">#</th>
                    <th className="py-3 px-3 font-black">اسم العمود</th>
                    <th className="py-3 px-3 font-black">العدد</th>
                    <th className="py-3 px-3 font-black">المجموع (Sum)</th>
                    <th className="py-3 px-3 font-black">المتوسط (Mean)</th>
                    <th className="py-3 px-3 font-black">الوسيط (Median)</th>
                    <th className="py-3 px-3 font-black">الانحراف المعياري</th>
                    <th className="py-3 px-3 font-black">الأدنى (Min)</th>
                    <th className="py-3 px-3 font-black">الربيع الأول (Q1)</th>
                    <th className="py-3 px-3 font-black">الربيع الثالث (Q3)</th>
                    <th className="py-3 px-3 font-black">الأقصى (Max)</th>
                    <th className="py-3 px-3 font-black">المدى (Range)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-emeraldos-950/65">
                  {filteredStats.map((s, idx) => (
                    <tr key={s.column} className="hover:bg-emeraldos-800/75 transition">
                      <td className="py-3 px-3 font-bold text-platgold-400 tabular-nums">#{idx + 1}</td>
                      <td className="py-3 px-3 font-black text-white whitespace-nowrap">{s.column}</td>
                      <td className="py-3 px-3 font-bold text-slate-200 tabular-nums">
                        {formatOfflineNum(s.count, 0)}
                      </td>
                      <td className="py-3 px-3 font-black text-platgold-300 tabular-nums">{formatOfflineNum(s.sum)}</td>
                      <td className="py-3 px-3 font-black text-white tabular-nums">{formatOfflineNum(s.mean, 2)}</td>
                      <td className="py-3 px-3 font-black text-emerald-400 tabular-nums">
                        {formatOfflineNum(s.median, 2)}
                      </td>
                      <td className="py-3 px-3 font-bold text-cyan-300 tabular-nums">
                        {formatOfflineNum(s.stdDev, 2)}
                      </td>
                      <td className="py-3 px-3 font-bold text-amber-300 tabular-nums">{formatOfflineNum(s.min)}</td>
                      <td className="py-3 px-3 font-bold text-slate-200 tabular-nums">{formatOfflineNum(s.q1, 2)}</td>
                      <td className="py-3 px-3 font-bold text-slate-200 tabular-nums">{formatOfflineNum(s.q3, 2)}</td>
                      <td className="py-3 px-3 font-black text-sky-400 tabular-nums">{formatOfflineNum(s.max)}</td>
                      <td className="py-3 px-3 font-bold text-violet-300 tabular-nums">
                        {formatOfflineNum(s.max - s.min)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Categorical / Text Columns Summary Table */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-3">
            <div>
              <h3 className="text-base font-black text-white">🏷️ جدول ملخص الأعمدة النصية والفئوية</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                تحليل التنوع والقيم الأكثر تكراراً لكل حقل نصي أو تصنيفي في البيانات
              </p>
            </div>
            <span className="text-xs bg-sky-500/20 text-sky-200 border border-sky-400/35 px-3 py-1 rounded-xl font-bold tabular-nums">
              {filteredCats.length} عمود نصي
            </span>
          </div>

          {filteredCats.length === 0 ? (
            <div className="p-6 text-center text-xs sm:text-sm text-slate-300 bg-emeraldos-950/70 rounded-2xl border border-white/10">
              لا توجد أعمدة نصية أو فئوية مطابقة في هذا الملف.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-sky-500/30 shadow-inner">
              <table className="w-full text-right border-collapse text-xs sm:text-sm">
                <thead className="bg-emeraldos-950 text-sky-300 border-b border-sky-500/35">
                  <tr>
                    <th className="py-3 px-4 font-black w-10">#</th>
                    <th className="py-3 px-4 font-black">اسم العمود</th>
                    <th className="py-3 px-4 font-black">السجلات غير الفارغة</th>
                    <th className="py-3 px-4 font-black">عدد القيم الفريدة</th>
                    <th className="py-3 px-4 font-black">القيمة الأكثر تكراراً</th>
                    <th className="py-3 px-4 font-black">عدد ونسبة التكرار</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-emeraldos-950/65">
                  {filteredCats.map((cat, idx) => (
                    <tr key={cat.column} className="hover:bg-emeraldos-800/75 transition">
                      <td className="py-3 px-4 font-bold text-platgold-400 tabular-nums">#{idx + 1}</td>
                      <td className="py-3 px-4 font-black text-white">{cat.column}</td>
                      <td className="py-3 px-4 font-bold text-slate-200 tabular-nums">
                        {formatOfflineNum(cat.nonEmptyCount, 0)}
                      </td>
                      <td className="py-3 px-4 font-black text-sky-300 tabular-nums">
                        {formatOfflineNum(cat.uniqueCount, 0)}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-300">{cat.topValue}</td>
                      <td className="py-3 px-4 font-bold text-platgold-200 tabular-nums">
                        {cat.topCount} مرة ({cat.topPct}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
