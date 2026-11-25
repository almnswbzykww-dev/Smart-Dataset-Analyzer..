import React, { useMemo, useRef } from 'react';
import {
  AGG_MODE_LABELS_AR,
  CHART_TYPE_LABELS_AR,
  type AggMode,
  type ChartType,
  type Dataset,
  type PageInstance,
  type PrintPayload,
} from '../../types/app';
import {
  detectSmartColumnKind,
  formatColumnKindLabel,
} from '../../utils/smartDataEngine';
import { aggregateDataForDataset, exportDatasetCSV, formatNum } from '../../utils/csvParser';
import { ChartRenderer, type ChartRendererHandle } from '../ChartRenderer';
import { PageToolbar } from '../PageToolbar';

const CHART_TYPE_OPTIONS: ChartType[] = ['Bar', 'Line', 'Pie', 'Scatter', 'Histogram', 'Box Plot'];

interface DashboardPageProps {
  instance: PageInstance;
  dataset: Dataset;
  datasets: Record<string, Dataset>;
  onUpdateConfig: (instanceId: string, patch: Partial<PageInstance>) => void;
  onChangeDataset: (instanceId: string, datasetKey: string) => void;
  onRefresh: (instanceId: string) => void;
  onRequestSave: (summaryText: string) => void;
  onRequestPrint: (payload: PrintPayload) => void;
  onCloseToHome: (instanceId: string) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
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
  const mainChartRef = useRef<ChartRendererHandle | null>(null);

  const featureCols = useMemo(() => dataset.columns.filter((c) => c !== '#'), [dataset.columns]);

  const colKinds = useMemo(() => {
    const map: Record<string, ReturnType<typeof detectSmartColumnKind>> = {};
    for (const col of featureCols) {
      map[col] = detectSmartColumnKind(dataset, col);
    }
    return map;
  }, [dataset, featureCols]);

  const yDisplayLabel = !instance.yCol || instance.yCol === '__auto__' ? 'التكرار التلقائي' : instance.yCol;

  const handleChartTypeChange = (nextType: ChartType) => {
    onUpdateConfig(instance.instanceId, { chartType: nextType });
  };

  const { labels, items, totalSum, avgVal, maxVal, minVal, maxLabel, minLabel } = useMemo(() => {
    const effectiveMode = !instance.yCol || instance.yCol === '__auto__' ? 'count' : instance.aggMode;
    const agg = aggregateDataForDataset(dataset, instance.xCol, instance.yCol, effectiveMode);
    let total = 0;
    let validCount = 0;
    let maxV = -Infinity;
    let minV = Infinity;
    let maxI = 0;
    let minI = 0;

    for (let i = 0; i < agg.values.length; i++) {
      const raw = agg.values[i];
      const v = Number.isFinite(raw) ? raw : 0;
      total += v;
      validCount++;
      if (v > maxV) {
        maxV = v;
        maxI = i;
      }
      if (v < minV) {
        minV = v;
        minI = i;
      }
    }
    const safeTotal = Number.isFinite(total) ? total : 0;
    const safeMax = validCount > 0 && Number.isFinite(maxV) ? maxV : 0;
    const safeMin = validCount > 0 && Number.isFinite(minV) ? minV : 0;
    const avg = validCount > 0 && Number.isFinite(safeTotal / validCount) ? safeTotal / validCount : 0;

    const sortedItems = agg.labels
      .map((l, i) => {
        const val = Number.isFinite(agg.values[i]) ? agg.values[i] : 0;
        const pctNum = safeTotal !== 0 && Number.isFinite(safeTotal) ? (val / safeTotal) * 100 : 0;
        return {
          label: l,
          val,
          pct: Number.isFinite(pctNum) ? pctNum.toFixed(1) : '0.0',
          diff: Number.isFinite(val - avg) ? val - avg : 0,
        };
      })
      .sort((a, b) => b.val - a.val);

    return {
      labels: agg.labels,
      items: sortedItems,
      totalSum: safeTotal,
      avgVal: avg,
      maxVal: safeMax,
      minVal: safeMin,
      maxLabel: agg.labels[maxI] || '',
      minLabel: agg.labels[minI] || '',
    };
  }, [dataset, instance.xCol, instance.yCol, instance.aggMode]);

