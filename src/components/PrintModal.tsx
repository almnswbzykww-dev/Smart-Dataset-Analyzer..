import React, { useEffect, useMemo, useState } from 'react';
import type { CompanySettings, PrintPayload } from '../types/app';
import { downloadBlobFile } from '../utils/csvParser';
import {
  buildPrintableVoucherHtml,
  generateVoucherNumber,
  triggerIframePrint,
} from '../utils/printVoucher';

interface PrintModalProps {
  payload: PrintPayload | null;
  company: CompanySettings;
  onClose: () => void;
  editionLabel?: string;
}

export const PrintModal: React.FC<PrintModalProps> = ({
  payload,
  company,
  onClose,
  editionLabel = 'Dataset Analyzer Online — النسخة السحابية المتصلة بـ Firebase',
}) => {
  const [printStatus, setPrintStatus] = useState<string>('');
  const [browserBlobUrl, setBrowserBlobUrl] = useState<string>('');

  const voucherNo = useMemo(() => {
    if (!payload) return '';
    return generateVoucherNumber('BF-ON');
  }, [payload]);

  const printDate = useMemo(() => {
    if (!payload) return '';
    return new Date().toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [payload]);

  const voucherHtmlForPrint = useMemo(() => {
    if (!payload) return '';
    return buildPrintableVoucherHtml({
      payload,
      company,
      voucherNo,
      editionLabel,
      printDate,
      autoPrintScript: false,
    });
  }, [payload, company, voucherNo, editionLabel, printDate]);

  const voucherHtmlForBrowser = useMemo(() => {
    if (!payload) return '';
    return buildPrintableVoucherHtml({
      payload,
      company,
      voucherNo,
      editionLabel,
      printDate,
      autoPrintScript: true,
    });
  }, [payload, company, voucherNo, editionLabel, printDate]);

  useEffect(() => {
    if (!voucherHtmlForBrowser) {
      setBrowserBlobUrl('');
      return;
    }
    const blob = new Blob(['\uFEFF' + voucherHtmlForBrowser], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    setBrowserBlobUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [voucherHtmlForBrowser]);

  useEffect(() => {
    setPrintStatus('');
  }, [payload]);

  if (!payload) return null;

  const hasCompanyHeader = Boolean(
    company.companyName.trim() || company.location.trim() || company.address.trim() || company.logoDataUrl
  );

  const handleTriggerPrint = () => {
    const ok = triggerIframePrint(voucherHtmlForPrint);
    setPrintStatus(
      ok
        ? `تم إرسال سند الطباعة (${voucherNo}) إلى نافذة الطباعة في المتصفح.`
        : 'تعذر فتح نافذة الطباعة التلقائية — استخدم زر "فتح السند في المتصفح".'
    );
  };

  const handleDownloadPrintableHtml = () => {
    downloadBlobFile('\uFEFF' + voucherHtmlForPrint, `Voucher_${voucherNo}.html`, 'text/html;charset=utf-8;');
    setPrintStatus(`تم حفظ ملف سند الطباعة (${voucherNo}.html) بنجاح.`);
  };

  return (
    <div
      id="printPreviewBackdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="printPreviewCard"
        className="bg-white text-slate-900 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Modal Toolbar (Hidden when printing) */}
        <div className="no-print bg-emeraldos-950 text-white px-5 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-platgold-500/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">🖨️</span>
            <div>
              <h3 className="text-sm font-black">معاينة سند الطباعة الرسمي</h3>
              <p className="text-[11px] text-platgold-300 font-bold" dir="ltr">
                {voucherNo}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTriggerPrint}
              className="platgold-gradient text-emeraldos-950 px-4 py-1.5 rounded-xl text-xs font-black cursor-pointer"
            >
              🖨️ طباعة السند الآن
            </button>

            {browserBlobUrl && (
              <a
                href={browserBlobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-sky-700 hover:bg-sky-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-black inline-flex items-center gap-1"
              >
                🌐 فتح السند في المتصفح
              </a>
            )}

            <button
              type="button"
              onClick={handleDownloadPrintableHtml}
              className="bg-emeraldos-800 hover:bg-emeraldos-700 text-white border border-platgold-500/30 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
            >
              📥 حفظ السند (HTML)
            </button>

            <button
              type="button"
              onClick={onClose}
              className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
            >
              ✕ إغلاق
            </button>
          </div>
        </div>

        {printStatus && (
          <div className="no-print bg-emerald-50 border-b border-emerald-200 text-emerald-900 px-5 py-2 text-xs font-bold flex items-center justify-between gap-2">
            <span>✅ {printStatus}</span>
            {browserBlobUrl && (
              <a
                href={browserBlobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-700 underline font-black shrink-0"
              >
                عرض السند في تبويب مستقل ↗
              </a>
            )}
          </div>
        )}

        {/* Printable Sheet Content */}
        <div id="printableSheet" className="p-6 sm:p-8 overflow-y-auto space-y-5 bg-white text-slate-900">
          {/* Official Voucher Top Banner */}
          <div className="bg-emerald-950 text-white rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm sm:text-base font-black text-amber-300">
                💎 سند طباعة رسمي — تطبيق بن فيصل لتحليل البيانات الذكي
              </p>
              <p className="text-[11px] text-emerald-200 font-bold mt-0.5">{editionLabel}</p>
            </div>
            <div className="text-left text-[11px] font-bold text-slate-200 space-y-0.5">
              <p>
                رقم السند:{' '}
                <span className="font-mono text-amber-300" dir="ltr">
                  {voucherNo}
                </span>
              </p>
              <p>تاريخ الإصدار: {printDate}</p>
            </div>
          </div>

          {/* Dynamic Company Header */}
          {hasCompanyHeader && (
            <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-emerald-700 pb-4">
              <div className="space-y-1">
                {company.companyName && (
                  <h1 className="text-xl font-black text-slate-900">{company.companyName}</h1>
                )}
                {company.location && (
                  <p className="text-xs font-bold text-slate-700">📍 الموقع: {company.location}</p>
                )}
                {company.address && (
                  <p className="text-xs font-medium text-slate-600">🏢 العنوان: {company.address}</p>
                )}
              </div>
              {company.logoDataUrl && (
                <div className="shrink-0">
                  <img
                    src={company.logoDataUrl}
                    alt={company.companyName || 'شعار الشركة'}
                    className="max-h-20 max-w-[180px] object-contain rounded-lg border border-slate-200 p-1 bg-white"
                  />
                </div>
              )}
            </div>
          )}

          {/* Document Title Banner */}
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-lg font-black text-emerald-950">{payload.title}</h2>
            {payload.subtitle && <p className="text-xs font-bold text-slate-500 mt-0.5">{payload.subtitle}</p>}
          </div>

          {/* Summary Pairs Table */}
          {payload.summaryPairs && payload.summaryPairs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800">
                    <th className="border border-slate-300 py-2 px-3 font-black w-1/2">البند</th>
                    <th className="border border-slate-300 py-2 px-3 font-black w-1/2">القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.summaryPairs.map((pair, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="border border-slate-300 py-2 px-3 font-bold text-slate-800">{pair.name}</td>
                      <td className="border border-slate-300 py-2 px-3 font-bold text-emerald-900 tabular-nums">
                        {pair.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Chart Image */}
          {payload.chartImageDataUrl && (
            <div className="border border-slate-200 rounded-xl p-3 bg-white flex justify-center">
              <img
                src={payload.chartImageDataUrl}
                alt={payload.title}
                className="max-w-full max-h-[460px] object-contain"
              />
            </div>
          )}

          {/* Data Table */}
          {payload.tableHeaders && payload.tableRows && payload.tableRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs border border-slate-300">
                <thead>
                  <tr className="bg-emerald-800 text-white">
                    {payload.tableHeaders.map((h, i) => (
                      <th key={i} className="border border-emerald-700 py-2 px-2.5 font-black whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payload.tableRows.map((row, rIdx) => (
                    <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className="border border-slate-300 py-1.5 px-2.5 text-slate-800 tabular-nums"
                        >
                          {String(cell ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {payload.notes && (
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
              📝 ملاحظات: {payload.notes}
            </p>
          )}

          {/* Official Signature Footer */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t-2 border-dashed border-slate-300 pt-4 text-center text-[11px] text-slate-600">
            <div className="border border-slate-200 rounded-lg p-3">
              <strong className="text-slate-800">إعداد / المحلل</strong>
              <div className="mt-4 text-slate-400">........................</div>
            </div>
            <div className="border border-slate-200 rounded-lg p-3">
              <strong className="text-slate-800">الاعتماد والمراجعة</strong>
              <div className="mt-4 text-slate-400">........................</div>
            </div>
            <div className="border border-slate-200 rounded-lg p-3">
              <strong className="text-slate-800">الختم الرسمي</strong>
              <div className="mt-4 text-slate-400">........................</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
