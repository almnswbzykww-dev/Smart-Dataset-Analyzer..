import type { CompanySettings, PrintPayload } from '../types/app';

function escapeHtml(raw: unknown): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeImageDataUrl(url?: string): boolean {
  if (!url) return false;
  return /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(url.trim());
}

export function generateVoucherNumber(prefix = 'BF'): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const tail = String(now.getTime()).slice(-5);
  return `${prefix}-${y}${m}${d}-${tail}`;
}

export function buildPrintableVoucherHtml(params: {
  payload: PrintPayload;
  company: CompanySettings;
  voucherNo: string;
  editionLabel: string;
  printDate: string;
  autoPrintScript?: boolean;
}): string {
  const { payload, company, voucherNo, editionLabel, printDate, autoPrintScript = false } = params;

  const hasCompanyHeader = Boolean(
    company.companyName.trim() || company.location.trim() || company.address.trim() || company.logoDataUrl
  );

  const safeLogo = isSafeImageDataUrl(company.logoDataUrl) ? company.logoDataUrl.trim() : '';
  const safeChartImg = isSafeImageDataUrl(payload.chartImageDataUrl)
    ? payload.chartImageDataUrl!.trim()
    : '';

  const companyBlock = hasCompanyHeader
    ? `
      <div class="company-header">
        ${safeLogo ? `<img src="${safeLogo}" alt="شعار الشركة" class="company-logo" />` : ''}
        <div class="company-info">
          ${company.companyName ? `<h1>${escapeHtml(company.companyName)}</h1>` : ''}
          ${company.location ? `<p>📍 الموقع: ${escapeHtml(company.location)}</p>` : ''}
          ${company.address ? `<p>🏢 العنوان: ${escapeHtml(company.address)}</p>` : ''}
        </div>
      </div>`
    : '';

  const pairsHtml =
    payload.summaryPairs && payload.summaryPairs.length > 0
      ? `
      <section class="section">
        <div class="section-title">📋 ملخص مؤشرات السند</div>
        <table class="summary-table">
          <thead>
            <tr>
              <th>البند</th>
              <th>القيمة</th>
            </tr>
          </thead>
          <tbody>
            ${payload.summaryPairs
              .map(
                (p) =>
                  `<tr><td class="label-cell">${escapeHtml(p.name)}</td><td class="val-cell">${escapeHtml(p.value)}</td></tr>`
              )
              .join('')}
          </tbody>
        </table>
      </section>`
      : '';

  const chartHtml = safeChartImg
    ? `
      <section class="section">
        <div class="section-title">📊 المخطط البياني المرفق</div>
        <div class="chart-box">
          <img src="${safeChartImg}" alt="${escapeHtml(payload.title)}" />
        </div>
      </section>`
    : '';

  const tableHtml =
    payload.tableHeaders && payload.tableRows && payload.tableRows.length > 0
      ? `
      <section class="section">
        <div class="section-title">📑 جدول البيانات والنتائج التفصيلية</div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                ${payload.tableHeaders.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${payload.tableRows
                .map(
                  (row) =>
                    `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>`
      : '';

  const notesHtml = payload.notes
    ? `<div class="notes-box">📝 ملاحظات: ${escapeHtml(payload.notes)}</div>`
    : '';

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>سند طباعة ${escapeHtml(voucherNo)} — ${escapeHtml(payload.title)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Cairo", "Segoe UI", Tahoma, Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background: #ffffff;
      color: #0f172a;
      direction: rtl;
    }
    .voucher-frame {
      max-width: 900px;
      margin: 0 auto;
      border: 2px solid #0f766e;
      border-radius: 12px;
      padding: 22px;
      background: #ffffff;
    }
    .voucher-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      background: #042f2e;
      color: #ffffff;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .voucher-badge {
      font-size: 16px;
      font-weight: 900;
      color: #efdb8a;
    }
    .voucher-meta {
      text-align: left;
      font-size: 11px;
      line-height: 1.6;
      color: #e2e8f0;
    }
    .company-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 10px;
      border-bottom: 2px solid #0f766e;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .company-info { text-align: center; }
    .company-header h1 { margin: 0; font-size: 20px; color: #0f172a; }
    .company-header p { margin: 4px 0 0; font-size: 12px; color: #334155; font-weight: 600; }
    .company-logo {
      display: block;
      margin: 0 auto;
      max-height: 92px;
      max-width: 220px;
      object-fit: contain;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 5px;
      background: #ffffff;
    }
    .doc-title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 10px;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 10px;
      margin-bottom: 16px;
    }
    .doc-title-row h2 { margin: 0; font-size: 18px; color: #064e3b; }
    .doc-title-row .subtitle { margin: 4px 0 0; font-size: 12px; color: #475569; font-weight: 600; }
    .section { margin-bottom: 16px; page-break-inside: avoid; }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      color: #064e3b;
      margin-bottom: 8px;
    }
    .table-wrap { width: 100%; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .data-table { width: max-content; min-width: 100%; }
    .summary-table th, .summary-table td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      text-align: right;
    }
    .summary-table th { background: #f1f5f9; color: #0f172a; font-weight: 800; width: 50%; }
    .summary-table .label-cell { font-weight: 700; color: #1e293b; }
    .summary-table .val-cell { font-weight: 800; color: #065f46; }
    .chart-box {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px;
      text-align: center;
      background: #ffffff;
    }
    .chart-box img { max-width: 100%; max-height: 400px; object-fit: contain; }
    .data-table th {
      background: #0f766e;
      color: #ffffff;
      border: 1px solid #0d9488;
      padding: 7px 8px;
      text-align: right;
      font-weight: 800;
    }
    .data-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: right;
      color: #1e293b;
    }
    .data-table tbody tr:nth-child(even) { background: #f8fafc; }
    .notes-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 12px;
      color: #334155;
      margin-bottom: 16px;
    }
    .voucher-footer {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      border-top: 2px dashed #94a3b8;
      padding-top: 14px;
      margin-top: 18px;
      font-size: 11px;
      color: #475569;
      text-align: center;
    }
    .sig-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
      min-height: 54px;
    }
    .toolbar-browser {
      max-width: 900px;
      margin: 0 auto 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 10px 14px;
      border-radius: 10px;
    }
    .btn-print {
      background: #0f766e;
      color: #ffffff;
      border: none;
      padding: 8px 18px;
      border-radius: 8px;
      font-weight: 800;
      font-size: 13px;
      cursor: pointer;
    }
    @media print {
      body { padding: 0; }
      .toolbar-browser { display: none !important; }
      .voucher-frame { border: 1px solid #0f766e; }
    }
  </style>
</head>
<body>
  ${
    autoPrintScript
      ? `<div class="toolbar-browser">
          <strong style="font-size:13px;color:#064e3b;">🖨️ سند الطباعة الرسمي — جاهز للطباعة أو الحفظ PDF</strong>
          <button class="btn-print" onclick="window.print()">🖨️ طباعة السند</button>
        </div>`
      : ''
  }
  <div class="voucher-frame">
    <div class="voucher-top-bar">
      <div>
        <div class="voucher-badge">💎 سند طباعة رسمي — تطبيق بن فيصل لتحليل البيانات الذكي</div>
        <div style="font-size:11px;color:#99f6e4;margin-top:2px;">${escapeHtml(editionLabel)}</div>
      </div>
      <div class="voucher-meta">
        <div><strong>رقم السند:</strong> <span dir="ltr">${escapeHtml(voucherNo)}</span></div>
        <div><strong>تاريخ الإصدار:</strong> ${escapeHtml(printDate)}</div>
      </div>
    </div>

    ${companyBlock}

    <div class="doc-title-row">
      <div>
        <h2>${escapeHtml(payload.title)}</h2>
        ${payload.subtitle ? `<p class="subtitle">${escapeHtml(payload.subtitle)}</p>` : ''}
      </div>
    </div>

    ${pairsHtml}
    ${chartHtml}
    ${tableHtml}
    ${notesHtml}

    <div class="voucher-footer">
      <div class="sig-box"><strong>إعداد / المحلل</strong><div style="margin-top:16px;color:#94a3b8;">........................</div></div>
      <div class="sig-box"><strong>الاعتماد والمراجعة</strong><div style="margin-top:16px;color:#94a3b8;">........................</div></div>
      <div class="sig-box"><strong>الختم الرسمي</strong><div style="margin-top:16px;color:#94a3b8;">........................</div></div>
    </div>
  </div>
  ${
    autoPrintScript
      ? `<script>window.addEventListener('load',function(){setTimeout(function(){try{window.print();}catch(e){}},250);});</script>`
      : ''
  }
</body>
</html>`;
}

export function triggerIframePrint(html: string): boolean {
  try {
    const existing = document.getElementById('bf-print-voucher-frame');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'bf-print-voucher-frame';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';

    const cleanup = () => {
      window.setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1500);
    };

    iframe.onload = () => {
      window.setTimeout(() => {
        try {
          const win = iframe.contentWindow;
          if (!win) {
            window.print();
            cleanup();
            return;
          }
          win.focus();
          win.print();
          cleanup();
        } catch {
          window.print();
          cleanup();
        }
      }, 160);
    };

    iframe.srcdoc = html;
    document.body.appendChild(iframe);
    return true;
  } catch {
    try {
      window.print();
      return true;
    } catch {
      return false;
    }
  }
}
