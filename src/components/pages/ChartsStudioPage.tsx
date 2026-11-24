import React, { useRef } from 'react';
import {
  AGG_MODE_LABELS_AR,
  CHART_TYPE_LABELS_AR,
  type AggMode,
  type ChartType,
  type Dataset,
  type PageInstance,
  type PrintPayload,
} from '../../types/app';
import { isNumericColumn } from '../../utils/csvParser';
import { ChartRenderer, type ChartRendererHandle } from '../ChartRenderer';
import { PageToolbar } from '../PageToolbar';

const CHART_TYPES: ChartType[] = ['Bar', 'Line', 'Pie', 'Scatter', 'Histogram', 'Box Plot'];

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

  const handleChartTypeChange = (nextType: ChartType) => {
    if (nextType === 'Scatter') {
      const numericCols = dataset.numericCols.filter((c) => isNumericColumn(dataset.rows, c, dataset.columnTypes));
      const nextY = isNumericColumn(dataset.rows, instance.yCol, dataset.columnTypes)
        ? instance.yCol
        : numericCols[0] || instance.yCol;
      const xIsNumeric = isNumericColumn(dataset.rows, instance.xCol, dataset.columnTypes);
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
    onRequestPrint({
      kind: 'chart',
      title: `المخطط البياني (${CHART_TYPE_LABELS_AR[instance.chartType]}): ${instance.yCol} حسب ${instance.xCol}`,
      subtitle: `ملف البيانات: ${dataset.name} • طريقة التجميع: ${AGG_MODE_LABELS_AR[instance.aggMode]}`,
      chartImageDataUrl: dataUrl,
      summaryPairs: [
        { name: 'اسم الملف', value: dataset.name },
        { name: 'نوع المخطط', value: CHART_TYPE_LABELS_AR[instance.chartType] },
        { name: 'المحور الأفقي (X)', value: instance.xCol },
        { name: 'المحور الرأسي (Y)', value: instance.yCol },
        { name: 'عدد السجلات', value: String(dataset.rowsCount) },
      ],
    });
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <PageToolbar
        instance={instance}
        datasetName={dataset.name}
        onRefresh={onRefresh}
        onPrint={handlePrintChart}
        printLabel="🖨️ طباعة المخطط"
        onSave={() =>
          onRequestSave(
            `${CHART_TYPE_LABELS_AR[instance.chartType]}: ${instance.yCol} حسب ${instance.xCol} من ملف ${dataset.name}`
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

      {/* Clean Unified Controls Bar with Single Dropdown (No Repeated Chart Grids) */}
      <div className="bg-emeraldos-900/90 border border-platgold-500/30 rounded-2xl p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-[10px] font-bold text-platgold-300 mb-1">📂 مصدر البيانات:</label>
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
          <label className="block text-[10px] font-bold text-platgold-300 mb-1">1. محور X:</label>
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
          <label className="block text-[10px] font-bold text-platgold-300 mb-1">2. محور Y:</label>
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

        <div>
          <label className="block text-[10px] font-bold text-platgold-300 mb-1">التجميع (Aggregation):</label>
          <select
            value={instance.aggMode}
            onChange={(e) => onUpdateConfig(instance.instanceId, { aggMode: e.target.value as AggMode })}
            className="w-full bg-emeraldos-950 text-white font-bold text-xs rounded-xl p-2.5 border border-platgold-500/30"
          >
            <option value="sum">المجموع</option>
            <option value="avg">المتوسط</option>
            <option value="count">العدد</option>
            <option value="max">أعلى قيمة</option>
            <option value="min">أدنى قيمة</option>
          </select>
        </div>

        <div>
          <label htmlFor={`${instance.instanceId}_chartSelect`} className="block text-[10px] font-bold text-platgold-300 mb-1">
            📊 نوع المخطط ▼
          </label>
          <select
            id={`${instance.instanceId}_chartSelect`}
            value={instance.chartType}
            onChange={(e) => handleChartTypeChange(e.target.value as ChartType)}
            className="w-full bg-emeraldos-950 text-platgold-200 font-black text-xs rounded-xl p-2.5 border border-platgold-400/60 shadow"
          >
            {CHART_TYPES.map((ct) => (
              <option key={ct} value={ct}>
                {CHART_TYPE_LABELS_AR[ct]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Extra Large Chart Viewport */}
      <div className="bg-emeraldos-900/90 rounded-2xl p-4 border border-platgold-500/30 flex-1 flex flex-col min-h-[450px]">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-white/15">
          <h3 className="text-sm font-black text-platgold-300">
            📈 عرض {CHART_TYPE_LABELS_AR[instance.chartType]}: {instance.yCol} حسب {instance.xCol}
          </h3>
          <span className="text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-400/30 font-bold">
            📂 {dataset.name} ({dataset.rowsCount} صف)
          </span>
        </div>

        <div className="chart-surface-light p-4 flex-1 flex items-center justify-center">
          <ChartRenderer
            ref={chartRef}
            dataset={dataset}
            xCol={instance.xCol}
            yCol={instance.yCol}
            chartType={instance.chartType}
            aggMode={instance.aggMode}
            heightClass="h-[400px]"
          />
        </div>
      </div>
    </div>
  );
};