  const handlePrintChart = () => {
    const imgUrl = mainChartRef.current?.getPngDataUrl() || undefined;
    onRequestPrint({
      kind: 'chart',
      title: `مخطط لوحة القيادة: ${yDisplayLabel} حسب ${instance.xCol} (${CHART_TYPE_LABELS_AR[instance.chartType]})`,
      subtitle: `المصدر: ${dataset.name} • التجميع: ${AGG_MODE_LABELS_AR[instance.aggMode]}`,
      chartImageDataUrl: imgUrl,
      summaryPairs: [
        { name: 'اسم الملف', value: dataset.name },
        { name: 'محور X', value: instance.xCol },
        { name: 'محور Y', value: yDisplayLabel },
        { name: 'نوع المخطط', value: CHART_TYPE_LABELS_AR[instance.chartType] },
        { name: 'المجموع الإجمالي', value: formatNum(totalSum) },
        { name: 'المتوسط الحسابي', value: formatNum(avgVal) },
      ],
      tableHeaders: ['#', 'التصنيف', 'القيمة', 'النسبة %'],
      tableRows: items.slice(0, 200).map((item, i) => [i + 1, item.label, formatNum(item.val), `${item.pct}%`]),
    });
  };

  return (
    <div className="flex flex-col gap-4 min-h-full">
      <PageToolbar
        instance={instance}
        datasetName={dataset.name}
        onRefresh={onRefresh}
        onPrint={handlePrintChart}
        printLabel="🖨️ طباعة المخطط"
        onSave={() =>
          onRequestSave(
            `لوحة القيادة (${dataset.name}): إجمالي ${yDisplayLabel} = ${formatNum(totalSum)}، المتوسط = ${formatNum(avgVal)}، الأعلى: ${maxLabel}`
          )
        }
        onCloseToHome={onCloseToHome}
      />

      {/* Page-Specific Controls Bar */}
      <div className="bg-emeraldos-900/90 border border-platgold-500/30 rounded-2xl p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-[10px] font-bold text-platgold-300 mb-1">📂 مصدر البيانات:</label>
          <select
            value={instance.datasetKey}
            onChange={(e) => onChangeDataset(instance.instanceId, e.target.value)}
            className="w-full bg-emeraldos-950 text-white font-bold text-xs rounded-lg p-2.5 border border-platgold-500/30"
          >
            {Object.values(datasets).map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-platgold-300 mb-1">محور X:</label>
          <select
            value={instance.xCol}
            onChange={(e) => onUpdateConfig(instance.instanceId, { xCol: e.target.value })}
            className="w-full bg-emeraldos-950 text-white font-bold text-xs rounded-lg p-2.5 border border-platgold-500/30"
          >
            {featureCols.map((c) => (
              <option key={c} value={c}>
                {c} ({formatColumnKindLabel(colKinds[c])})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-platgold-300 mb-1">محور Y:</label>
          <select
            value={!instance.yCol || instance.yCol === '__auto__' ? '' : instance.yCol}
            onChange={(e) => onUpdateConfig(instance.instanceId, { yCol: e.target.value })}
            className="w-full bg-emeraldos-950 text-white font-bold text-xs rounded-lg p-2.5 border border-platgold-500/30"
          >
            <option value="">— غير مطلوب / تلقائي (Count)</option>
            {featureCols.map((c) => (
              <option key={c} value={c}>
                {c} ({formatColumnKindLabel(colKinds[c])})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-platgold-300 mb-1">التجميع (Aggregation):</label>
          <select
            value={instance.aggMode}
            onChange={(e) => onUpdateConfig(instance.instanceId, { aggMode: e.target.value as AggMode })}
            className="w-full bg-emeraldos-950 text-white font-bold text-xs rounded-lg p-2.5 border border-platgold-500/30"
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
            onChange={(e) => handleChartTypeChange(e.target.value as ChartType)}
            className="w-full bg-emeraldos-950 text-platgold-200 font-black text-xs rounded-lg p-2.5 border border-platgold-400/50"
          >
            {CHART_TYPE_OPTIONS.map((ct) => (
              <option key={ct} value={ct}>
                {ct} — {CHART_TYPE_LABELS_AR[ct]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 6 KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="bg-gradient-to-br from-emeraldos-800 to-emeraldos-900 rounded-xl p-3.5 border border-emeraldos-500/40 shadow">
          <p className="text-[10px] font-bold text-emeraldos-300">إجمالي المجموع (Sum)</p>
          <p className="text-lg font-black text-white mt-0.5 truncate tabular-nums">{formatNum(totalSum)}</p>
          <span className="text-[9px] text-emeraldos-400">مجموع {yDisplayLabel}</span>
        </div>
        <div className="bg-gradient-to-br from-teal-800 to-emeraldos-900 rounded-xl p-3.5 border border-teal-500/40 shadow">
          <p className="text-[10px] font-bold text-teal-200">المتوسط الحسابي (Mean)</p>
          <p className="text-lg font-black text-white mt-0.5 truncate tabular-nums">{formatNum(avgVal)}</p>
          <span className="text-[9px] text-teal-300">متوسط {yDisplayLabel}</span>
        </div>
        <div className="bg-gradient-to-br from-amber-700 to-emeraldos-950 rounded-xl p-3.5 border border-platgold-500/40 shadow">
          <p className="text-[10px] font-bold text-platgold-200">أعلى قيمة (Maximum)</p>
          <p className="text-lg font-black text-platgold-300 mt-0.5 truncate tabular-nums">{formatNum(maxVal)}</p>
          <span className="text-[9px] text-platgold-400 truncate block">
            {maxLabel ? `الأعلى: ${maxLabel}` : ''}
          </span>
        </div>
        <div className="bg-gradient-to-br from-indigo-900 to-emeraldos-950 rounded-xl p-3.5 border border-indigo-500/40 shadow">
          <p className="text-[10px] font-bold text-indigo-200">أدنى قيمة (Minimum)</p>
          <p className="text-lg font-black text-white mt-0.5 truncate tabular-nums">{formatNum(minVal)}</p>
          <span className="text-[9px] text-indigo-300 truncate block">
            {minLabel ? `الأدنى: ${minLabel}` : ''}
          </span>
        </div>
        <div className="bg-gradient-to-br from-sky-900 to-emeraldos-950 rounded-xl p-3.5 border border-sky-500/40 shadow">
          <p className="text-[10px] font-bold text-sky-200">عدد الصفوف (Records)</p>
          <p className="text-lg font-black text-white mt-0.5 tabular-nums">{formatNum(dataset.rowsCount, 0)}</p>
          <span className="text-[9px] text-sky-300">إجمالي السجلات</span>
        </div>
        <div className="bg-gradient-to-br from-rose-900 to-emeraldos-950 rounded-xl p-3.5 border border-rose-500/40 shadow">
          <p className="text-[10px] font-bold text-rose-200">عدد الأعمدة (Features)</p>
          <p className="text-lg font-black text-white mt-0.5 tabular-nums">{dataset.colsCount}</p>
          <span className="text-[9px] text-rose-300">حقول الملف</span>
        </div>
      </div>

      {/* Dual Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-7 chart-surface-light p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="bg-emeraldos-950 text-platgold-300 text-xs font-black px-3 py-1 rounded-full border border-platgold-500/30 shadow">
              {CHART_TYPE_LABELS_AR[instance.chartType]}: {yDisplayLabel} حسب {instance.xCol} ({AGG_MODE_LABELS_AR[instance.aggMode]})
            </span>
            <span className="text-[10px] text-slate-600 font-bold">{dataset.name}</span>
          </div>
          <ChartRenderer
            ref={mainChartRef}
            dataset={dataset}
            xCol={instance.xCol}
            yCol={instance.yCol}
            chartType={instance.chartType}
            aggMode={instance.aggMode}
            heightClass="h-80"
          />
        </div>

        <div className="xl:col-span-5 chart-surface-light p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="bg-emeraldos-950 text-platgold-300 text-xs font-black px-3 py-1 rounded-full border border-platgold-500/30 shadow">
              التوزيع النسبي المئوي (%)
            </span>
            <span className="text-[10px] text-slate-500 font-bold">{labels.length} فئة</span>
          </div>
          <ChartRenderer
            dataset={dataset}
            xCol={instance.xCol}
            yCol={instance.yCol}
            chartType="Pie"
            aggMode={instance.aggMode}
            heightClass="h-80"
          />
        </div>
      </div>

      {/* Breakdown Table */}
      <div className="bg-emeraldos-900/90 rounded-2xl p-4 border border-platgold-500/30">
        <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-white/10">
          <h3 className="text-xs font-black text-white">📋 جدول التفاصيل المباشرة وقيم النتائج المحسوبة لكل تصنيف</h3>
          <button
            type="button"
            onClick={() => {
              exportDatasetCSV(dataset);
              onToast('تم تصدير ملف CSV بنجاح!');
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
                <th className="py-2 px-3 font-black">التصنيف (X-Axis)</th>
                <th className="py-2 px-3 font-black">القيمة المحسوبة (Y-Value)</th>
                <th className="py-2 px-3 font-black">النسبة المئوية (%)</th>
                <th className="py-2 px-3 font-black">الفرق عن المتوسط</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-emeraldos-950/60">
              {items.slice(0, 150).map((item, idx) => (
                <tr key={item.label + idx} className="hover:bg-emeraldos-800/80 transition">
                  <td className="py-2 px-3 font-bold text-platgold-400 tabular-nums">#{idx + 1}</td>
                  <td className="py-2 px-3 font-bold text-white">{item.label}</td>
                  <td className="py-2 px-3 font-black text-emerald-400 tabular-nums">{formatNum(item.val)}</td>
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
                    {formatNum(item.diff)}
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
