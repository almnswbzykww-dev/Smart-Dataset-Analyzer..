import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

export interface ParsedTabularResult {
  headers: string[];
  rawRows: unknown[][];
  sourceFormat?: 'Excel' | 'CSV' | 'PDF' | 'JSON';
  sheetName?: string;
  sheetNames?: string[];
  delimiter?: string;
  encoding?: string;
}

export interface ExcelWorkbookInspection {
  sheetNames: string[];
  defaultSheetName: string;
  sheetStats: Array<{ name: string; approxRows: number; approxCols: number }>;
}

const EXCEL_EXTENSIONS = ['.xlsx', '.xls', '.xlsm', '.xlsb', '.ods'];
const PDF_EXTENSIONS = ['.pdf'];

export function isExcelFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return EXCEL_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isPdfFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return PDF_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isJsonFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.json');
}

export function decodeTextBufferWithInfo(buffer: ArrayBuffer): { text: string; encoding: string } {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return {
      text: new TextDecoder('utf-8').decode(bytes.subarray(3)),
      encoding: 'UTF-8 (BOM)',
    };
  }
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      return {
        text: new TextDecoder('utf-16le').decode(bytes.subarray(2)),
        encoding: 'UTF-16LE',
      };
    }
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      return {
        text: new TextDecoder('utf-16be').decode(bytes.subarray(2)),
        encoding: 'UTF-16BE',
      };
    }
  }
  try {
    return {
      text: new TextDecoder('utf-8', { fatal: true }).decode(buffer),
      encoding: 'UTF-8',
    };
  } catch {
    try {
      return {
        text: new TextDecoder('windows-1256').decode(buffer),
        encoding: 'Windows-1256 (Arabic)',
      };
    } catch {
      try {
        return {
          text: new TextDecoder('iso-8859-1').decode(buffer),
          encoding: 'ISO-8859-1',
        };
      } catch {
        return {
          text: new TextDecoder('utf-8').decode(buffer),
          encoding: 'UTF-8',
        };
      }
    }
  }
}

export function decodeTextBuffer(buffer: ArrayBuffer): string {
  return decodeTextBufferWithInfo(buffer).text;
}

export function normalizeCellText(val: unknown): string | number {
  if (val === null || val === undefined) return '';
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof val === 'number') {
    return Number.isFinite(val) ? Number(val.toFixed(6)) : '';
  }
  if (typeof val === 'boolean') {
    return val ? 'نعم' : 'لا';
  }
  return String(val).replace(/\s+/g, ' ').trim();
}

function sanitizeUniqueHeaders(rawHeaders: unknown[], colCount: number): string[] {
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (let i = 0; i < colCount; i++) {
    const raw = normalizeCellText(rawHeaders[i]);
    let base = String(raw || '').trim() || `عمود_${i + 1}`;
    if (base === '#') base = 'المرجع';
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    out.push(count > 1 ? `${base}_${count}` : base);
  }
  return out;
}

