import React, { useMemo, useRef } from 'react';
import {
  OFFLINE_AGG_LABELS_AR,
  OFFLINE_CHART_LABELS_AR,
  type OfflineAggMode,
  type OfflineChartType,
  type OfflineDataset,
  type OfflinePageInstance,
  type OfflinePrintPayload,
} from '../offline.types';
import {
  aggregateOfflineData,
  exportOfflineDatasetCSV,
  formatOfflineNum,
  isOfflineNumericColumn,
} from '../offlineDataEngine';
import { OfflineChartCanvas, type OfflineChartCanvasHandle } from '../components/OfflineChartCanvas';
import { OfflineToolbar } from '../components/OfflineToolbar';

const CHART_TYPE_OPTIONS: OfflineChartType[] = ['Bar', 'Line', 'Pie', 'Scatter', 'Histogram', 'Box Plot'];

interface OfflineDashboardPageProps {
  instance: OfflinePageInstance;
  dataset: OfflineDataset;
  datasets: Record<string, OfflineDataset>;
  onUpdateConfig: (instanceId: string, patch: Partial<OfflinePageInstance>) => void;
  onChangeDataset: (instanceId: string, datasetKey: string) => void;
  onRefresh: (instanceId: string) => void;
  onRequestSave: (summaryText: string) => void;
  onRequestPrint: (payload: OfflinePrintPayload) => void;
  onCloseToHome: (instanceId: string) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const OfflineDashboardPage: React.FC<OfflineDashboardPageProps> = ({
  instance,
  dataset,
  datasets,
  onUpdateConfig,
  onChangeDataset,
  onRefresh,
  onRequestSave,
  onRequestPrint,
  onCloseToHome,
  onToast,
}) => {
  const mainChartRef = useRef<OfflineChartCanvasHandle | null>(null);

  const handleChartTypeChange = (nextType: OfflineChartType) => {
    if (nextType === 'Scatter') {
      const numericCols = dataset.numericCols.filter((c) => isOfflineNumericColumn(dataset.rows, c, dataset.columnTypes));
      const nextY = isOfflineNumericColumn(dataset.rows, instance.yCol, dataset.columnTypes)
        ? instance.yCol
        : numericCols[0] || instance.yCol;
      const xIsNumeric = isOfflineNumericColumn(dataset.rows, instance.xCol, dataset.columnTypes);
      const nextX =
        xIsNumeric && (instance.xCol !== nextY || numericCols.length < 2)
          ? instance.xCol
          : numericCols.find((c) => c !== nextY) || numericCols[0] || instance.xCol;

      onUpdateConfig(instance.instanceId, {
        chartType: nextType,
        xCol: nextX,
        yCol: nextY,
      });

      if (nextX !== instance.xCol || nextY !== instance.yCol) {
        onToast(`تم ضبط المحورين (${nextX} و ${nextY}) لعرض مخطط التشتت تلقائياً!`);
      }
      return;
    }
    if (nextType === 'Line' && dataset.dateCols && dataset.dateCols.length > 0 && !dataset.dateCols.includes(instance.xCol)) {
      const dateX = dataset.dateCols[0];
      onUpdateConfig(instance.instanceId, { chartType: nextType, xCol: dateX });
      onToast(`تم اختيار عمود التاريخ (${dateX}) تلقائياً لعرض المخطط الخطي الزمني!`);
      return;
    }
    onUpdateConfig(instance.instanceId, { chartType: nextType });
  };

  const { labels, items, totalSum, avgVal, maxVal, minVal, maxLabel, minLabel } = useMemo(() => {
    const agg = aggregateOfflineData(dataset, instance.xCol, instance.yCol, instance.aggMode);
    let total = 0;
    let maxV = agg.values.length ? -Infinity : 0;
    let minV = agg.values.length ? Infinity : 0;
    let maxI = 0;
    let minI = 0;

    for (let i = 0; i < agg.values.length; i++) {
      const v = agg.values[i];
      total += v;
      if (v > maxV) {
        maxV = v;
        maxI = i;
      }
      if (v < minV) {
        minV = v;
        minI = i;
      }
    }
    const avg = agg.values.length ? total / agg.values.length : 0;

    const sortedItems = agg.labels
      .map((l, i) => ({
        label: l,
        val: agg.values[i],
        pct: total ? ((agg.values[i] / total) * 100).toFixed(1) : '0.0',
        diff: agg.values[i] - avg,
      }))
      .sort((a, b) => b.val - a.val);

    return {
      labels: agg.labels,
      items: sortedItems,
      totalSum: total,
      avgVal: avg,
      maxVal: maxV,
      minVal: minV,
      maxLabel: agg.labels[maxI] || '',
      minLabel: agg.labels[minI] || '',
    };
  }, [dataset, instance.xCol, instance.yCol, instance.aggMode]);

  const handlePrintChart = () => {
    const imgUrl = mainChartRef.current?.getPngDataUrl() || undefined;
    onRequestPrint({
      kind: 'chart',
      title: `مخطط لوحة القيادة: ${instance.yCol} حسب ${instance.xCol} (${OFFLINE_CHART_LABELS_AR[instance.chartType]})`,
      subtitle: `المصدر: ${dataset.name} • التجميع: ${OFFLINE_AGG_LABELS_AR[instance.aggMode]}`,
      chartImageDataUrl: imgUrl,
      summaryPairs: [
        { name: 'اسم الملف', value: dataset.name },
        { name: 'المحور الأفقي (X)', value: instance.xCol },
        { name: 'المحور الرأسي (Y)', value: instance.yCol },
        { name: 'نوع المخطط', value: OFFLINE_CHART_LABELS_AR[instance.chartType] },
        { name: 'المجموع الإجمالي', value: formatOfflineNum(totalSum) },
        { name: 'المتوسط الحسابي', value: formatOfflineNum(avgVal) },
      ],
      tableHeaders: ['#', 'التصنيف', 'القيمة', 'النسبة %'],
      tableRows: items.slice(0, 200).map((item, i) => [i + 1, item.label, formatOfflineNum(item.val), `${item.pct}%`]),
    });
  };

  return (
    <div className="flex flex-col gap-4 min-h-full">
      <OfflineToolbar
        instance={instance}
        datasetName={dataset.name}
        onRefresh={onRefresh}
        onPrint={handlePrintChart}
        printLabel="🖨️ طباعة المخطط"
        onSave={() =>
          onRequestSave(
            `لوحة القيادة (${dataset.name}): إجمالي ${instance.yCol} = ${formatOfflineNum(totalSum)}، المتوسط = ${formatOfflineNum(avgVal)}، الأعلى: ${maxLabel}`
          )
        }
        onCloseToHome={onCloseToHome}
      />

      <div className="bg-emeraldos-900/90 border border-platgold-500/30 rounded-2xl p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 items-end">
        <div>
          <label className="block text-[10px] font-bold text-platgold-300 mb-1">📂 مصدر البيانات:</label>
          <select
            value={instance.datasetKey}
            onChange={(e) => onChangeDataset(instance.instanceId, e.target.value)}
            className="w-full bg-emeraldos-950 text-white font-bold text-xs rounded-lg p-2 border border-platgold-500/30"
          >
            {Object.values(datasets).map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-platgold-300 mb-1">المحور الأفقي (X):</label>
          <select
            value={instance.xCol}
            onChange={(e) => onUpdateConfig(instance.instanceId, { xCol: e.target.value })}
            className="w-full bg-emeraldos-950 text-white font-bold text-xs rounded-lg p-2 border border-platgold-500/30"
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
          <label className="block text-[10px] font-bold text-platgold-300 mb-1">المحور الرأسي (Y):</label>
          <select
            value={instance.yCol}
            onChange={(e) => onUpdateConfig(instance.instanceId, { yCol: e.target.value })}
            className="w-full bg-emeraldos-950 text-white font-bold text-xs rounded-lg p-2 border border-platgold-500/30"
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
          <label className="block text-[10px] font-bold text-platgold-300 mb-1">التجميع (Aggregation):</label>
          <select
            value={instance.aggMode}
            onChange={(e) => onUpdateConfig(instance.instanceId, { aggMode: e.target.value as OfflineAggMode })}
            className="w-full bg-emeraldos-950 text-white font-bold text-xs rounded-lg p-2 border border-platgold-500/30"
          >
            <option value="sum">المجموع</option>
            <option value="avg">المتوسط</option>
            <option value="count">العدد</option>
            <option value="max">أعلى قيمة</option>
            <option value="min">أدنى قيمة</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-platgold-300 mb-1">📊 نوع المخطط ▼</label>
          <select
            value={instance.chartType}
            onChange={(e) => handleChartTypeChange(e.target.value as OfflineChartType)}
            className="w-full bg-emeraldos-950 text-platgold-200 font-black text-xs rounded-lg p-2 border border-platgold-400/50"
          >
            {CHART_TYPE_OPTIONS.map((ct) => (
              <option key={ct} value={ct}>
                {OFFLINE_CHART_LABELS_AR[ct]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
        <div className="bg-gradient-to-br from-emeraldos-800 to-emeraldos-900 rounded-xl p-3 border border-emeraldos-500/40 shadow">
          <p className="text-[10px] font-bold text-emeraldos-300">إجمالي المجموع</p>
          <p className="text-lg font-black text-white mt-0.5 truncate tabular-nums">{formatOfflineNum(totalSum)}</p>
          <span className="text-[9px] text-emeraldos-400">مجموع {instance.yCol}</span>
        </div>
        <div className="bg-gradient-to-br from-teal-800 to-emeraldos-900 rounded-xl p-3 border border-teal-500/40 shadow">
          <p className="text-[10px] font-bold text-teal-200">المتوسط الحسابي</p>
          <p className="text-lg font-black text-white mt-0.5 truncate tabular-nums">{formatOfflineNum(avgVal)}</p>
          <span className="text-[9px] text-teal-300">متوسط {instance.yCol}</span>
        </div>
        <div className="bg-gradient-to-br from-amber-700 to-emeraldos-950 rounded-xl p-3 border border-platgold-500/40 shadow">
          <p className="text-[10px] font-bold text-platgold-200">أعلى قيمة</p>
          <p className="text-lg font-black text-platgold-300 mt-0.5 truncate tabular-nums">{formatOfflineNum(maxVal)}</p>
          <span className="text-[9px] text-platgold-400 truncate block">
            {maxLabel ? `الأعلى: ${maxLabel}` : ''}
          </span>
        </div>
        <div className="bg-gradient-to-br from-indigo-900 to-emeraldos-950 rounded-xl p-3 border border-indigo-500/40 shadow">
          <p className="text-[10px] font-bold text-indigo-200">أدنى قيمة</p>
          <p className="text-lg font-black text-white mt-0.5 truncate tabular-nums">{formatOfflineNum(minVal)}</p>
          <span className="text-[9px] text-indigo-300 truncate block">
            {minLabel ? `الأدنى: ${minLabel}` : ''}
          </span>
        </div>
        <div className="bg-gradient-to-br from-sky-900 to-emeraldos-950 rounded-xl p-3 border border-sky-500/40 shadow">
          <p className="text-[10px] font-bold text-sky-200">عدد الصفوف</p>
          <p className="text-lg font-black text-white mt-0.5 tabular-nums">{formatOfflineNum(dataset.rowsCount, 0)}</p>
          <span className="text-[9px] text-sky-300">إجمالي السجلات</span>
        </div>
        <div className="bg-gradient-to-br from-rose-900 to-emeraldos-950 rounded-xl p-3 border border-rose-500/40 shadow">
          <p className="text-[10px] font-bold text-rose-200">عدد الأعمدة</p>
          <p className="text-lg font-black text-white mt-0.5 tabular-nums">{dataset.colsCount}</p>
          <span className="text-[9px] text-rose-300">حقول الملف</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-7 chart-surface-light p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="bg-emeraldos-950 text-platgold-300 text-xs font-black px-3 py-1 rounded-full border border-platgold-500/30 shadow">
              {OFFLINE_CHART_LABELS_AR[instance.chartType]}: {instance.yCol} حسب {instance.xCol} ({OFFLINE_AGG_LABELS_AR[instance.aggMode]})
            </span>
            <span className="text-[10px] text-slate-600 font-bold">{dataset.name}</span>
          </div>
          <OfflineChartCanvas
            ref={mainChartRef}
            dataset={dataset}
            xCol={instance.xCol}
            yCol={instance.yCol}
            chartType={instance.chartType}
            aggMode={instance.aggMode}
            heightClass="h-72"
          />
        </div>

        <div className="xl:col-span-5 chart-surface-light p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="bg-emeraldos-950 text-platgold-300 text-xs font-black px-3 py-1 rounded-full border border-platgold-500/30 shadow">
              التوزيع النسبي المئوي (%)
            </span>
            <span className="text-[10px] text-slate-500 font-bold">{labels.length} فئة</span>
          </div>
          <OfflineChartCanvas
            dataset={dataset}
            xCol={instance.xCol}
            yCol={instance.yCol}
            chartType="Pie"
            aggMode={instance.aggMode}
            heightClass="h-72"
          />
        </div>
      </div>

      <div className="bg-emeraldos-900/90 rounded-2xl p-4 border border-platgold-500/30">
        <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-white/10">
          <h3 className="text-xs font-black text-white">📋 جدول التفاصيل المباشرة وقيم النتائج المحسوبة لكل تصنيف</h3>
          <button
            type="button"
            onClick={() => {
              exportOfflineDatasetCSV(dataset);
              onToast('تم تصدير ملف CSV محلياً بنجاح!');
            }}
            className="bg-emeraldos-950 hover:bg-emeraldos-800 text-sky-300 border border-sky-400/30 px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition"
          >
            📥 تصدير CSV
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-right border-collapse text-xs">
            <thead className="bg-emeraldos-950 text-platgold-300 border-b border-platgold-500/30">
              <tr>
                <th className="py-2 px-3 font-black"># الترتيب</th>
                <th className="py-2 px-3 font-black">التصنيف (X)</th>
                <th className="py-2 px-3 font-black">القيمة المحسوبة (Y)</th>
                <th className="py-2 px-3 font-black">النسبة المئوية (%)</th>
                <th className="py-2 px-3 font-black">الفرق عن المتوسط</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-emeraldos-950/60">
              {items.slice(0, 150).map((item, idx) => (
                <tr key={item.label + idx} className="hover:bg-emeraldos-800/80 transition">
                  <td className="py-2 px-3 font-bold text-platgold-400 tabular-nums">#{idx + 1}</td>
                  <td className="py-2 px-3 font-bold text-white">{item.label}</td>
                  <td className="py-2 px-3 font-black text-emerald-400 tabular-nums">{formatOfflineNum(item.val)}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200 w-12 tabular-nums">{item.pct}%</span>
                      <div className="flex-1 bg-emeraldos-950 rounded-full h-1.5 overflow-hidden border border-white/10">
                        <div
                          className="platgold-gradient h-full rounded-full"
                          style={{ width: `${Math.min(Number(item.pct), 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td
                    className={`py-2 px-3 font-bold tabular-nums ${
                      item.diff >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {item.diff >= 0 ? '+' : ''}
                    {formatOfflineNum(item.diff)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
