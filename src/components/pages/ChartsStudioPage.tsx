import React, { useMemo, useRef, useState } from 'react';
import {
  AGG_MODE_LABELS_AR,
  CHART_TYPE_LABELS_AR,
  type AggMode,
  type ChartType,
  type Dataset,
  type PageInstance,
  type PrintPayload,
} from '../../types/app';
import { formatNum } from '../../utils/csvParser';
import {
  detectSmartColumnKind,
  formatColumnKindLabel,
  prepareSmartChartData,
} from '../../utils/smartDataEngine';
import { ChartRenderer, type ChartRendererHandle } from '../ChartRenderer';
import { PageToolbar } from '../PageToolbar';

const CHART_TYPES: ChartType[] = ['Bar', 'Line', 'Pie', 'Scatter', 'Histogram', 'Box Plot'];
const Y_OPTIONAL_CHARTS = new Set<ChartType>(['Histogram', 'Box Plot']);

interface ChartsStudioPageProps {
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

export const ChartsStudioPage: React.FC<ChartsStudioPageProps> = ({
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
  const chartRef = useRef<ChartRendererHandle | null>(null);
  const [renderNonce, setRenderNonce] = useState(0);

  const featureCols = useMemo(() => dataset.columns.filter((c) => c !== '#'), [dataset.columns]);

  const colKinds = useMemo(() => {
    const map: Record<string, ReturnType<typeof detectSmartColumnKind>> = {};
    for (const col of featureCols) {
      map[col] = detectSmartColumnKind(dataset, col);
    }
    return map;
  }, [dataset, featureCols]);

  const xKind = colKinds[instance.xCol] || 'text';
  const yIsOmitted = !instance.yCol || instance.yCol === '__auto__';
  const yKind = yIsOmitted ? null : colKinds[instance.yCol] || 'text';
  const yOptionalForChart = Y_OPTIONAL_CHARTS.has(instance.chartType) || instance.aggMode === 'count';

  const preparedSummary = useMemo(
    () => prepareSmartChartData(dataset, instance.xCol, instance.yCol, instance.chartType, instance.aggMode),
    [dataset, instance.xCol, instance.yCol, instance.chartType, instance.aggMode]
  );

  const quickMetrics = useMemo(() => {
    if (preparedSummary.kind === 'Bar' || preparedSummary.kind === 'Line' || preparedSummary.kind === 'Pie') {
      const { labels, values } = preparedSummary;
      let maxVal = -Infinity;
      let maxIdx = 0;
      let sum = 0;
      for (let i = 0; i < values.length; i++) {
        sum += values[i];
        if (values[i] > maxVal) {
          maxVal = values[i];
          maxIdx = i;
        }
      }
      return {
        primaryLabel: labels[maxIdx] || '—',
        primaryValue: values.length ? formatNum(maxVal) : '0',
        totalGroups: formatNum(preparedSummary.totalGroups, 0),
        sumValue: formatNum(sum),
      };
    }
    if (preparedSummary.kind === 'Scatter') {
      return {
        primaryLabel: `${preparedSummary.xTitle} ↔ ${preparedSummary.yTitle}`,
        primaryValue: `${formatNum(preparedSummary.points.length, 0)} نقطة`,
        totalGroups: formatNum(preparedSummary.totalMatchedPoints, 0),
        sumValue: 'انتشار نقطي',
      };
    }
    if (preparedSummary.kind === 'Histogram') {
      const maxCount = preparedSummary.counts.length ? Math.max(...preparedSummary.counts) : 0;
      const maxIdx = preparedSummary.counts.indexOf(maxCount);
      return {
        primaryLabel: preparedSummary.labels[maxIdx] || preparedSummary.targetCol,
        primaryValue: `${formatNum(maxCount, 0)} تكرار`,
        totalGroups: `${preparedSummary.labels.length} فئة`,
        sumValue: formatNum(preparedSummary.mean, 2),
      };
    }
    if (preparedSummary.kind === 'Box Plot') {
      const first = preparedSummary.groups[0];
      return {
        primaryLabel: first?.label || preparedSummary.targetYCol,
        primaryValue: first ? `الوسيط: ${formatNum(first.median)}` : '—',
        totalGroups: `${preparedSummary.groups.length} مجموعة`,
        sumValue: first ? `${formatNum(first.min)} – ${formatNum(first.max)}` : '—',
      };
    }
    return {
      primaryLabel: '—',
      primaryValue: '0',
      totalGroups: '0',
      sumValue: '—',
    };
  }, [preparedSummary]);

  const handleCreateChart = () => {
    setRenderNonce((n) => n + 1);
    onUpdateConfig(instance.instanceId, {
      xCol: instance.xCol,
      yCol: instance.yCol,
      chartType: instance.chartType,
      aggMode: instance.aggMode,
    });
    const yTitle = yIsOmitted ? 'تلقائي (العدد)' : instance.yCol;
    onToast(`تم إنشاء ${CHART_TYPE_LABELS_AR[instance.chartType]} (${instance.xCol} ← ${yTitle}) بنجاح!`);
  };

  const handleSwapAxes = () => {
    if (yIsOmitted) {
      onToast('اختر عموداً في محور Y أولاً لتبديل المحورين', 'error');
      return;
    }
    onUpdateConfig(instance.instanceId, {
      xCol: instance.yCol,
      yCol: instance.xCol,
    });
    onToast(`تم تبديل المحورين: X=${instance.yCol} و Y=${instance.xCol}`);
  };

  const handleSmartSuggest = () => {
    const numCols = featureCols.filter((c) => colKinds[c] === 'numeric');
    const dateCols = featureCols.filter((c) => colKinds[c] === 'date');
    const textCols = featureCols.filter((c) => colKinds[c] === 'text');

    if (instance.chartType === 'Scatter') {
      const nextX = numCols[0] || dataset.defaultX;
      const nextY = numCols[1] || numCols[0] || '';
      onUpdateConfig(instance.instanceId, { xCol: nextX, yCol: nextY });
      onToast(`تم ضبط أفضل محورين رقميين لمخطط التشتت (${nextX} و ${nextY || 'تلقائي'})`);
      return;
    }
    if (instance.chartType === 'Histogram') {
      const nextX = numCols[0] || dataset.defaultX;
      onUpdateConfig(instance.instanceId, { xCol: nextX, yCol: '' });
      onToast(`تم اختيار العمود الرقمي "${nextX}" لعرض المدرج التكراري`);
      return;
    }
    if (instance.chartType === 'Line' && dateCols.length > 0) {
      const nextY = numCols[0] || '';
      onUpdateConfig(instance.instanceId, { xCol: dateCols[0], yCol: nextY });
      onToast(`تم ضبط السلسلة الزمنية: ${dateCols[0]} مع ${nextY || 'العدد'}`);
      return;
    }
    const nextX = textCols[0] || dateCols[0] || dataset.defaultX;
    const nextY = numCols[0] || '';
    onUpdateConfig(instance.instanceId, { xCol: nextX, yCol: nextY });
    onToast(`تم تطبيق التوصية الذكية للمحاور: X=${nextX}`);
  };

  const handleDownloadPng = () => {
    const dataUrl = chartRef.current?.getPngDataUrl();
    if (!dataUrl) {
      onToast('لا يوجد مخطط جاهز للتصدير حالياً', 'error');
      return;
    }
    const a = document.createElement('a');
    a.download = `Chart_${instance.chartType}_${dataset.name.split('.')[0]}.png`;
    a.href = dataUrl;
    a.click();
    onToast('تم حفظ صورة المخطط بصيغة PNG بنجاح!');
  };

  const handlePrintChart = () => {
    const dataUrl = chartRef.current?.getPngDataUrl();
    if (!dataUrl) {
      onToast('يرجى التأكد من عرض مخطط صالح قبل الطباعة', 'error');
      return;
    }
    const yDisplay = yIsOmitted ? 'تلقائي (عدد السجلات)' : instance.yCol;
    onRequestPrint({
      kind: 'chart',
      title: `المخطط البياني (${CHART_TYPE_LABELS_AR[instance.chartType]}): ${yDisplay} حسب ${instance.xCol}`,
      subtitle: `ملف البيانات: ${dataset.name} • طريقة التجميع: ${AGG_MODE_LABELS_AR[instance.aggMode]}`,
      chartImageDataUrl: dataUrl,
      summaryPairs: [
        { name: 'اسم الملف', value: dataset.name },
        { name: 'نوع المخطط', value: `${CHART_TYPE_LABELS_AR[instance.chartType]} (${instance.chartType})` },
        { name: 'محور X', value: `${instance.xCol} (${formatColumnKindLabel(xKind)})` },
        { name: 'محور Y', value: yKind ? `${instance.yCol} (${formatColumnKindLabel(yKind)})` : yDisplay },
        { name: 'عدد السجلات', value: formatNum(dataset.rowsCount, 0) },
      ],
    });
  };

  return (
    <div className="flex flex-col gap-4 h-full max-w-full">
      <PageToolbar
        instance={instance}
        datasetName={dataset.name}
        onRefresh={onRefresh}
        onPrint={handlePrintChart}
        printLabel="🖨️ طباعة المخطط"
        onSave={() =>
          onRequestSave(
            `${CHART_TYPE_LABELS_AR[instance.chartType]}: ${yIsOmitted ? 'التكرار' : instance.yCol} حسب ${instance.xCol} من ملف ${dataset.name}`
          )
        }
        onCloseToHome={onCloseToHome}
        extraControls={
          <button
            type="button"
            onClick={handleDownloadPng}
            className="bg-emeraldos-900 hover:bg-emeraldos-800 text-emerald-300 border border-emerald-400/35 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition whitespace-nowrap"
          >
            🖼️ حفظ صورة PNG
          </button>
        }
      />

      {/* Explicit Manual X / Y / ChartType / Create Chart Builder */}
      <div className="bg-emeraldos-900/95 border border-platgold-500/35 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-platgold-300">🎛️ أداة إنشاء وتخصيص المخطط البياني</span>
            <span className="text-[11px] bg-emeraldos-950 text-emerald-300 border border-emerald-500/35 px-2.5 py-0.5 rounded-lg font-bold">
              {formatNum(dataset.rowsCount, 0)} صف × {featureCols.length} عمود
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSwapAxes}
              className="bg-emeraldos-950 hover:bg-emeraldos-800 text-slate-200 border border-white/20 px-3 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer transition"
            >
              ⇄ تبديل X / Y
            </button>
            <button
              type="button"
              onClick={handleSmartSuggest}
              className="bg-emerald-950/90 hover:bg-emerald-900 text-emerald-200 border border-emerald-400/40 px-3 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer transition"
            >
              ✨ توصية ذكية للمحاور
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 items-end">
          {/* Dataset Source */}
          <div className="xl:col-span-2">
            <label htmlFor={`${instance.instanceId}_dsSelect`} className="block text-[11px] font-bold text-platgold-300 mb-1.5">
              📂 مصدر البيانات
            </label>
            <select
              id={`${instance.instanceId}_dsSelect`}
              value={instance.datasetKey}
              onChange={(e) => onChangeDataset(instance.instanceId, e.target.value)}
              className="w-full bg-emeraldos-950 text-white font-bold text-xs rounded-xl px-3 py-2.5 border border-platgold-500/35 outline-none focus:border-platgold-400"
            >
              {Object.values(datasets).map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.label}
                </option>
              ))}
            </select>
          </div>

          {/* X Axis Manual Selector */}
          <div className="xl:col-span-3">
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <label htmlFor={`${instance.instanceId}_xColSelect`} className="text-[11px] font-black text-platgold-300">
                محور X:
              </label>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/15 text-sky-200 border border-sky-400/30">
                {formatColumnKindLabel(xKind)}
              </span>
            </div>
            <select
              id={`${instance.instanceId}_xColSelect`}
              value={instance.xCol}
              onChange={(e) => onUpdateConfig(instance.instanceId, { xCol: e.target.value })}
              className="w-full bg-emeraldos-950 text-white font-bold text-xs rounded-xl px-3 py-2.5 border border-platgold-500/40 outline-none focus:border-platgold-400"
            >
              {featureCols.map((c) => (
                <option key={c} value={c}>
                  {c} ({formatColumnKindLabel(colKinds[c])})
                </option>
              ))}
            </select>
          </div>

          {/* Y Axis Manual Selector (Optional when not required) */}
          <div className="xl:col-span-3">
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <label htmlFor={`${instance.instanceId}_yColSelect`} className="text-[11px] font-black text-platgold-300">
                محور Y:
              </label>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  yKind
                    ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30'
                    : 'bg-amber-500/15 text-amber-200 border-amber-400/30'
                }`}
              >
                {yKind ? formatColumnKindLabel(yKind) : yOptionalForChart ? 'اختياري (تلقائي)' : 'العدد (Count)'}
              </span>
            </div>
            <select
              id={`${instance.instanceId}_yColSelect`}
              value={yIsOmitted ? '' : instance.yCol}
              onChange={(e) => onUpdateConfig(instance.instanceId, { yCol: e.target.value })}
              className="w-full bg-emeraldos-950 text-white font-bold text-xs rounded-xl px-3 py-2.5 border border-platgold-500/40 outline-none focus:border-platgold-400"
            >
              <option value="">
                {yOptionalForChart ? '— غير مطلوب / تلقائي (اختياري)' : '— تلقائي: حساب التكرار (Count)'}
              </option>
              {featureCols.map((c) => (
                <option key={c} value={c}>
                  {c} ({formatColumnKindLabel(colKinds[c])})
                </option>
              ))}
            </select>
          </div>

          {/* Aggregation */}
          <div className="xl:col-span-1">
            <label htmlFor={`${instance.instanceId}_aggSelect`} className="block text-[11px] font-bold text-platgold-300 mb-1.5">
              التجميع
            </label>
            <select
              id={`${instance.instanceId}_aggSelect`}
              value={instance.aggMode}
              onChange={(e) => onUpdateConfig(instance.instanceId, { aggMode: e.target.value as AggMode })}
              className="w-full bg-emeraldos-950 text-white font-bold text-xs rounded-xl px-2.5 py-2.5 border border-platgold-500/35 outline-none focus:border-platgold-400"
            >
              <option value="sum">المجموع</option>
              <option value="avg">المتوسط</option>
              <option value="count">العدد</option>
              <option value="max">الأعلى</option>
              <option value="min">الأدنى</option>
            </select>
          </div>

          {/* Chart Type Selector */}
          <div className="xl:col-span-2">
            <label htmlFor={`${instance.instanceId}_chartSelect`} className="block text-[11px] font-black text-platgold-300 mb-1.5">
              نوع المخطط:
            </label>
            <select
              id={`${instance.instanceId}_chartSelect`}
              value={instance.chartType}
              onChange={(e) => onUpdateConfig(instance.instanceId, { chartType: e.target.value as ChartType })}
              className="w-full bg-emeraldos-950 text-platgold-200 font-black text-xs rounded-xl px-3 py-2.5 border border-platgold-400/60 shadow outline-none focus:border-platgold-300"
            >
              {CHART_TYPES.map((ct) => (
                <option key={ct} value={ct}>
                  {ct} — {CHART_TYPE_LABELS_AR[ct]}
                </option>
              ))}
            </select>
          </div>

          {/* Explicit Create Chart Button */}
          <div className="xl:col-span-1">
            <button
              id={`${instance.instanceId}_createChartBtn`}
              type="button"
              onClick={handleCreateChart}
              className="w-full platgold-gradient text-emeraldos-950 font-black text-xs px-3 py-2.5 rounded-xl cursor-pointer transition shadow-lg whitespace-nowrap"
            >
              إنشاء المخطط
            </button>
          </div>
        </div>
      </div>

      {/* Live Computed Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-emeraldos-900/90 border border-platgold-500/30 rounded-xl px-3.5 py-2.5">
          <p className="text-[10px] font-bold text-platgold-300">المحور الأفقي المختار (X)</p>
          <p className="text-sm font-black text-white truncate mt-0.5">{instance.xCol}</p>
        </div>
        <div className="bg-emeraldos-900/90 border border-emerald-500/30 rounded-xl px-3.5 py-2.5">
          <p className="text-[10px] font-bold text-emerald-300">المحور الرأسي (Y)</p>
          <p className="text-sm font-black text-white truncate mt-0.5">
            {yIsOmitted ? 'تلقائي (غير مطلوب / التكرار)' : instance.yCol}
          </p>
        </div>
        <div className="bg-emeraldos-900/90 border border-sky-500/30 rounded-xl px-3.5 py-2.5">
          <p className="text-[10px] font-bold text-sky-300">أبرز نتيجة / نطاق</p>
          <p className="text-sm font-black text-white truncate mt-0.5">
            {quickMetrics.primaryLabel} ({quickMetrics.primaryValue})
          </p>
        </div>
        <div className="bg-emeraldos-900/90 border border-violet-500/30 rounded-xl px-3.5 py-2.5">
          <p className="text-[10px] font-bold text-violet-300">حجم المعالجة / التجميع</p>
          <p className="text-sm font-black text-white truncate mt-0.5">
            {quickMetrics.totalGroups} • {quickMetrics.sumValue}
          </p>
        </div>
      </div>

      {/* Spacious Large Chart Viewport */}
      <div className="bg-emeraldos-900/95 rounded-2xl p-5 border border-platgold-500/35 flex-1 flex flex-col min-h-[520px] shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-white/15">
          <h3 className="text-base font-black text-platgold-300">
            📈 {CHART_TYPE_LABELS_AR[instance.chartType]} ({instance.chartType}):{' '}
            {yIsOmitted ? 'التكرار التلقائي' : instance.yCol} حسب {instance.xCol}
          </h3>
          <span className="text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-400/30 font-bold">
            📂 {dataset.name} ({formatNum(dataset.rowsCount, 0)} صف)
          </span>
        </div>

        <div className="chart-surface-light p-5 flex-1 flex items-center justify-center">
          <ChartRenderer
            key={`${instance.instanceId}_${renderNonce}`}
            ref={chartRef}
            dataset={dataset}
            xCol={instance.xCol}
            yCol={instance.yCol}
            chartType={instance.chartType}
            aggMode={instance.aggMode}
            heightClass="h-[460px]"
          />
        </div>
      </div>
    </div>
  );
};