export function extractBestTabularFromMatrix(matrix: unknown[][]): ParsedTabularResult {
  const nonEmptyRows: Array<Array<string | number>> = [];
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    const normalized = row.map((cell) => normalizeCellText(cell));
    if (normalized.some((cell) => cell !== '')) {
      nonEmptyRows.push(normalized);
    }
  }

  if (nonEmptyRows.length < 2) {
    throw new Error('ملف البيانات فارغ أو لا يحتوي على صفوف كافية للتحليل.');
  }

  const scanLimit = Math.min(10, nonEmptyRows.length - 1);
  let headerIdx = 0;
  let bestScore = -1;

  for (let i = 0; i < scanLimit; i++) {
    const row = nonEmptyRows[i];
    const filled = row.filter((c) => c !== '');
    if (filled.length < 1) continue;
    const textLikeCount = filled.filter((c) => typeof c === 'string' && !/^[+-]?[\d.,]+$/.test(c)).length;
    const score = filled.length * 10 + textLikeCount * 2 - i;
    if (score > bestScore) {
      bestScore = score;
      headerIdx = i;
    }
  }

  const headerRow = nonEmptyRows[headerIdx];
  const dataCandidates = nonEmptyRows.slice(headerIdx + 1);
  let maxCols = headerRow.length;
  const colSampleLimit = Math.min(300, dataCandidates.length);
  for (let i = 0; i < colSampleLimit; i++) {
    if (dataCandidates[i].length > maxCols) {
      maxCols = dataCandidates[i].length;
    }
  }

  // Trim trailing completely empty columns cleanly
  let activeColCount = maxCols;
  while (activeColCount > 1) {
    const idx = activeColCount - 1;
    const headerHasVal = (headerRow[idx] ?? '') !== '';
    let dataHasVal = false;
    for (let r = 0; r < dataCandidates.length; r++) {
      if ((dataCandidates[r][idx] ?? '') !== '') {
        dataHasVal = true;
        break;
      }
    }
    if (headerHasVal || dataHasVal) break;
    activeColCount--;
  }

  const headers = sanitizeUniqueHeaders(headerRow, activeColCount);
  const rawRows: unknown[][] = [];
  for (let i = 0; i < dataCandidates.length; i++) {
    const src = dataCandidates[i];
    const rowOut = new Array<unknown>(activeColCount);
    let hasValue = false;
    for (let c = 0; c < activeColCount; c++) {
      const cell = src[c] ?? '';
      if (cell !== '') hasValue = true;
      rowOut[c] = cell;
    }
    if (hasValue) {
      rawRows.push(rowOut);
    }
  }

  if (!rawRows.length) {
    throw new Error('لم يتم العثور على صفوف بيانات تحت صف العناوين في الملف.');
  }

  return { headers, rawRows };
}

function readExcelWorkbookSafe(buffer: ArrayBuffer): XLSX.WorkBook {
  try {
    const workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: true,
      cellNF: false,
      cellText: false,
    });
    if (!workbook || !workbook.SheetNames || !workbook.SheetNames.length) {
      throw new Error('ملف Excel لا يحتوي على أي أوراق عمل صالحة.');
    }
    return workbook;
  } catch (err) {
    if (err instanceof Error && err.message.includes('أوراق')) throw err;
    throw new Error('تعذر قراءة ملف Excel: تأكد من أن الملف غير تالف أو محمي بكلمة مرور.');
  }
}

export function inspectExcelWorkbook(buffer: ArrayBuffer): ExcelWorkbookInspection {
  const workbook = readExcelWorkbookSafe(buffer);
  const sheetStats: ExcelWorkbookInspection['sheetStats'] = [];
  let defaultSheetName = workbook.SheetNames[0];
  let bestSheetRows = -1;

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    let approxRows = 0;
    let approxCols = 0;
    if (sheet && sheet['!ref']) {
      try {
        const range = XLSX.utils.decode_range(sheet['!ref']);
        approxRows = Math.max(0, range.e.r - range.s.r);
        approxCols = Math.max(0, range.e.c - range.s.c + 1);
      } catch {
        approxRows = 0;
      }
    }
    sheetStats.push({ name, approxRows, approxCols });
    if (approxRows > bestSheetRows && approxRows >= 1) {
      bestSheetRows = approxRows;
      defaultSheetName = name;
    }
  }

  return {
    sheetNames: workbook.SheetNames,
    defaultSheetName,
    sheetStats,
  };
}

