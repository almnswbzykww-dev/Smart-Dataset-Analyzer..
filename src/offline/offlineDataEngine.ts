import type { OfflineAggMode, OfflineDataset, OfflineDatasetRow } from './offline.types';
import {
  decodeTextBufferWithInfo,
  inspectExcelWorkbook,
  isExcelFileName,
  isJsonFileName,
  isPdfFileName,
  parseCsvMatrixAsync,
  parseCsvMatrixSync,
  parseExcelArrayBuffer,
  parsePdfArrayBuffer,
  type ExcelWorkbookInspection,
  type ParsedTabularResult,
} from '../utils/binaryTabularParser';
import {
  aggregateSmartDataset,
  buildCleanedRowsAndMetadata,
  computeSmartBoxPlotGroups,
  computeSmartColumnStats,
  computeSmartHistogramBins,
  formatSmartNum,
  isSmartDateColumn,
  isSmartNumericColumn,
  tryParseSmartNumeric,
} from '../utils/smartDataEngine';

export interface OfflineColumnStats {
  column: string;
  count: number;
  missingCount?: number;
  sum: number;
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
}

export interface OfflineBoxPlotGroupStats {
  label: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  count: number;
}

export interface OfflineFilePreviewInspectResult {
  fileName: string;
  fileSizeBytes: number;
  sourceFormat: 'Excel' | 'CSV' | 'PDF' | 'JSON';
  excelInfo?: ExcelWorkbookInspection;
  rawBuffer: ArrayBuffer;
  dataset: OfflineDataset;
}

export function formatOfflineNum(val: number, maxDecimals = 2): string {
  return formatSmartNum(val, maxDecimals);
}

export function parseOfflineCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export function tryParseNumeric(raw: unknown): number | null {
  return tryParseSmartNumeric(raw);
}

export function isOfflineNumericColumn(
  rows: OfflineDatasetRow[],
  col: string,
  columnTypes?: OfflineDataset['columnTypes']
): boolean {
  return isSmartNumericColumn(rows, col, columnTypes);
}

export function isOfflineDateColumn(
  rows: OfflineDatasetRow[],
  col: string,
  columnTypes?: OfflineDataset['columnTypes']
): boolean {
  return isSmartDateColumn(rows, col, columnTypes);
}

