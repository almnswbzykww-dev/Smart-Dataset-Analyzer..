import React, { useMemo, useState } from 'react';
import type { OfflineDataset, OfflineDatasetRow, OfflinePageInstance, OfflinePrintPayload } from '../offline.types';
import { exportOfflineDatasetCSV } from '../offlineDataEngine';
import { OfflineToolbar } from '../components/OfflineToolbar';

interface OfflineExplorerPageProps {
  instance: OfflinePageInstance;
  dataset: OfflineDataset;
  datasets: Record<string, OfflineDataset>;
  onChangeDataset: (instanceId: string, datasetKey: string) => void;
  onUpdateConfig: (instanceId: string, patch: Partial<OfflinePageInstance>) => void;
  onRefresh: (instanceId: string) => void;
  onRequestSave: (summaryText: string) => void;
  onRequestPrint: (payload: OfflinePrintPayload) => void;
  onCloseToHome: (instanceId: string) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const OfflineExplorerPage: React.FC<OfflineExplorerPageProps> = ({
  instance,
  dataset,
  datasets,
  onChangeDataset,
  onUpdateConfig,
  onRefresh,
  onRequestSave,
  onRequestPrint,
  onCloseToHome,
  onToast,
}) => {
  const [selectedRow, setSelectedRow] = useState<OfflineDatasetRow | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;

  const firstCat = dataset.catCols[0];
  const uniques = useMemo(() => {
    if (!firstCat) return [];
    const seen = new Set<string>();
    for (let i = 0; i < dataset.rows.length; i++) {
      seen.add(String(dataset.rows[i]?.[firstCat] ?? ''));
      if (seen.size >= 200) break;
    }
    return Array.from(seen);
  }, [dataset.rows, firstCat]);

  const filteredRows = useMemo(() => {
    const q = (instance.search || '').trim().toLowerCase();
    const cat = instance.catFilter || 'ALL';
    if (cat === 'ALL' && !q) return dataset.rows;
    return dataset.rows.filter((r) => {
      const matchCat = cat === 'ALL' || (firstCat && String(r[firstCat] ?? '') === cat);
      const matchSearch = !q || Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [dataset.rows, firstCat, instance.catFilter, instance.search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, safePage]);

  const handlePrintData = () => {
    onRequestPrint({
      kind: 'data',
      title: `جدول بيانات: ${dataset.name}`,
      subtitle: `عدد السجلات المعروضة: ${filteredRows.length} من أصل ${dataset.rows.length}`,
      tableHeaders: dataset.columns,
      tableRows: filteredRows.slice(0, 200).map((r) => dataset.columns.map((c) => r[c] ?? '')),
      notes:
        filteredRows.length > 200
          ? 'تم عرض أول 200 سجل في نسخة الطباعة للحفاظ على سرعة المعالجة.'
          : undefined,
    });
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <OfflineToolbar
        instance={instance}
        datasetName={dataset.name}
        onRefresh={onRefresh}
        onPrint={handlePrintData}
        printLabel="🖨️ طباعة البيانات"
        onSave={() =>
          onRequestSave(
            `مستعرض البيانات (${dataset.name}): ${filteredRows.length} سجل مطابق للتصفية من أصل ${dataset.rows.length}`
          )
        }
        onCloseToHome={onCloseToHome}
        extraControls={
          <>
            <select
              value={instance.datasetKey}
              onChange={(e) => onChangeDataset(instance.instanceId, e.target.value)}
              className="bg-emeraldos-900 text-white font-bold text-xs rounded-xl px-3 py-1.5 border border-platgold-500/30"
            >
              {Object.values(datasets).map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                exportOfflineDatasetCSV(
                  { ...dataset, rows: filteredRows },
                  `Offline_Filtered_${dataset.name.split('.')[0]}.csv`
                );
                onToast('تم تصدير البيانات المصفاة محلياً (CSV)!');
              }}
              className="bg-emeraldos-900 hover:bg-emeraldos-800 text-sky-300 border border-sky-400/30 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition"
            >
              📥 تصدير CSV
            </button>
          </>
        }
      />

      <div className="bg-emeraldos-900/90 rounded-2xl p-4 border border-platgold-500/30 flex-1 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-white/15">
          <h3 className="text-sm font-black text-white">
            🗂️ معاينة سجلات: <span className="text-platgold-300">{dataset.name}</span> (انقر على أي صف لعرض التفاصيل)
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {firstCat && (
              <select
                value={instance.catFilter}
                onChange={(e) => onUpdateConfig(instance.instanceId, { catFilter: e.target.value })}
                className="bg-emeraldos-950 text-white text-xs rounded-xl px-3 py-1.5 border border-platgold-500/30"
              >
                <option value="ALL">جميع السجلات ({dataset.rows.length})</option>
                {uniques.map((u) => (
                  <option key={u} value={u}>
                    {firstCat}: {u}
                  </option>
                ))}
              </select>
            )}
            <input
              type="text"
              value={instance.search}
              onChange={(e) => onUpdateConfig(instance.instanceId, { search: e.target.value })}
              placeholder="🔍 بحث في السجلات..."
              className="bg-emeraldos-950 text-white text-xs rounded-xl px-3 py-1.5 border border-platgold-500/30 w-56"
            />
          </div>
        </div>

        <div className="overflow-auto rounded-xl border border-white/10 flex-1 max-h-[540px]">
          <table className="w-full text-right border-collapse text-xs">
            <thead className="bg-emeraldos-950 text-platgold-300 sticky top-0 border-b border-platgold-500/30">
              <tr>
                {dataset.columns.map((c) => (
                  <th key={c} className="py-2.5 px-3 font-black whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-emeraldos-950/60">
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={dataset.columns.length} className="py-8 text-center text-slate-400">
                    لا توجد نتائج مطابقة للبحث الحالي.
                  </td>
                </tr>
              ) : (
                pagedRows.map((row, idx) => (
                  <tr
                    key={idx}
                    onClick={() => setSelectedRow(row)}
                    className="hover:bg-emeraldos-800/80 cursor-pointer transition"
                  >
                    {dataset.columns.map((c) => (
                      <td key={c} className="py-2 px-3 whitespace-nowrap text-slate-100 tabular-nums">
                        {String(row[c] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredRows.length > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-2 border-t border-white/10 text-xs">
            <span className="text-slate-300 font-bold tabular-nums">
              عرض {((safePage - 1) * PAGE_SIZE + 1).toLocaleString('en-US')} –{' '}
              {Math.min(safePage * PAGE_SIZE, filteredRows.length).toLocaleString('en-US')} من أصل{' '}
              {filteredRows.length.toLocaleString('en-US')} سجل
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="bg-emeraldos-950 hover:bg-emeraldos-800 disabled:opacity-40 text-white px-3 py-1 rounded-lg border border-platgold-500/30 font-bold cursor-pointer"
              >
                السابق
              </button>
              <span className="px-2.5 py-1 font-black text-platgold-300 tabular-nums">
                صفحة {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="bg-emeraldos-950 hover:bg-emeraldos-800 disabled:opacity-40 text-white px-3 py-1 rounded-lg border border-platgold-500/30 font-bold cursor-pointer"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedRow && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedRow(null);
          }}
        >
          <div className="glass-panel-emerald rounded-2xl max-w-md w-full p-5 emerald-glow-border space-y-3">
            <div className="flex items-center justify-between border-b border-platgold-500/30 pb-2">
              <h3 className="text-xs font-black text-white">🪪 تفاصيل السجل المحدد</h3>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="text-slate-300 hover:text-white text-base cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1.5 text-xs max-h-80 overflow-y-auto">
              {Object.entries(selectedRow).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between bg-emeraldos-950 px-3 py-2 rounded-lg border border-white/10 gap-2"
                >
                  <span className="font-bold text-platgold-300">{k}:</span>
                  <span className="font-bold text-white tabular-nums">{String(v ?? '')}</span>
                </div>
              ))}
            </div>
            <div className="text-left pt-1">
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="platgold-gradient text-emeraldos-950 font-black text-xs px-4 py-1.5 rounded-lg cursor-pointer"
              >
                ✕ إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