export function parseExcelArrayBuffer(
  buffer: ArrayBuffer,
  preferredSheetName?: string
): ParsedTabularResult {
  const workbook = readExcelWorkbookSafe(buffer);
  const sheetNames = workbook.SheetNames;

  const candidateSheets =
    preferredSheetName && sheetNames.includes(preferredSheetName)
      ? [preferredSheetName]
      : sheetNames;

  for (const sheetName of candidateSheets) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: true,
      blankrows: false,
    });
    let nonEmptyCount = 0;
    for (let i = 0; i < matrix.length; i++) {
      const r = matrix[i];
      if (Array.isArray(r) && r.some((cell) => cell !== '' && cell !== null && cell !== undefined)) {
        nonEmptyCount++;
        if (nonEmptyCount >= 2) break;
      }
    }
    if (nonEmptyCount >= 2) {
      const parsed = extractBestTabularFromMatrix(matrix);
      return {
        ...parsed,
        sourceFormat: 'Excel',
        sheetName,
        sheetNames,
      };
    }
  }

  if (preferredSheetName) {
    throw new Error(`ورقة العمل "${preferredSheetName}" فارغة أو لا تحتوي على جدول بيانات كافٍ للتحليل.`);
  }
  throw new Error('ملف Excel لا يحتوي على جدول بيانات صالح للتحليل.');
}

function parseSingleLineSample(line: string, delimiter: string): number {
  let count = 1;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      count++;
    }
  }
  return count;
}

export function detectCsvDelimiter(text: string): string {
  const candidates = [',', ';', '\t', '|'];
  const sampleLines: string[] = [];
  let start = 0;
  for (let i = 0; i <= text.length && sampleLines.length < 10; i++) {
    if (i === text.length || text[i] === '\n' || text[i] === '\r') {
      const ln = text.slice(start, i).trim();
      if (ln) sampleLines.push(ln);
      if (text[i] === '\r' && text[i + 1] === '\n') i++;
      start = i + 1;
    }
  }

  if (!sampleLines.length) return ',';

  let bestDelim = ',';
  let bestScore = -1;

  for (const delim of candidates) {
    const counts = sampleLines.map((ln) => parseSingleLineSample(ln, delim));
    const headerCount = counts[0];
    if (headerCount <= 1) continue;
    let consistentLines = 0;
    for (const c of counts) {
      if (c === headerCount) consistentLines++;
    }
    const score = consistentLines * 100 + headerCount;
    if (score > bestScore) {
      bestScore = score;
      bestDelim = delim;
    }
  }

  return bestDelim;
}

/**
 * Full RFC-4180 streaming CSV parser supporting quoted multiline cells, escaped quotes,
 * CRLF/LF/CR, and optional async chunk yields so 100k+ row files never freeze UI.
 */
export function parseCsvMatrixSync(rawText: string, explicitDelimiter?: string): {
  headers: string[];
  rawRows: string[][];
  delimiter: string;
} {
  const text = rawText.replace(/^\uFEFF/, '');
  const delimiter = explicitDelimiter || detectCsvDelimiter(text);
  const rows: string[][] = [];

  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < len && text[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === '"') {
      if (currentField.trim() === '') {
        currentField = '';
        inQuotes = true;
      } else {
        currentField += ch;
      }
    } else if (ch === delimiter) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && i + 1 < len && text[i + 1] === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += ch;
    }
  }

  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((cell) => cell !== '')) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) {
    throw new Error('ملف CSV فارغ أو لا يحتوي على صفوف بيانات صالحة تحت العناوين.');
  }

  const headerRow = rows[0];
  let colCount = headerRow.length;
  const checkLim = Math.min(rows.length, 200);
  for (let i = 1; i < checkLim; i++) {
    if (rows[i].length > colCount) colCount = rows[i].length;
  }

  const headers = sanitizeUniqueHeaders(headerRow, colCount);
  const rawRows: string[][] = new Array(rows.length - 1);
  for (let r = 1; r < rows.length; r++) {
    const src = rows[r];
    const rowOut = new Array<string>(colCount);
    for (let c = 0; c < colCount; c++) {
      rowOut[c] = src[c] ?? '';
    }
    rawRows[r - 1] = rowOut;
  }

  return { headers, rawRows, delimiter };
}