function buildOfflineDatasetFromTabular(
  fileName: string,
  tabular: ParsedTabularResult,
  meta?: {
    fileSizeBytes?: number;
    sourceFormat?: OfflineDataset['sourceFormat'];
  }
): OfflineDataset {
  if (!tabular.rawRows.length || !tabular.headers.length) {
    throw new Error('لم يتم العثور على سجلات أو أعمدة صالحة داخل الملف.');
  }

  const built = buildCleanedRowsAndMetadata(tabular.headers, tabular.rawRows);
  const sheetSuffix = tabular.sheetName ? ` (${tabular.sheetName})` : '';

  return {
    id: `offline_ds_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    label: `${fileName}${sheetSuffix}`,
    name: fileName,
    rowsCount: built.rows.length,
    colsCount: built.columns.length,
    columns: built.columns,
    numericCols: built.numericCols,
    dateCols: built.dateCols,
    catCols: built.catCols,
    columnTypes: built.columnTypes,
    defaultX: built.defaultX,
    defaultY: built.defaultY,
    rows: built.rows,
    isCustom: true,
    savedAtIso: new Date().toISOString(),
    fileSizeBytes: meta?.fileSizeBytes,
    sourceFormat: meta?.sourceFormat || tabular.sourceFormat || 'CSV',
    sheetName: tabular.sheetName,
    sheetNames: tabular.sheetNames,
    cleaningSummary: built.cleaningSummary,
  };
}

function parseJsonTextToTabular(rawText: string): ParsedTabularResult {
  const text = rawText.replace(/^\uFEFF/, '');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('ملف JSON غير صالح أو يحتوي على خطأ في الصياغة.');
  }

  const rawArr: Record<string, unknown>[] = Array.isArray(json)
    ? (json as Record<string, unknown>[])
    : json && typeof json === 'object'
      ? ((Object.values(json).find((v) => Array.isArray(v)) as Record<string, unknown>[] | undefined) || [
          json as Record<string, unknown>,
        ])
      : [];

  if (!rawArr.length) {
    throw new Error('ملف JSON فارغ ولا يحتوي على سجلات.');
  }

  const headerSet = new Set<string>();
  const sampleLim = Math.min(rawArr.length, 500);
  for (let i = 0; i < sampleLim; i++) {
    const item = rawArr[i];
    if (item && typeof item === 'object') {
      for (const k of Object.keys(item)) {
        if (k !== '#') headerSet.add(k);
      }
    }
  }
  const headers = Array.from(headerSet);
  if (!headers.length) {
    throw new Error('لم يتم العثور على حقول صالحة داخل ملف JSON.');
  }

  const rawRows = rawArr.map((item) =>
    headers.map((h) => (item && typeof item === 'object' ? (item[h] ?? '') : ''))
  );

  return { headers, rawRows, sourceFormat: 'JSON' };
}

export function parseOfflineTabularToDataset(fileName: string, tabular: ParsedTabularResult): OfflineDataset {
  return buildOfflineDatasetFromTabular(fileName, tabular);
}

export function parseOfflineDatasetText(
  fileName: string,
  rawText: string,
  fileSizeBytes?: number
): OfflineDataset {
  if (isJsonFileName(fileName)) {
    const tabular = parseJsonTextToTabular(rawText);
    return buildOfflineDatasetFromTabular(fileName, tabular, { fileSizeBytes, sourceFormat: 'JSON' });
  }
  const csv = parseCsvMatrixSync(rawText);
  return buildOfflineDatasetFromTabular(
    fileName,
    { headers: csv.headers, rawRows: csv.rawRows, sourceFormat: 'CSV', delimiter: csv.delimiter },
    { fileSizeBytes, sourceFormat: 'CSV' }
  );
}

export async function parseOfflineDatasetFromBuffer(
  fileName: string,
  buffer: ArrayBuffer,
  options?: { sheetName?: string; fileSizeBytes?: number }
): Promise<OfflineDataset> {
  const fileSizeBytes = options?.fileSizeBytes ?? buffer.byteLength;
  if (fileSizeBytes === 0) {
    throw new Error('الملف المحدد فارغ تماماً (0 بايت).');
  }

  if (isExcelFileName(fileName)) {
    const tabular = parseExcelArrayBuffer(buffer, options?.sheetName);
    return buildOfflineDatasetFromTabular(fileName, tabular, { fileSizeBytes, sourceFormat: 'Excel' });
  }

  if (isPdfFileName(fileName)) {
    const tabular = await parsePdfArrayBuffer(buffer);
    return buildOfflineDatasetFromTabular(fileName, tabular, { fileSizeBytes, sourceFormat: 'PDF' });
  }

  const { text, encoding } = decodeTextBufferWithInfo(buffer);
  if (isJsonFileName(fileName)) {
    const tabular = parseJsonTextToTabular(text);
    return buildOfflineDatasetFromTabular(fileName, tabular, { fileSizeBytes, sourceFormat: 'JSON' });
  }

  const csv = await parseCsvMatrixAsync(text);
  return buildOfflineDatasetFromTabular(
    fileName,
    {
      headers: csv.headers,
      rawRows: csv.rawRows,
      sourceFormat: 'CSV',
      delimiter: csv.delimiter,
      encoding,
    },
    { fileSizeBytes, sourceFormat: 'CSV' }
  );
}

export async function inspectAndParseOfflineDatasetFile(
  file: File,
  preferredSheetName?: string
): Promise<OfflineFilePreviewInspectResult> {
  const buffer = await file.arrayBuffer();
  if (isExcelFileName(file.name)) {
    const excelInfo = inspectExcelWorkbook(buffer);
    const chosenSheet = preferredSheetName || excelInfo.defaultSheetName;
    const dataset = await parseOfflineDatasetFromBuffer(file.name, buffer, {
      sheetName: chosenSheet,
      fileSizeBytes: file.size,
    });
    return {
      fileName: file.name,
      fileSizeBytes: file.size,
      sourceFormat: 'Excel',
      excelInfo,
      rawBuffer: buffer,
      dataset,
    };
  }

  const dataset = await parseOfflineDatasetFromBuffer(file.name, buffer, {
    fileSizeBytes: file.size,
  });
  return {
    fileName: file.name,
    fileSizeBytes: file.size,
    sourceFormat: (dataset.sourceFormat === 'Sample' ? 'CSV' : dataset.sourceFormat) || 'CSV',
    rawBuffer: buffer,
    dataset,
  };
}

export async function parseOfflineDatasetFile(
  file: File,
  preferredSheetName?: string
): Promise<OfflineDataset> {
  const buffer = await file.arrayBuffer();
  return parseOfflineDatasetFromBuffer(file.name, buffer, {
    sheetName: preferredSheetName,
    fileSizeBytes: file.size,
  });
}

export function aggregateOfflineData(
  ds: OfflineDataset,
  xCol: string,
  yCol: string,
  mode: OfflineAggMode = 'sum'
): { labels: string[]; values: number[] } {
  return aggregateSmartDataset(ds, xCol, yCol, mode);
}

export function computeOfflineColumnStats(ds: OfflineDataset, col: string): OfflineColumnStats | null {
  return computeSmartColumnStats(ds, col);
}

export function computeOfflineHistogramBins(
  ds: OfflineDataset,
  col: string
): { labels: string[]; counts: number[]; mean: number } | null {
  return computeSmartHistogramBins(ds, col);
}

export function computeOfflineBoxPlotGroups(
  ds: OfflineDataset,
  xCol: string,
  yCol: string
): OfflineBoxPlotGroupStats[] {
  return computeSmartBoxPlotGroups(ds, xCol, yCol);
}

export function downloadOfflineBlobFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportOfflineDatasetCSV(ds: OfflineDataset, filename?: string): void {
  const cols = ds.columns;
  const lines: string[] = new Array(ds.rows.length + 1);
  lines[0] = cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
  for (let i = 0; i < ds.rows.length; i++) {
    const r = ds.rows[i];
    lines[i + 1] = cols.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(',');
  }
  downloadOfflineBlobFile(
    '\uFEFF' + lines.join('\n'),
    filename || `Offline_Export_${ds.name.split('.')[0]}.csv`,
    'text/csv;charset=utf-8;'
  );
}

export function canvasToOfflinePngDataUrl(canvas: HTMLCanvasElement): string {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  const ctx = exportCanvas.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png', 1.0);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  ctx.drawImage(canvas, 0, 0);
  return exportCanvas.toDataURL('image/png', 1.0);
}

export async function compressOfflineLogoFile(file: File, maxDimension = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الشعار محلياً.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('ملف الصورة غير صالح.'));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('تعذر معالجة صورة الشعار.'));
          return;
        }
        ctx.clearRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);
        let dataUrl = canvas.toDataURL('image/png');
        if (dataUrl.length > 220000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        }
        if (dataUrl.length > 250000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.65);
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
