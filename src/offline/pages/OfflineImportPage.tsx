import React, { useRef, useState } from 'react';
import type { OfflineDataset, OfflinePageInstance, OfflinePageType } from '../offline.types';
import {
  exportOfflineDatasetCSV,
  formatOfflineNum,
  inspectAndParseOfflineDatasetFile,
  parseOfflineDatasetFromBuffer,
  type OfflineFilePreviewInspectResult,
} from '../offlineDataEngine';
import { formatBytesAr } from '../../utils/smartDataEngine';
import { OfflineToolbar } from '../components/OfflineToolbar';

interface OfflineImportPageProps {
  instance: OfflinePageInstance;
  activeDatasetKey: string;
  datasets: Record<string, OfflineDataset>;
  onSelectGlobalDataset: (datasetKey: string, instanceId: string) => void;
  onAddCustomDataset: (ds: OfflineDataset, instanceId: string) => Promise<void> | void;
  onRemoveCustomDataset: (ds: OfflineDataset) => void;
  onOpenFeature: (type: OfflinePageType) => void;
  onRefresh: (instanceId: string) => void;
  onRequestSave: (summaryText: string) => void;
  onCloseToHome: (instanceId: string) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const OfflineImportPage: React.FC<OfflineImportPageProps> = ({
  instance,
  activeDatasetKey,
  datasets,
  onSelectGlobalDataset,
  onAddCustomDataset,
  onRemoveCustomDataset,
  onOpenFeature,
  onRefresh,
  onRequestSave,
  onCloseToHome,
  onToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parsingBusy, setParsingBusy] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [pendingPreview, setPendingPreview] = useState<OfflineFilePreviewInspectResult | null>(null);

  const activeDs = datasets[activeDatasetKey] || Object.values(datasets)[0];

  const handleFile = async (file: File) => {
    setParsingBusy(true);
    setParseError(null);
    try {
      const inspected = await inspectAndParseOfflineDatasetFile(file);
      setPendingPreview(inspected);
      onToast(
        `تمت قراءة "${file.name}" محلياً (${formatOfflineNum(inspected.dataset.rowsCount, 0)} صف × ${inspected.dataset.colsCount} عمود) — راجع المعاينة ثم اضغط اعتماد!`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر تحليل محتوى الملف.';
      setParseError(msg);
      setPendingPreview(null);
      onToast(msg, 'error');
    } finally {
      setParsingBusy(false);
    }
  };

  const handleSwitchExcelSheet = async (sheetName: string) => {
    if (!pendingPreview) return;
    setParsingBusy(true);
    setParseError(null);
    try {
      const updatedDataset = await parseOfflineDatasetFromBuffer(pendingPreview.fileName, pendingPreview.rawBuffer, {
        sheetName,
        fileSizeBytes: pendingPreview.fileSizeBytes,
      });
      setPendingPreview({
        ...pendingPreview,
        dataset: updatedDataset,
      });
      onToast(`تم تحميل ورقة العمل "${sheetName}" محلياً (${formatOfflineNum(updatedDataset.rowsCount, 0)} صف)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر قراءة ورقة العمل المحددة.';
      setParseError(msg);
      onToast(msg, 'error');
    } finally {
      setParsingBusy(false);
    }
  };

  const commitPendingPreview = async (targetFeature?: OfflinePageType) => {
    if (!pendingPreview) return;
    const ds = pendingPreview.dataset;
    await onAddCustomDataset(ds, instance.instanceId);
    setPendingPreview(null);
    onToast(
      `تم اعتماد وحفظ "${ds.label}" في قاعدة IndexedDB المحلية (${formatOfflineNum(ds.rowsCount, 0)} صف × ${ds.colsCount} عمود)!`
    );
    if (targetFeature) {
      onOpenFeature(targetFeature);
    }
  };

  const previewRows = pendingPreview ? pendingPreview.dataset.rows.slice(0, 15) : [];

  return (
    <div className="flex flex-col gap-4 min-h-full">
      <OfflineToolbar
        instance={instance}
        datasetName={activeDs.name}
        onRefresh={onRefresh}
        onSave={() =>
          onRequestSave(
            `قاعدة البيانات النشطة (${activeDs.name}): ${activeDs.rowsCount} سجل و ${activeDs.colsCount} عمود`
          )
        }
        onCloseToHome={onCloseToHome}
        extraControls={
          <button
            type="button"
            onClick={() => {
              exportOfflineDatasetCSV(activeDs);
              onToast('تم تصدير ملف CSV محلياً بنجاح!');
            }}
            className="bg-emeraldos-900 hover:bg-emeraldos-800 text-sky-300 border border-sky-400/30 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition"
          >
            📥 تصدير الملف النشط
          </button>
        }
      />

      <div className="bg-emeraldos-900/90 rounded-2xl p-6 border border-platgold-500/30 space-y-5 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/15">
          <h3 className="text-sm font-black text-white">
            📂 استيراد وتحليل الملفات (Excel / CSV / PDF / JSON) في قاعدة IndexedDB المحلية
          </h3>
          <span className="text-xs text-emeraldos-300 font-bold">
            الملف النشط: <strong className="text-platgold-300">{activeDs.label}</strong>
          </span>
        </div>

        <div className="bg-emeraldos-950/85 border border-platgold-400/35 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-white">
              📂 البيانات المعروضة حالياً في النسخة المحلية: <span className="text-platgold-300">{activeDs.label}</span>
            </p>
            <p className="text-[11px] text-slate-300 mt-0.5 tabular-nums">
              {formatOfflineNum(activeDs.rowsCount, 0)} صف × {activeDs.colsCount} عمود
              {activeDs.fileSizeBytes ? ` • الحجم: ${formatBytesAr(activeDs.fileSizeBytes)}` : ''}
              {activeDs.sourceFormat ? ` • المصدر: ${activeDs.sourceFormat}` : ''}
              {' '}— متزامنة تلقائياً في الرسوم البيانية والتحليل الإحصائي
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenFeature('studio')}
              className="platgold-gradient text-emeraldos-950 px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition"
            >
              📈 عرض في الرسوم البيانية
            </button>
            <button
              type="button"
              onClick={() => onOpenFeature('stats')}
              className="bg-emeraldos-800 hover:bg-emeraldos-700 text-emerald-200 border border-emerald-400/30 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition"
            >
              🧮 عرض في التحليل الإحصائي
            </button>
            <button
              type="button"
              onClick={() => onOpenFeature('dashboard')}
              className="bg-emeraldos-800 hover:bg-emeraldos-700 text-sky-200 border border-sky-400/30 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition"
            >
              📊 عرض في لوحة القيادة
            </button>
          </div>
        </div>

        <div
          onClick={() => !parsingBusy && fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (parsingBusy) return;
            const file = e.dataTransfer?.files?.[0];
            if (file) void handleFile(file);
          }}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition ${
            parsingBusy
              ? 'border-sky-400/60 bg-emeraldos-950/90 cursor-wait opacity-90'
              : dragging
                ? 'border-platgold-300 bg-emeraldos-800/80 cursor-pointer'
                : 'border-platgold-500/40 hover:border-platgold-400 bg-emeraldos-950/80 cursor-pointer'
          }`}
        >
          <div className="w-16 h-16 rounded-full platgold-gradient text-emeraldos-950 flex items-center justify-center text-3xl mx-auto mb-3 shadow-lg">
            {parsingBusy ? '⏳' : '📂'}
          </div>
          <h4 className="text-sm font-black text-white mb-1">
            {parsingBusy
              ? 'جاري قراءة الملف محلياً واكتشاف الأعمدة وتنظيف القيم وإعداد المعاينة...'
              : 'اضغط هنا لاختيار ملف (Excel أو CSV أو PDF أو JSON) أو اسحبه وأفلته هنا'}
          </h4>
          <p className="text-xs text-slate-300 mb-3">
            يعمل بدون إنترنت بالكامل: يدعم أوراق Excel المتعددة، فواصل وترميزات CSV، جداول PDF، والملفات الضخمة دون تجمّد
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-black">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-200 border border-emerald-400/35">
              📊 Excel (.xlsx / .xls / .ods)
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-200 border border-sky-400/35">
              📄 CSV / TSV / TXT
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-200 border border-rose-400/35">
              📑 PDF (.pdf)
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-400/35">
              🗂️ JSON (.json)
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.xlsm,.xlsb,.ods,.csv,.tsv,.txt,.pdf,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = '';
            }}
          />
        </div>

        {/* Clear Invalid-File Error Alert */}
        {parseError && (
          <div className="bg-rose-950/90 border border-rose-400/60 rounded-2xl p-4 flex items-start justify-between gap-3 text-rose-100">
            <div className="flex items-start gap-2.5">
              <span className="text-xl shrink-0">⚠️</span>
              <div>
                <p className="text-xs font-black text-rose-200">تعذر استيراد الملف المحدد</p>
                <p className="text-xs font-bold mt-1">{parseError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setParseError(null)}
              className="text-xs text-rose-300 hover:text-white px-2 py-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* ==================== PRE-ANALYSIS DATA PREVIEW PANEL ==================== */}
        {pendingPreview && (
          <div className="bg-emeraldos-950/95 border-2 border-platgold-400/70 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-3">
              <div>
                <span className="text-[10px] font-black text-emeraldos-950 bg-platgold-300 px-2.5 py-0.5 rounded-md">
                  معاينة البيانات قبل التحليل المحلي
                </span>
                <h4 className="text-sm font-black text-white mt-1.5">
                  📄 {pendingPreview.fileName}
                  {pendingPreview.dataset.sheetName ? ` — ورقة: ${pendingPreview.dataset.sheetName}` : ''}
                </h4>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void commitPendingPreview()}
                  className="platgold-gradient text-emeraldos-950 px-4 py-2 rounded-xl text-xs font-black cursor-pointer transition shadow"
                >
                  ✅ اعتماد وحفظ في IndexedDB
                </button>
                <button
                  type="button"
                  onClick={() => void commitPendingPreview('studio')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer transition"
                >
                  📈 اعتماد وفتح الرسوم
                </button>
                <button
                  type="button"
                  onClick={() => void commitPendingPreview('dashboard')}
                  className="bg-sky-700 hover:bg-sky-600 text-white px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer transition"
                >
                  📊 اعتماد ولوحة القيادة
                </button>
                <button
                  type="button"
                  onClick={() => setPendingPreview(null)}
                  className="bg-rose-950 hover:bg-rose-800 text-rose-200 border border-rose-500/40 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition"
                >
                  ✕ إلغاء
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-emeraldos-900/90 border border-white/10 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400">عدد الصفوف (الأصلية محفوظة)</p>
                <p className="text-base font-black text-platgold-300 tabular-nums mt-0.5">
                  {formatOfflineNum(pendingPreview.dataset.rowsCount, 0)}
                </p>
              </div>
              <div className="bg-emeraldos-900/90 border border-white/10 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400">عدد الأعمدة</p>
                <p className="text-base font-black text-white tabular-nums mt-0.5">
                  {pendingPreview.dataset.colsCount - 1} عمود بيانات
                </p>
              </div>
              <div className="bg-emeraldos-900/90 border border-white/10 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400">حجم الملف</p>
                <p className="text-base font-black text-sky-300 tabular-nums mt-0.5">
                  {formatBytesAr(pendingPreview.fileSizeBytes)}
                </p>
              </div>
              <div className="bg-emeraldos-900/90 border border-white/10 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400">مصدر / صيغة البيانات</p>
                <p className="text-base font-black text-emerald-300 mt-0.5">
                  {pendingPreview.sourceFormat}
                </p>
              </div>
            </div>

            {pendingPreview.excelInfo && pendingPreview.excelInfo.sheetNames.length > 0 && (
              <div className="bg-emeraldos-900/80 border border-emerald-400/35 rounded-xl p-3.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-black text-emerald-200">
                    📑 أوراق العمل المتاحة في ملف Excel ({pendingPreview.excelInfo.sheetNames.length} ورقة)
                  </p>
                  <select
                    value={pendingPreview.dataset.sheetName || pendingPreview.excelInfo.defaultSheetName}
                    disabled={parsingBusy}
                    onChange={(e) => void handleSwitchExcelSheet(e.target.value)}
                    className="bg-emeraldos-950 text-white font-bold text-xs rounded-lg px-3 py-1.5 border border-platgold-400/50"
                  >
                    {pendingPreview.excelInfo.sheetStats.map((st) => (
                      <option key={st.name} value={st.name}>
                        {st.name} ({formatOfflineNum(st.approxRows, 0)} صف × {st.approxCols} عمود)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {pendingPreview.dataset.cleaningSummary && (
                <div className="bg-emeraldos-900/70 border border-white/10 rounded-xl p-3.5 space-y-1.5 text-[11px]">
                  <p className="text-xs font-black text-emerald-300">🧹 تقرير التنظيف الذكي (بدون حذف البيانات الأصلية):</p>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-slate-200 font-bold tabular-nums">
                    <span>• خلايا فارغة/غير صالحة معالجة: {formatOfflineNum(pendingPreview.dataset.cleaningSummary.missingHandledCount, 0)}</span>
                    <span>• قيم رقمية مطبّعة: {formatOfflineNum(pendingPreview.dataset.cleaningSummary.numericNormalizedCount, 0)}</span>
                    <span>• تواريخ منسّقة: {formatOfflineNum(pendingPreview.dataset.cleaningSummary.datesNormalizedCount, 0)}</span>
                    <span>• صفوف متطابقة مرصودة (محفوظة): {formatOfflineNum(pendingPreview.dataset.cleaningSummary.duplicateRowsCount, 0)}</span>
                  </div>
                </div>
              )}

              <div className="bg-emeraldos-900/70 border border-white/10 rounded-xl p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-black text-platgold-300">
                    🔍 الأعمدة المكتشفة تلقائياً ({pendingPreview.dataset.colsCount - 1} عمود):
                  </p>
                  <span className="text-[11px] font-bold text-slate-300">عرض شامل يدعم حتى 100+ عمود محلياً</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 max-h-72 overflow-y-auto pr-1">
                  {pendingPreview.dataset.columns
                    .filter((c) => c !== '#')
                    .map((col, idx) => {
                      const kind = pendingPreview.dataset.columnTypes?.[col] || 'text';
                      const badge =
                        kind === 'numeric'
                          ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                          : kind === 'date'
                            ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                            : 'bg-sky-500/20 text-sky-200 border-sky-400/40';
                      const label = kind === 'numeric' ? 'رقمي' : kind === 'date' ? 'تاريخ' : 'نصي';
                      return (
                        <span
                          key={col}
                          title={`${col} (${label})`}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border truncate ${badge}`}
                        >
                          {idx + 1}. {col} ({label})
                        </span>
                      );
                    })}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-black text-slate-200">
                👁️ معاينة أول {previewRows.length} صف من أصل {formatOfflineNum(pendingPreview.dataset.rowsCount, 0)} ({pendingPreview.dataset.colsCount - 1} عمود):
              </p>
              <div className="overflow-auto rounded-xl border border-white/15 max-h-[460px] w-full">
                <table className="w-max min-w-full text-right border-collapse text-xs">
                  <thead className="bg-emeraldos-900 text-platgold-300 sticky top-0 z-10 border-b border-platgold-500/35">
                    <tr>
                      {pendingPreview.dataset.columns.map((c) => (
                        <th key={c} className="py-2.5 px-3.5 font-black whitespace-nowrap min-w-[120px] border-l border-white/10">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-emeraldos-950/80">
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-emeraldos-800/70">
                        {pendingPreview.dataset.columns.map((c) => (
                          <td key={c} className="py-2 px-3.5 whitespace-nowrap min-w-[120px] text-slate-200 tabular-nums border-l border-white/5">
                            {row[c] === '' ? <span className="text-slate-500">—</span> : String(row[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h4 className="text-xs font-black text-slate-200">قواعد البيانات المتاحة والمحفوظة محلياً:</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.values(datasets).map((item) => {
              const isActive = activeDatasetKey === item.id;
              return (
                <div
                  key={item.id}
                  className={`bg-emeraldos-950 border rounded-xl p-4 flex items-center justify-between gap-2 transition ${
                    isActive
                      ? 'border-platgold-400 ring-1 ring-platgold-400/50'
                      : 'border-platgold-500/30 hover:border-platgold-400'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectGlobalDataset(item.id, instance.instanceId)}
                    className="flex-1 text-right cursor-pointer min-w-0"
                  >
                    <p className="text-xs font-black text-platgold-300 truncate">{item.label}</p>
                    <p className="text-[11px] text-slate-400 mt-1 tabular-nums truncate">
                      {formatOfflineNum(item.rowsCount, 0)} سجل • {item.colsCount} أعمدة
                      {item.fileSizeBytes ? ` • ${formatBytesAr(item.fileSizeBytes)}` : ''}
                    </p>
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.isCustom && (
                      <button
                        type="button"
                        onClick={() => onRemoveCustomDataset(item)}
                        title="حذف الملف المستورد"
                        className="bg-rose-900/70 hover:bg-rose-700 text-rose-200 px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition"
                      >
                        🗑️ حذف
                      </button>
                    )}
                    <span className="text-lg">🗄️</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