export async function parseCsvMatrixAsync(
  rawText: string,
  explicitDelimiter?: string
): Promise<{ headers: string[]; rawRows: string[][]; delimiter: string }> {
  const text = rawText.replace(/^\uFEFF/, '');
  const delimiter = explicitDelimiter || detectCsvDelimiter(text);
  const rows: string[][] = [];

  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  const len = text.length;
  let lastYieldPos = 0;
  const YIELD_CHAR_STEP = 1_500_000; // ~1.5 MB per micro-yield

  for (let i = 0; i < len; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < len && text[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === '"') {
      if (currentField.trim() === '') {
        currentField = '';
        inQuotes = true;
      } else {
        currentField += ch;
      }
    } else if (ch === delimiter) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && i + 1 < len && text[i + 1] === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';

      if (i - lastYieldPos >= YIELD_CHAR_STEP) {
        lastYieldPos = i;
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    } else {
      currentField += ch;
    }
  }

  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((cell) => cell !== '')) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) {
    throw new Error('ملف CSV فارغ أو لا يحتوي على صفوف بيانات صالحة تحت العناوين.');
  }

  const headerRow = rows[0];
  let colCount = headerRow.length;
  const checkLim = Math.min(rows.length, 200);
  for (let i = 1; i < checkLim; i++) {
    if (rows[i].length > colCount) colCount = rows[i].length;
  }

  const headers = sanitizeUniqueHeaders(headerRow, colCount);
  const rawRows: string[][] = new Array(rows.length - 1);
  for (let r = 1; r < rows.length; r++) {
    const src = rows[r];
    const rowOut = new Array<string>(colCount);
    for (let c = 0; c < colCount; c++) {
      rowOut[c] = src[c] ?? '';
    }
    rawRows[r - 1] = rowOut;
  }

  return { headers, rawRows, delimiter };
}

export interface PdfTextToken {
  str: string;
  x: number;
  y: number;
  width: number;
}

