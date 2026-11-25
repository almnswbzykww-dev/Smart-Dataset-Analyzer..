import React, { useMemo, useRef, useState } from 'react';
import type { OfflineDataset, OfflineDatasetRow, OfflinePageInstance, OfflinePrintPayload } from '../offline.types';
import { exportOfflineDatasetCSV, formatOfflineNum } from '../offlineDataEngine';
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
  const [jumpCol, setJumpCol] = useState('');
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const thRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const PAGE_SIZE = 100;

  const featureCols = useMemo(() => dataset.columns.filter((c) => c !== '#'), [dataset.columns]);
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
    const cols = dataset.columns;
    return dataset.rows.filter((r) => {
      const matchCat = cat === 'ALL' || (firstCat && String(r[firstCat] ?? '') === cat);
      if (!matchCat) return false;
      if (!q) return true;
      for (let i = 0; i < cols.length; i++) {
        if (String(r[cols[i]] ?? '').toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [dataset.rows, dataset.columns, firstCat, instance.catFilter, instance.search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, safePage]);

  const handleJumpToColumn = (colName: string) => {
    setJumpCol(colName);
    const th = thRefs.current[colName];
    if (th && typeof th.scrollIntoView === 'function') {
      th.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  };

  const handlePrintData = () => {
    onRequestPrint({
      kind: 'data',
      title: `جدول بيانات: ${dataset.name}`,
      subtitle: `عدد السجلات المعروضة: ${formatOfflineNum(filteredRows.length, 0)} من أصل ${formatOfflineNum(dataset.rows.length, 0)} • عدد الأعمدة: ${featureCols.length}`,
      tableHeaders: dataset.columns,
      tableRows: filteredRows.slice(0, 200).map((r) => dataset.columns.map((c) => r[c] ?? '')),
      notes:
        filteredRows.length > 200
          ? 'تم عرض أول 200 سجل في نسخة الطباعة للحفاظ على سرعة المعالجة.'
          : undefined,
    });
  };

  return (
    <div className="flex flex-col gap-4 min-h-full w-full min-w-0">
      <OfflineToolbar
        instance={instance}
        datasetName={dataset.name}
        onRefresh={onRefresh}
        onPrint={handlePrintData}
        printLabel="🖨️ طباعة البيانات"
        onSave={() =>
          onRequestSave(
            `مستعرض البيانات (${dataset.name}): ${filteredRows.length} سجل مطابق للتصفية من أصل ${dataset.rows.length} و ${featureCols.length} عمود`
          )
        }
        onCloseToHome={onCloseToHome}
        extraControls={
          <>
            <select
              value={instance.datasetKey}
              onChange={(e) => {
                setPage(1);
                setJumpCol('');
                onChangeDataset(instance.instanceId, e.target.value);
              }}
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

      <div className="bg-emeraldos-900/95 rounded-2xl p-4 sm:p-5 border border-platgold-500/35 flex-1 flex flex-col min-w-0 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-white/15">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-sm sm:text-base font-black text-white">
              🗂️ مستعرض الأعمدة والسجلات الكامل: <span className="text-platgold-300">{dataset.name}</span>
            </h3>
            <span className="text-[11px] bg-emerald-500/20 text-emerald-200 border border-emerald-400/35 px-2.5 py-0.5 rounded-lg font-black tabular-nums">
              {featureCols.length} عمود معروض بدون اختصار × {formatOfflineNum(filteredRows.length, 0)} سجل
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {featureCols.length > 0 && (
              <select
                value={jumpCol}
                onChange={(e) => handleJumpToColumn(e.target.value)}
                aria-label="الانتقال السريع لعمود محدد"
                className="bg-emeraldos-950 text-platgold-200 font-bold text-xs rounded-xl px-3 py-1.5 border border-platgold-500/35 max-w-[230px]"
              >
                <option value="">🧭 الانتقال السريع لعمود ({featureCols.length} عمود)...</option>
                {featureCols.map((c, idx) => (
                  <option key={c} value={c}>
                    #{idx + 1} — {c}
                  </option>
                ))}
              </select>
            )}
            {firstCat && (
              <select
                value={instance.catFilter}
                onChange={(e) => {
                  setPage(1);
                  onUpdateConfig(instance.instanceId, { catFilter: e.target.value });
                }}
                className="bg-emeraldos-950 text-white text-xs rounded-xl px-3 py-1.5 border border-platgold-500/30"
              >
                <option value="ALL">جميع السجلات ({formatOfflineNum(dataset.rows.length, 0)})</option>
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
              onChange={(e) => {
                setPage(1);
                onUpdateConfig(instance.instanceId, { search: e.target.value });
              }}
              placeholder="🔍 بحث في جميع الأعمدة..."
              className="bg-emeraldos-950 text-white text-xs rounded-xl px-3 py-1.5 border border-platgold-500/30 w-56"
            />
          </div>
        </div>

        <div
          ref={tableScrollRef}
          className="overflow-auto rounded-2xl border border-platgold-500/30 flex-1 min-h-[62vh] max-h-[76vh] w-full shadow-inner bg-emeraldos-950/50"
        >
          <table className="w-max min-w-full text-right border-collapse text-xs sm:text-sm">
            <thead className="bg-emeraldos-950 text-platgold-300 sticky top-0 z-20 border-b border-platgold-500/40 shadow-sm">
              <tr>
                {dataset.columns.map((c, colIdx) => {
                  const isIndex = c === '#';
                  const isHighlighted = jumpCol === c;
                  return (
                    <th
                      key={c}
                      ref={(el) => {
                        thRefs.current[c] = el;
                      }}
                      className={`py-3 px-4 font-black whitespace-nowrap border-l border-white/10 ${
                        isIndex
                          ? 'sticky right-0 z-30 bg-emeraldos-950 min-w-[70px] text-platgold-400'
                          : isHighlighted
                            ? 'bg-amber-900/80 text-white min-w-[140px]'
                            : 'min-w-[135px]'
                      }`}
                    >
                      {isIndex ? '#' : `${colIdx}. ${c}`}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-emeraldos-950/65">
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={dataset.columns.length} className="py-12 text-center text-slate-400">
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
                    {dataset.columns.map((c) => {
                      const isIndex = c === '#';
                      const isHighlighted = jumpCol === c;
                      return (
                        <td
                          key={c}
                          title={String(row[c] ?? '')}
                          className={`py-2.5 px-4 whitespace-nowrap text-slate-100 tabular-nums border-l border-white/5 ${
                            isIndex
                              ? 'sticky right-0 z-10 bg-emeraldos-950/95 font-black text-platgold-400 min-w-[70px]'
                              : isHighlighted
                                ? 'bg-amber-950/40 min-w-[140px] max-w-[320px] truncate'
                                : 'min-w-[135px] max-w-[320px] truncate'
                          }`}
                        >
                          {row[c] === '' ? <span className="text-slate-500">—</span> : String(row[c] ?? '')}
                        </td>
                      );
                    })}
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
              {filteredRows.length.toLocaleString('en-US')} سجل ({featureCols.length} عمود)
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
          <div className="glass-panel-emerald rounded-2xl max-w-6xl w-full p-5 sm:p-6 emerald-glow-border space-y-4">
            <div className="flex items-center justify-between border-b border-platgold-500/30 pb-2.5">
              <h3 className="text-sm font-black text-white">
                🪪 تفاصيل السجل المحدد بالكامل ({Object.keys(selectedRow).length} حقل)
              </h3>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="text-slate-300 hover:text-white text-base cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs max-h-[72vh] overflow-y-auto pr-1">
              {Object.entries(selectedRow).map(([k, v]) => (
                <div
                  key={k}
                  className="flex flex-col justify-between bg-emeraldos-950 px-3 py-2.5 rounded-lg border border-white/10 gap-1"
                >
                  <span className="font-bold text-platgold-300 truncate" title={k}>
                    {k}
                  </span>
                  <span className="font-bold text-white tabular-nums break-words">{String(v ?? '') || '—'}</span>
                </div>
              ))}
            </div>
            <div className="text-left pt-1">
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="platgold-gradient text-emeraldos-950 font-black text-xs px-5 py-2 rounded-lg cursor-pointer"
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