export function extractTabularFromPdfPages(pagesTokens: PdfTextToken[][]): ParsedTabularResult {
  const pageLines: Array<{ page: number; cells: string[]; fullLine: string }> = [];

  for (let pIdx = 0; pIdx < pagesTokens.length; pIdx++) {
    const tokens = pagesTokens[pIdx].filter((t) => t.str && t.str.trim() !== '');
    if (!tokens.length) continue;

    // Group tokens into horizontal lines by Y coordinate
    const sortedByY = [...tokens].sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: Array<{ y: number; items: PdfTextToken[] }> = [];

    for (const item of sortedByY) {
      const existingLine = lines.find((ln) => Math.abs(ln.y - item.y) <= 3.5);
      if (existingLine) {
        existingLine.items.push(item);
      } else {
        lines.push({ y: item.y, items: [item] });
      }
    }

    lines.sort((a, b) => b.y - a.y);

    for (const line of lines) {
      const ordered = [...line.items].sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let currentCell = '';
      let prevEnd = ordered[0]?.x ?? 0;

      for (let i = 0; i < ordered.length; i++) {
        const tok = ordered[i];
        const text = tok.str.trim();
        if (!text) continue;

        if (i === 0) {
          currentCell = text;
          prevEnd = tok.x + Math.max(tok.width || 0, text.length * 4);
          continue;
        }

        const gap = tok.x - prevEnd;
        // Larger horizontal gap indicates a separate table column
        if (gap > 12) {
          cells.push(currentCell.trim());
          currentCell = text;
        } else {
          currentCell += (gap > 1.5 ? ' ' : '') + text;
        }
        prevEnd = Math.max(prevEnd, tok.x + Math.max(tok.width || 0, text.length * 4));
      }
      if (currentCell.trim()) {
        cells.push(currentCell.trim());
      }

      if (!cells.length) continue;

      let finalCells = cells;
      if (finalCells.length === 1) {
        const single = finalCells[0];
        for (const sep of ['\t', '|', ';', ',']) {
          const split = single
            .split(sep)
            .map((s) => s.trim())
            .filter(Boolean);
          if (split.length >= 2) {
            finalCells = split;
            break;
          }
        }
        // Fallback: split whitespace-aligned columns separated by >=2 spaces
        if (finalCells.length === 1 && /\s{2,}/.test(single)) {
          const wsSplit = single
            .split(/\s{2,}/)
            .map((s) => s.trim())
            .filter(Boolean);
          if (wsSplit.length >= 2) {
            finalCells = wsSplit;
          }
        }
      }

      const fullLine = finalCells.join(' ').trim();
      if (fullLine) {
        pageLines.push({
          page: pIdx + 1,
          cells: finalCells,
          fullLine,
        });
      }
    }
  }

  if (!pageLines.length) {
    throw new Error('ملف PDF لا يحتوي على نصوص قابلة للقراءة (قد يكون ملفاً مصوراً بالماسح الضوئي فقط).');
  }

  // Check if the PDF contains a clear multi-column table
  const multiColLines = pageLines.filter((l) => l.cells.length >= 2);
  if (multiColLines.length >= 2) {
    const colFreq = new Map<number, number>();
    for (const l of multiColLines) {
      colFreq.set(l.cells.length, (colFreq.get(l.cells.length) || 0) + 1);
    }
    let dominantCols = 2;
    let maxFreq = 0;
    for (const [cols, freq] of colFreq.entries()) {
      if (freq > maxFreq) {
        maxFreq = freq;
        dominantCols = cols;
      }
    }

    const tableCandidates = multiColLines.filter(
      (l) => l.cells.length === dominantCols || Math.abs(l.cells.length - dominantCols) <= 1
    );

    if (tableCandidates.length >= 2) {
      const headerRow = tableCandidates[0].cells;
      const headerSig = headerRow.join('|');
      const dedupedBody = tableCandidates
        .slice(1)
        .filter((r) => r.cells.join('|') !== headerSig)
        .map((r) => r.cells);

      if (dedupedBody.length >= 1) {
        const res = extractBestTabularFromMatrix([headerRow, ...dedupedBody]);
        return { ...res, sourceFormat: 'PDF' };
      }
    }
  }

  // Structured fallback for narrative / report PDFs without grid columns
  const headers = ['الصفحة', 'رقم_السطر', 'المحتوى', 'القيمة_الرقمية', 'عدد_الكلمات'];
  const rawRows = pageLines.map((ln, idx) => {
    const numMatch = ln.fullLine.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    const numericVal = numMatch ? Number(numMatch[0]) : 0;
    const wordsCount = ln.fullLine.split(/\s+/).filter(Boolean).length;
    return [
      `صفحة ${ln.page}`,
      idx + 1,
      ln.fullLine,
      Number.isFinite(numericVal) ? numericVal : 0,
      wordsCount,
    ];
  });

  return { headers, rawRows, sourceFormat: 'PDF' };
}

export async function parsePdfArrayBuffer(buffer: ArrayBuffer): Promise<ParsedTabularResult> {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 8) {
    throw new Error('ملف PDF فارغ أو غير مكتمل.');
  }

  let pdf: pdfjsLib.PDFDocumentProxy;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: bytes,
      useSystemFonts: true,
    });
    pdf = await loadingTask.promise;
  } catch {
    throw new Error('تعذر فتح ملف PDF: تأكد من أن الملف سليم وغير مشفر بكلمة مرور.');
  }

  if (!pdf || pdf.numPages < 1) {
    throw new Error('تعذر قراءة صفحات ملف PDF.');
  }

  const pagesTokens: PdfTextToken[][] = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const tokens: PdfTextToken[] = [];
    for (const rawItem of content.items) {
      if ('str' in rawItem && typeof rawItem.str === 'string' && rawItem.str.trim() !== '') {
        const transform = Array.isArray(rawItem.transform) ? rawItem.transform : [1, 0, 0, 1, 0, 0];
        tokens.push({
          str: rawItem.str,
          x: Number(transform[4] ?? 0),
          y: Number(transform[5] ?? 0),
          width: Number('width' in rawItem ? rawItem.width : 0),
        });
      }
    }
    pagesTokens.push(tokens);
  }

  return extractTabularFromPdfPages(pagesTokens);
}
