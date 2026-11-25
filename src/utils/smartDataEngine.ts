/**
 * Pure Smart Data Cleaning, Column Type Detection, Iterative Statistics,
 * and Intelligent Big-Data Chart Aggregation Engine.
 * Zero Firebase / DOM dependencies — safe for Online, Offline, and Worker/SSR tests.
 */

export type SmartColumnKind = 'numeric' | 'date' | 'text';
export type SmartChartType = 'Bar' | 'Line' | 'Pie' | 'Scatter' | 'Histogram' | 'Box Plot';
export type SmartAggMode = 'sum' | 'avg' | 'count' | 'max' | 'min';

export type SmartRow = Record<string, string | number>;

export interface SmartCleaningSummary {
  missingHandledCount: number;
  numericNormalizedCount: number;
  datesNormalizedCount: number;
  duplicateRowsCount: number;
  originalRowsPreserved: boolean;
}

export interface SmartDatasetLike {
  id: string;
  name: string;
  rowsCount: number;
  colsCount: number;
  columns: string[];
  numericCols: string[];
  dateCols?: string[];
  catCols: string[];
  columnTypes?: Record<string, SmartColumnKind>;
  defaultX: string;
  defaultY: string;
  rows: SmartRow[];
}

export interface SmartColumnStats {
  column: string;
  count: number;
  missingCount: number;
  sum: number;
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
}

export interface SmartBoxPlotGroup {
  label: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  count: number;
}

export interface SmartScatterPoint {
  x: number;
  y: number;
  rawLabel: string;
}

export type SmartChartPrepared =
  | {
      kind: 'Bar' | 'Line' | 'Pie';
      labels: string[];
      values: number[];
      effectiveX: string;
      effectiveY: string;
      effectiveAgg: SmartAggMode;
      totalGroups: number;
      adaptationNotice?: string;
    }
  | {
      kind: 'Scatter';
      points: SmartScatterPoint[];
      xTitle: string;
      yTitle: string;
      useNumericX: boolean;
      xTickLabels?: string[];
      totalMatchedPoints: number;
      adaptationNotice?: string;
    }
  | {
      kind: 'Histogram';
      labels: string[];
      counts: number[];
      mean: number;
      targetCol: string;
      isCategoricalFrequency?: boolean;
      adaptationNotice?: string;
    }
  | {
      kind: 'Box Plot';
      groups: SmartBoxPlotGroup[];
      targetYCol: string;
      effectiveX: string;
      adaptationNotice?: string;
    };

const MISSING_TOKENS = new Set([
  '',
  'na',
  'n/a',
  'null',
  'none',
  'nan',
  'nil',
  'undefined',
  '-',
  '--',
  '?',
  'غير متوفر',
]);

export function formatBytesAr(bytes?: number): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export function sanitizeFiniteNumber(val: number, fallback = 0): number {
  return Number.isFinite(val) ? val : fallback;
}

export function formatSmartNum(val: number, maxDecimals = 2): string {
  if (!Number.isFinite(val)) return '0';
  return Number(val.toFixed(maxDecimals)).toLocaleString('en-US');
}

export function normalizeDigitsString(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/٬/g, '');
}

export function isMissingCellValue(raw: unknown): boolean {
  if (raw === null || raw === undefined) return true;
  if (typeof raw === 'number') return !Number.isFinite(raw);
  const str = String(raw).trim().toLowerCase();
  return MISSING_TOKENS.has(str);
}

export function tryParseSmartNumeric(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;

  let cleaned = normalizeDigitsString(raw).trim();
  if (!cleaned || MISSING_TOKENS.has(cleaned.toLowerCase())) return null;

  // Handle accounting negatives like (1,250.50)
  let negativeParen = false;
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    negativeParen = true;
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Strip common currency & percentage symbols without harming dates like 2024-05-01
  cleaned = cleaned
    .replace(/,/g, '')
    .replace(/^\s*[$€£¥₪]\s*/, '')
    .replace(/\s*[$€£¥₪%٪]\s*$/, '')
    .replace(/\s*(USD|SAR|AED|YER|EGP|EUR|ريال|دولار)\s*$/i, '')
    .trim();

  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  let num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  if (negativeParen && num > 0) num = -num;
  return num;
}

const MONTH_NAME_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function makeValidDateResult(y: number, m: number, d: number): { iso: string; ts: number } | null {
  if (y < 1900 || y > 2150 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const ts = Date.UTC(y, m - 1, d);
  const check = new Date(ts);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    return null;
  }
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { iso, ts };
}

export function tryParseSmartDate(raw: unknown): { iso: string; ts: number } | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return makeValidDateResult(raw.getFullYear(), raw.getMonth() + 1, raw.getDate());
  }
  if (typeof raw !== 'string') return null;

  const trimmed = normalizeDigitsString(raw).trim();
  if (!trimmed || trimmed.length < 6 || trimmed.length > 40) return null;
  if (MISSING_TOKENS.has(trimmed.toLowerCase())) return null;
  // Pure number is not a date string
  if (/^[+-]?[\d.,]+$/.test(trimmed)) return null;

  // YYYY-MM-DD or YYYY/MM/DD (with optional time)
  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/.exec(trimmed);
  if (isoMatch) {
    return makeValidDateResult(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  // DD/MM/YYYY or MM/DD/YYYY or DD-MM-YYYY
  const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[T\s].*)?$/.exec(trimmed);
  if (dmyMatch) {
    const a = Number(dmyMatch[1]);
    const b = Number(dmyMatch[2]);
    const y = Number(dmyMatch[3]);
    if (a > 12) return makeValidDateResult(y, b, a);
    if (b > 12) return makeValidDateResult(y, a, b);
    // Default DMY for ambiguous dates in regional/CSV exports
    return makeValidDateResult(y, b, a);
  }

  // YYYY-MM
  const ymMatch = /^(\d{4})[-/](\d{1,2})$/.exec(trimmed);
  if (ymMatch) {
    return makeValidDateResult(Number(ymMatch[1]), Number(ymMatch[2]), 1);
  }

  // DD-MMM-YYYY e.g. 01-Jul-2017 or Jul 01, 2017
  const dMonY = /^(\d{1,2})[-\s]([A-Za-z]{3,9})[-,\s]+(\d{4})$/.exec(trimmed);
  if (dMonY) {
    const m = MONTH_NAME_MAP[dMonY[2].toLowerCase()];
    if (m) return makeValidDateResult(Number(dMonY[3]), m, Number(dMonY[1]));
  }
  const monDY = /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/.exec(trimmed);
  if (monDY) {
    const m = MONTH_NAME_MAP[monDY[1].toLowerCase()];
    if (m) return makeValidDateResult(Number(monDY[3]), m, Number(monDY[2]));
  }

  return null;
}

export function isSmartNumericColumn(rows: SmartRow[], col: string, precomputedTypes?: Record<string, SmartColumnKind>): boolean {
  if (precomputedTypes && precomputedTypes[col]) {
    return precomputedTypes[col] === 'numeric';
  }
  let nonMissing = 0;
  let numeric = 0;
  const len = rows.length;
  for (let i = 0; i < len; i++) {
    const val = rows[i]?.[col];
    if (isMissingCellValue(val)) continue;
    nonMissing++;
    if (tryParseSmartNumeric(val) !== null) {
      numeric++;
    }
  }
  return nonMissing > 0 && numeric / nonMissing >= 0.85;
}

export function isSmartDateColumn(rows: SmartRow[], col: string, precomputedTypes?: Record<string, SmartColumnKind>): boolean {
  if (precomputedTypes && precomputedTypes[col]) {
    return precomputedTypes[col] === 'date';
  }
  let nonMissing = 0;
  let dates = 0;
  const len = Math.min(rows.length, 3000);
  for (let i = 0; i < len; i++) {
    const val = rows[i]?.[col];
    if (isMissingCellValue(val)) continue;
    nonMissing++;
    if (tryParseSmartDate(val) !== null) {
      dates++;
    }
  }
  return nonMissing > 0 && dates / nonMissing >= 0.8;
}

/**
 * Classifies columns (numeric / date / text) and applies non-destructive cleaning
 * across ALL rows without deleting any original records.
 */
export function buildCleanedRowsAndMetadata(
  headers: string[],
  rawRows: unknown[][]
): {
  columns: string[];
  rows: SmartRow[];
  numericCols: string[];
  dateCols: string[];
  catCols: string[];
  columnTypes: Record<string, SmartColumnKind>;
  defaultX: string;
  defaultY: string;
  cleaningSummary: SmartCleaningSummary;
} {
  const rowCount = rawRows.length;
  const colCount = headers.length;

  let missingHandledCount = 0;
  let numericNormalizedCount = 0;
  let datesNormalizedCount = 0;

  // Pass 1: classify each column across full dataset (or balanced sample for > 200k rows)
  const sampleStep = rowCount > 200_000 ? Math.ceil(rowCount / 50_000) : 1;
  const columnTypes: Record<string, SmartColumnKind> = {};
  const numericCols: string[] = [];
  const dateCols: string[] = [];
  const catCols: string[] = [];

  for (let c = 0; c < colCount; c++) {
    const header = headers[c];
    let nonMissing = 0;
    let numCount = 0;
    let dateCount = 0;

    for (let r = 0; r < rowCount; r += sampleStep) {
      const val = rawRows[r]?.[c];
      if (isMissingCellValue(val)) continue;
      nonMissing++;
      if (tryParseSmartNumeric(val) !== null) {
        numCount++;
      } else if (tryParseSmartDate(val) !== null) {
        dateCount++;
      }
    }

    if (nonMissing > 0 && numCount / nonMissing >= 0.85) {
      columnTypes[header] = 'numeric';
      numericCols.push(header);
    } else if (nonMissing > 0 && dateCount / nonMissing >= 0.8) {
      columnTypes[header] = 'date';
      dateCols.push(header);
    } else {
      columnTypes[header] = 'text';
      catCols.push(header);
    }
  }

  // Pass 2: build clean SmartRow objects preserving ALL original rows
  const rows: SmartRow[] = new Array(rowCount);
  const seenRowSignatures = new Set<string>();
  let duplicateRowsCount = 0;

  for (let r = 0; r < rowCount; r++) {
    const src = rawRows[r];
    const rowObj: SmartRow = { '#': r + 1 };
    let sig = '';

    for (let c = 0; c < colCount; c++) {
      const h = headers[c];
      const raw = src ? src[c] : '';
      const kind = columnTypes[h];

      if (isMissingCellValue(raw)) {
        rowObj[h] = '';
        if (raw !== '') {
          missingHandledCount++;
        } else {
          missingHandledCount++;
        }
        sig += '|';
        continue;
      }

      if (kind === 'numeric') {
        const num = tryParseSmartNumeric(raw);
        if (num !== null) {
          if (typeof raw === 'string') {
            const rawTrim = raw.trim();
            if (rawTrim !== String(num)) numericNormalizedCount++;
          }
          rowObj[h] = num;
          sig += '|' + num;
        } else {
          const s = String(raw).trim();
          rowObj[h] = s;
          sig += '|' + s;
        }
      } else if (kind === 'date') {
        const parsedDate = tryParseSmartDate(raw);
        if (parsedDate) {
          if (typeof raw !== 'string' || raw.trim() !== parsedDate.iso) {
            datesNormalizedCount++;
          }
          rowObj[h] = parsedDate.iso;
          sig += '|' + parsedDate.iso;
        } else {
          const s = String(raw).trim();
          rowObj[h] = s;
          sig += '|' + s;
        }
      } else {
        const s = String(raw).replace(/\s+/g, ' ').trim();
        rowObj[h] = s;
        sig += '|' + s;
      }
    }

    if (seenRowSignatures.has(sig)) {
      duplicateRowsCount++;
    } else if (seenRowSignatures.size < 250_000) {
      seenRowSignatures.add(sig);
    }

    rows[r] = rowObj;
  }

  // Choose smart defaults for X and Y
  const cardinalityScore = (col: string): number => {
    const uniq = new Set<string>();
    const lim = Math.min(rows.length, 2000);
    for (let i = 0; i < lim; i++) {
      const v = String(rows[i]?.[col] ?? '').trim();
      if (v) uniq.add(v);
      if (uniq.size > 200) break;
    }
    return uniq.size;
  };

  let defaultX =
    catCols.find((c) => {
      const card = cardinalityScore(c);
      return card >= 2 && card <= 40;
    }) ||
    dateCols[0] ||
    catCols[0] ||
    headers[0] ||
    '#';

  if (!defaultX || defaultX === '#') {
    defaultX = headers[0] || '#';
  }

  const preferredMetricCol =
    numericCols.find((c) => !/^(id|index|no|row|رقم|year|السنة)$/i.test(c.trim()) && c !== defaultX) ||
    numericCols.find((c) => c !== defaultX) ||
    numericCols[0] ||
    headers.find((c) => c !== defaultX) ||
    headers[0] ||
    '#';

  const columns = ['#', ...headers];

  return {
    columns,
    rows,
    numericCols: numericCols.length ? numericCols : headers,
    dateCols,
    catCols: catCols.length ? catCols : dateCols.length ? dateCols : headers,
    columnTypes,
    defaultX,
    defaultY: preferredMetricCol,
    cleaningSummary: {
      missingHandledCount,
      numericNormalizedCount,
      datesNormalizedCount,
      duplicateRowsCount,
      originalRowsPreserved: true,
    },
  };
}

function quantileSorted(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Iterative O(N) column stats (safe for 1,000,000+ rows — zero spread operators!)
 */
export function computeSmartColumnStats(ds: SmartDatasetLike, col: string): SmartColumnStats | null {
  const vals: number[] = [];
  let missingCount = 0;
  let sum = 0;
  let minVal = Infinity;
  let maxVal = -Infinity;

  const rows = ds.rows;
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]?.[col];
    if (isMissingCellValue(raw)) {
      missingCount++;
      continue;
    }
    const n = tryParseSmartNumeric(raw);
    if (n !== null) {
      vals.push(n);
      sum += n;
      if (n < minVal) minVal = n;
      if (n > maxVal) maxVal = n;
    } else {
      missingCount++;
    }
  }

  if (!vals.length) return null;

  vals.sort((a, b) => a - b);
  const safeSum = Number.isFinite(sum) ? sum : 0;
  const mean = Number.isFinite(safeSum / vals.length) ? safeSum / vals.length : 0;
  let sqDiffSum = 0;
  for (let i = 0; i < vals.length; i++) {
    const d = vals[i] - mean;
    const sq = d * d;
    if (Number.isFinite(sq)) {
      sqDiffSum += sq;
    }
  }
  const variance = Number.isFinite(sqDiffSum / vals.length) ? sqDiffSum / vals.length : 0;
  const stdDev = Number.isFinite(Math.sqrt(variance)) ? Math.sqrt(variance) : 0;

  return {
    column: col,
    count: vals.length,
    missingCount,
    sum: safeSum,
    mean,
    median: sanitizeFiniteNumber(quantileSorted(vals, 0.5)),
    stdDev,
    min: sanitizeFiniteNumber(minVal),
    max: sanitizeFiniteNumber(maxVal),
    q1: sanitizeFiniteNumber(quantileSorted(vals, 0.25)),
    q3: sanitizeFiniteNumber(quantileSorted(vals, 0.75)),
  };
}

export function detectSmartColumnKind(ds: SmartDatasetLike, col: string): SmartColumnKind {
  if (ds.columnTypes && ds.columnTypes[col]) {
    return ds.columnTypes[col];
  }
  if (isSmartNumericColumn(ds.rows, col, ds.columnTypes)) return 'numeric';
  if (isSmartDateColumn(ds.rows, col, ds.columnTypes)) return 'date';
  return 'text';
}

export function formatColumnKindLabel(kind: SmartColumnKind): string {
  if (kind === 'numeric') return 'Numeric · رقمي';
  if (kind === 'date') return 'Date · تاريخ';
  return 'Text · نصي';
}

export function aggregateSmartDataset(
  ds: SmartDatasetLike,
  xCol: string,
  yCol: string,
  mode: SmartAggMode = 'sum'
): { labels: string[]; values: number[] } {
  const effectiveY = !yCol || yCol === '__auto__' || yCol === 'NONE' ? '' : yCol;
  const effectiveMode: SmartAggMode = !effectiveY ? 'count' : mode;

  const sums = new Map<string, number>();
  const counts = new Map<string, number>();
  const maxs = new Map<string, number>();
  const mins = new Map<string, number>();

  const rows = ds.rows;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rawKey = r?.[xCol];
    const key = isMissingCellValue(rawKey) ? 'غير محدد' : String(rawKey).trim() || 'غير محدد';

    const parsed = effectiveY ? tryParseSmartNumeric(r?.[effectiveY]) : null;
    const prevCount = counts.get(key) || 0;
    counts.set(key, prevCount + 1);

    if (parsed !== null) {
      sums.set(key, (sums.get(key) || 0) + parsed);
      const curMax = maxs.get(key);
      maxs.set(key, curMax !== undefined ? (parsed > curMax ? parsed : curMax) : parsed);
      const curMin = mins.get(key);
      mins.set(key, curMin !== undefined ? (parsed < curMin ? parsed : curMin) : parsed);
    } else if (!sums.has(key)) {
      sums.set(key, 0);
    }
  }

  const labels = Array.from(counts.keys());
  if (!labels.length) {
    return { labels: ['لا توجد بيانات'], values: [0] };
  }
  const values = labels.map((k) => {
    const cnt = counts.get(k) || 1;
    const sum = sanitizeFiniteNumber(sums.get(k) || 0);
    let raw = 0;
    if (effectiveMode === 'sum') raw = sum;
    else if (effectiveMode === 'count') raw = cnt;
    else if (effectiveMode === 'max') raw = maxs.get(k) ?? 0;
    else if (effectiveMode === 'min') raw = mins.get(k) ?? 0;
    else raw = sum / cnt;
    return Number(sanitizeFiniteNumber(raw).toFixed(2));
  });

  return { labels, values };
}

export function computeSmartHistogramBins(
  ds: SmartDatasetLike,
  col: string
): { labels: string[]; counts: number[]; mean: number } | null {
  const vals: number[] = [];
  let minVal = Infinity;
  let maxVal = -Infinity;
  let sum = 0;

  const rows = ds.rows;
  for (let i = 0; i < rows.length; i++) {
    const n = tryParseSmartNumeric(rows[i]?.[col]);
    if (n !== null) {
      vals.push(n);
      sum += n;
      if (n < minVal) minVal = n;
      if (n > maxVal) maxVal = n;
    }
  }

  if (!vals.length || !Number.isFinite(minVal) || !Number.isFinite(maxVal)) return null;
  const mean = sanitizeFiniteNumber(sum / vals.length);

  if (minVal === maxVal || !Number.isFinite(maxVal - minVal) || maxVal - minVal === 0) {
    return {
      labels: [formatSmartNum(minVal)],
      counts: [vals.length],
      mean,
    };
  }

  const binCount = Math.min(14, Math.max(5, Math.round(Math.log2(vals.length) + 1)));
  const width = (maxVal - minVal) / binCount;
  if (!Number.isFinite(width) || width <= 0) {
    return {
      labels: [formatSmartNum(minVal)],
      counts: [vals.length],
      mean,
    };
  }
  const counts = new Array<number>(binCount).fill(0);
  const labels: string[] = [];

  for (let i = 0; i < binCount; i++) {
    const start = minVal + i * width;
    const end = start + width;
    labels.push(`${formatSmartNum(start, 1)} – ${formatSmartNum(end, 1)}`);
  }

  for (let i = 0; i < vals.length; i++) {
    let idx = Math.floor((vals[i] - minVal) / width);
    if (!Number.isFinite(idx) || idx < 0) idx = 0;
    if (idx >= binCount) idx = binCount - 1;
    counts[idx]++;
  }

  return { labels, counts, mean };
}

export function computeSmartBoxPlotGroups(
  ds: SmartDatasetLike,
  xCol: string,
  yCol: string
): SmartBoxPlotGroup[] {
  if (!isSmartNumericColumn(ds.rows, yCol, ds.columnTypes)) return [];

  const xIsNum = isSmartNumericColumn(ds.rows, xCol, ds.columnTypes);
  const distinctX = new Set<string>();
  const rows = ds.rows;
  for (let i = 0; i < rows.length; i++) {
    distinctX.add(String(rows[i]?.[xCol] ?? ''));
    if (distinctX.size > 40) break;
  }

  if (xCol === yCol || (xIsNum && distinctX.size > 10)) {
    const vals: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      const v = tryParseSmartNumeric(rows[i]?.[yCol]);
      if (v !== null) vals.push(v);
    }
    if (!vals.length) return [];
    vals.sort((a, b) => a - b);
    const min = sanitizeFiniteNumber(vals[0]);
    const max = sanitizeFiniteNumber(vals[vals.length - 1]);
    const q1 = sanitizeFiniteNumber(quantileSorted(vals, 0.25), min);
    const median = sanitizeFiniteNumber(quantileSorted(vals, 0.5), q1);
    const q3 = sanitizeFiniteNumber(quantileSorted(vals, 0.75), max);
    return [
      {
        label: yCol,
        min,
        q1,
        median,
        q3,
        max,
        count: vals.length,
      },
    ];
  }

  const grouped = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const val = tryParseSmartNumeric(rows[i]?.[yCol]);
    if (val === null) continue;
    const rawKey = rows[i]?.[xCol];
    const key = isMissingCellValue(rawKey) ? 'غير محدد' : String(rawKey).trim() || 'غير محدد';
    let arr = grouped.get(key);
    if (!arr) {
      arr = [];
      grouped.set(key, arr);
    }
    arr.push(val);
  }

  // Sort groups by frequency descending and cap to 12 cleanest groups
  const entries = Array.from(grouped.entries()).sort((a, b) => b[1].length - a[1].length).slice(0, 12);
  return entries.map(([label, arr]) => {
    arr.sort((a, b) => a - b);
    const min = sanitizeFiniteNumber(arr[0]);
    const max = sanitizeFiniteNumber(arr[arr.length - 1]);
    const q1 = sanitizeFiniteNumber(quantileSorted(arr, 0.25), min);
    const median = sanitizeFiniteNumber(quantileSorted(arr, 0.5), q1);
    const q3 = sanitizeFiniteNumber(quantileSorted(arr, 0.75), max);
    return {
      label,
      min,
      q1,
      median,
      q3,
      max,
      count: arr.length,
    };
  });
}

function capTopCategories(
  labels: string[],
  values: number[],
  maxBars: number,
  aggMode: SmartAggMode
): { labels: string[]; values: number[]; wasCapped: boolean } {
  if (labels.length <= maxBars) {
    return { labels, values, wasCapped: false };
  }
  const pairs = labels.map((label, i) => ({ label, value: values[i] }));
  pairs.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const top = pairs.slice(0, maxBars - 1);
  const rest = pairs.slice(maxBars - 1);

  if (aggMode === 'sum' || aggMode === 'count') {
    const otherSum = rest.reduce((acc, p) => acc + p.value, 0);
    return {
      labels: [...top.map((p) => p.label), `أخرى (${rest.length} فئة)`],
      values: [...top.map((p) => p.value), Number(otherSum.toFixed(2))],
      wasCapped: true,
    };
  }
  return {
    labels: top.map((p) => p.label),
    values: top.map((p) => p.value),
    wasCapped: true,
  };
}

/**
 * Intelligent Chart Data Adapter: guarantees all 6 chart types render cleanly without crashing
 * on massive datasets (100k+ rows) or failing on column-type mismatches.
 */
export function prepareSmartChartData(
  ds: SmartDatasetLike,
  xCol: string,
  yCol: string,
  chartType: SmartChartType,
  aggMode: SmartAggMode
): SmartChartPrepared {
  const featureCols = ds.columns.filter((c) => c !== '#');
  const safeX = featureCols.includes(xCol) ? xCol : ds.defaultX || featureCols[0] || '#';
  const yIsExplicitlyOmitted = !yCol || yCol === '__auto__' || yCol === 'NONE';
  const safeY = !yIsExplicitlyOmitted && featureCols.includes(yCol) ? yCol : yIsExplicitlyOmitted ? '' : ds.defaultY || featureCols[0] || '#';

  const xIsNum = isSmartNumericColumn(ds.rows, safeX, ds.columnTypes);
  const yIsNum = safeY ? isSmartNumericColumn(ds.rows, safeY, ds.columnTypes) : false;
  const xIsDate = isSmartDateColumn(ds.rows, safeX, ds.columnTypes);

  const numericCandidates = featureCols.filter((c) => isSmartNumericColumn(ds.rows, c, ds.columnTypes));

  // ==================== 1. BAR / PIE ====================
  if (chartType === 'Bar' || chartType === 'Pie') {
    const notices: string[] = [];
    let effectiveAgg = aggMode;
    let effectiveY = safeY || 'عدد السجلات';

    if (yIsExplicitlyOmitted || !safeY) {
      effectiveAgg = 'count';
      effectiveY = 'عدد السجلات';
      notices.push(`تم احتساب تكرار السجلات تلقائياً لعمود "${safeX}" بدون إجبار اختيار محور Y.`);
    } else if (!yIsNum && effectiveAgg !== 'count') {
      effectiveAgg = 'count';
      notices.push(`تم التحويل التلقائي إلى «العدد» لأن العمود "${safeY}" نصي أو غير رقمي.`);
    }

    const agg = aggregateSmartDataset(ds, safeX, safeY || safeX, effectiveAgg);
    let labels = agg.labels;
    let values = agg.values.map((v) => sanitizeFiniteNumber(v));

    // For Pie: ensure strictly non-negative positive values
    if (chartType === 'Pie') {
      const hasNegative = values.some((v) => v < 0);
      const positiveSum = values.reduce((a, b) => a + (b > 0 ? b : 0), 0);
      if (hasNegative || positiveSum <= 0) {
        const countFallback = aggregateSmartDataset(ds, safeX, safeY || safeX, 'count');
        labels = countFallback.labels;
        values = countFallback.values.map((v) => sanitizeFiniteNumber(v));
        effectiveAgg = 'count';
        notices.push('تم عرض التوزيع النسبي بالتكرار (العدد) لتجنب القيم السالبة أو الصفرية في المخطط الدائري.');
      }
      if (values.reduce((a, b) => a + (b > 0 ? b : 0), 0) <= 0) {
        labels = ['لا توجد بيانات رقمية موجبة'];
        values = [1];
      }
    }

    const maxItems = chartType === 'Pie' ? 9 : 18;
    const capped = capTopCategories(labels, values, maxItems, effectiveAgg);
    if (capped.wasCapped) {
      notices.push(
        `تم تلخيص ${formatSmartNum(labels.length, 0)} فئة إلى أعلى ${maxItems - 1} فئة + «أخرى» للحفاظ على وضوح الرسم وسرعة العرض.`
      );
    }

    return {
      kind: chartType,
      labels: capped.labels.length ? capped.labels : ['لا توجد بيانات'],
      values: capped.values.length ? capped.values.map((v) => sanitizeFiniteNumber(v)) : [0],
      effectiveX: safeX,
      effectiveY,
      effectiveAgg,
      totalGroups: labels.length,
      adaptationNotice: notices.length ? notices.join(' • ') : undefined,
    };
  }

  // ==================== 2. LINE (Chronological + Smart Binning) ====================
  if (chartType === 'Line') {
    const notices: string[] = [];
    let effectiveAgg = aggMode;
    const effectiveY = safeY || 'عدد السجلات';
    if (yIsExplicitlyOmitted || !safeY) {
      effectiveAgg = 'count';
      notices.push(`تم احتساب التوزيع العددي تلقائياً عبر "${safeX}" بدون إلزام اختيار محور Y.`);
    } else if (!yIsNum && effectiveAgg !== 'count') {
      effectiveAgg = 'count';
      notices.push(`تم التحويل التلقائي إلى «العدد» لأن المحور Y "${safeY}" غير رقمي.`);
    }

    if (xIsDate) {
      // Aggregate chronologically; group by Month if > 45 unique days
      const dayBuckets = new Map<string, { ts: number; sum: number; count: number; max: number; min: number }>();
      for (let i = 0; i < ds.rows.length; i++) {
        const r = ds.rows[i];
        const parsedDate = tryParseSmartDate(r?.[safeX]);
        if (!parsedDate) continue;
        const val = safeY ? tryParseSmartNumeric(r?.[safeY]) : 1;
        const bucket = dayBuckets.get(parsedDate.iso);
        if (bucket) {
          bucket.count++;
          if (val !== null) {
            bucket.sum += val;
            if (val > bucket.max) bucket.max = val;
            if (val < bucket.min) bucket.min = val;
          }
        } else {
          dayBuckets.set(parsedDate.iso, {
            ts: parsedDate.ts,
            sum: val ?? 0,
            count: 1,
            max: val ?? 0,
            min: val ?? 0,
          });
        }
      }

      if (dayBuckets.size > 45) {
        // Re-aggregate cleanly by Month (YYYY-MM)
        const monthBuckets = new Map<string, { sum: number; count: number; max: number; min: number }>();
        for (const [iso, b] of dayBuckets.entries()) {
          const ym = iso.slice(0, 7);
          const m = monthBuckets.get(ym);
          if (m) {
            m.sum += b.sum;
            m.count += b.count;
            if (b.max > m.max) m.max = b.max;
            if (b.min < m.min) m.min = b.min;
          } else {
            monthBuckets.set(ym, { sum: b.sum, count: b.count, max: b.max, min: b.min });
          }
        }
        const sortedMonths = Array.from(monthBuckets.keys()).sort();
        // If still > 48 months, aggregate by Year (YYYY)
        if (sortedMonths.length > 48) {
          const yearBuckets = new Map<string, { sum: number; count: number; max: number; min: number }>();
          for (const ym of sortedMonths) {
            const yr = ym.slice(0, 4);
            const mb = monthBuckets.get(ym)!;
            const yb = yearBuckets.get(yr);
            if (yb) {
              yb.sum += mb.sum;
              yb.count += mb.count;
              if (mb.max > yb.max) yb.max = mb.max;
              if (mb.min < yb.min) yb.min = mb.min;
            } else {
              yearBuckets.set(yr, { ...mb });
            }
          }
          const years = Array.from(yearBuckets.keys()).sort();
          const vals = years.map((yr) => {
            const b = yearBuckets.get(yr)!;
            if (effectiveAgg === 'sum') return Number(b.sum.toFixed(2));
            if (effectiveAgg === 'count') return b.count;
            if (effectiveAgg === 'max') return Number(b.max.toFixed(2));
            if (effectiveAgg === 'min') return Number(b.min.toFixed(2));
            return Number((b.sum / b.count).toFixed(2));
          });
          notices.push(`تم التجميع الزمني السنوي لـ ${formatSmartNum(dayBuckets.size, 0)} تاريخ لعرض اتجاه زمني واضح.`);
          return {
            kind: 'Line',
            labels: years,
            values: vals,
            effectiveX: safeX,
            effectiveY,
            effectiveAgg,
            totalGroups: years.length,
            adaptationNotice: notices.join(' • '),
          };
        }

        const vals = sortedMonths.map((ym) => {
          const b = monthBuckets.get(ym)!;
          if (effectiveAgg === 'sum') return Number(b.sum.toFixed(2));
          if (effectiveAgg === 'count') return b.count;
          if (effectiveAgg === 'max') return Number(b.max.toFixed(2));
          if (effectiveAgg === 'min') return Number(b.min.toFixed(2));
          return Number((b.sum / b.count).toFixed(2));
        });
        notices.push(`تم التجميع الزمني الشهري لـ ${formatSmartNum(dayBuckets.size, 0)} يوماً لعرض السلسلة الزمنية بسلاسة.`);
        return {
          kind: 'Line',
          labels: sortedMonths,
          values: vals,
          effectiveX: safeX,
          effectiveY,
          effectiveAgg,
          totalGroups: sortedMonths.length,
          adaptationNotice: notices.join(' • '),
        };
      }

      const sortedDays = Array.from(dayBuckets.entries()).sort((a, b) => a[1].ts - b[1].ts);
      if (sortedDays.length > 0) {
        const vals = sortedDays.map(([, b]) => {
          let raw = 0;
          if (effectiveAgg === 'sum') raw = b.sum;
          else if (effectiveAgg === 'count') raw = b.count;
          else if (effectiveAgg === 'max') raw = b.max;
          else if (effectiveAgg === 'min') raw = b.min;
          else raw = b.sum / Math.max(1, b.count);
          return Number(sanitizeFiniteNumber(raw).toFixed(2));
        });
        return {
          kind: 'Line',
          labels: sortedDays.map(([d]) => d),
          values: vals,
          effectiveX: safeX,
          effectiveY,
          effectiveAgg,
          totalGroups: sortedDays.length,
          adaptationNotice: notices.length ? notices.join(' • ') : undefined,
        };
      }
      notices.push(`تعذر استخلاص تواريخ صالحة من "${safeX}"؛ تم التجميع التلقائي بالقيم المتاحة.`);
    }

    const agg = aggregateSmartDataset(ds, safeX, safeY || safeX, effectiveAgg);
    let labels = agg.labels;
    let values = agg.values.map((v) => sanitizeFiniteNumber(v));

    if (xIsNum) {
      const paired = labels
        .map((lbl, idx) => ({ lbl, num: tryParseSmartNumeric(lbl), val: sanitizeFiniteNumber(values[idx]) }))
        .filter((p) => p.num !== null)
        .sort((a, b) => (a.num as number) - (b.num as number));

      if (paired.length > 45) {
        // Bucket numeric X values into 40 clean ordered intervals
        const bucketTotal = 40;
        const step = Math.ceil(paired.length / bucketTotal);
        const outL: string[] = [];
        const outV: number[] = [];
        for (let i = 0; i < paired.length; i += step) {
          const slice = paired.slice(i, i + step);
          outL.push(slice[0].lbl);
          const avg = slice.reduce((acc, s) => acc + s.val, 0) / slice.length;
          outV.push(Number(sanitizeFiniteNumber(avg).toFixed(2)));
        }
        notices.push(`تم ضغط ${formatSmartNum(paired.length, 0)} نقطة رقمية إلى ${outL.length} فترة مرتبة لسهولة القراءة.`);
        labels = outL;
        values = outV;
      } else if (paired.length > 0) {
        labels = paired.map((p) => p.lbl);
        values = paired.map((p) => p.val);
      }
    } else if (labels.length > 35) {
      const capped = capTopCategories(labels, values, 30, effectiveAgg);
      labels = capped.labels;
      values = capped.values;
      notices.push(`تم اختيار أبرز 29 فئة من أصل ${formatSmartNum(agg.labels.length, 0)} لتجنب ازدحام المخطط الخطي.`);
    }

    return {
      kind: 'Line',
      labels: labels.length ? labels : ['لا توجد بيانات'],
      values: values.length ? values.map((v) => sanitizeFiniteNumber(v)) : [0],
      effectiveX: safeX,
      effectiveY,
      effectiveAgg,
      totalGroups: agg.labels.length,
      adaptationNotice: notices.length ? notices.join(' • ') : undefined,
    };
  }

  // ==================== 3. SCATTER (Stride Sampling Across Entire File + Smart Fallback) ====================
  if (chartType === 'Scatter') {
    const notices: string[] = [];
    let effX = safeX;
    let effY = safeY;
    let effXIsNum = xIsNum;
    let effYIsNum = yIsNum;

    if (yIsExplicitlyOmitted || !effY) {
      if (effXIsNum && numericCandidates.length >= 2) {
        effY = numericCandidates.find((c) => c !== effX) || numericCandidates[0];
        effYIsNum = true;
        notices.push(`تم ربط العمود الرقمي "${effY}" كمحور Y تلقائياً مع "${effX}" لعرض التشتت.`);
      } else if (effXIsNum) {
        effY = effX;
        effYIsNum = true;
      }
    }

    if (!effXIsNum && !effYIsNum) {
      if (numericCandidates.length >= 2) {
        effX = numericCandidates[0];
        effY = numericCandidates[1];
        effXIsNum = true;
        effYIsNum = true;
        notices.push(`تم اختيار العمودين الرقميين "${effX}" و "${effY}" تلقائياً لرسم مخطط التشتت.`);
      } else if (numericCandidates.length === 1) {
        effY = numericCandidates[0];
        effYIsNum = true;
        notices.push(`تم ربط العمود الرقمي "${effY}" تلقائياً مقابل ترتيب فئات "${effX}".`);
      } else {
        // Text-only dataset fallback: plot top category frequencies as scatter points!
        const freq = aggregateSmartDataset(ds, safeX, safeX, 'count');
        const topPairs = freq.labels
          .map((l, i) => ({ label: l, val: freq.values[i] }))
          .sort((a, b) => b.val - a.val)
          .slice(0, 40);
        const pts: SmartScatterPoint[] = topPairs.map((p, idx) => ({
          x: idx + 1,
          y: p.val,
          rawLabel: p.label,
        }));
        return {
          kind: 'Scatter',
          points: pts,
          xTitle: `ترتيب الفئات (${safeX})`,
          yTitle: 'عدد التكرارات',
          useNumericX: false,
          xTickLabels: topPairs.map((p) => p.label),
          totalMatchedPoints: freq.labels.length,
          adaptationNotice: 'الملف نصي بالكامل: تم عرض تشتت تكرارات الفئات تلقائياً.',
        };
      }
    }

    const useNumericPair = effXIsNum && effYIsNum;
    const totalRows = ds.rows.length;
    const MAX_SCATTER_POINTS = 900;
    const stride = totalRows > MAX_SCATTER_POINTS ? Math.ceil(totalRows / MAX_SCATTER_POINTS) : 1;

    const points: SmartScatterPoint[] = [];
    let matchedCountEstimate = 0;

    for (let i = 0; i < totalRows; i++) {
      const r = ds.rows[i];
      const parsedY = effY ? tryParseSmartNumeric(r?.[effY]) : null;
      const parsedX = tryParseSmartNumeric(r?.[effX]);

      if (useNumericPair) {
        if (parsedX !== null && parsedY !== null) {
          matchedCountEstimate++;
          if (i % stride === 0 || points.length < 20) {
            if (points.length < MAX_SCATTER_POINTS) {
              points.push({ x: parsedX, y: parsedY, rawLabel: `${effX}: ${formatSmartNum(parsedX)}` });
            }
          }
        }
      } else if (effYIsNum && parsedY !== null) {
        matchedCountEstimate++;
        if (i % stride === 0 && points.length < MAX_SCATTER_POINTS) {
          points.push({
            x: i + 1,
            y: parsedY,
            rawLabel: String(r?.[effX] ?? `#${i + 1}`),
          });
        }
      } else if (effXIsNum && parsedX !== null) {
        matchedCountEstimate++;
        if (i % stride === 0 && points.length < MAX_SCATTER_POINTS) {
          points.push({
            x: i + 1,
            y: parsedX,
            rawLabel: String(effY ? r?.[effY] ?? `#${i + 1}` : `#${i + 1}`),
          });
        }
      }
    }

    if (points.length === 0) {
      // Fallback gracefully when chosen numeric columns contain only missing/dirty cells
      const freq = aggregateSmartDataset(ds, safeX, safeX, 'count');
      const topPairs = freq.labels
        .map((l, i) => ({ label: l, val: sanitizeFiniteNumber(freq.values[i]) }))
        .sort((a, b) => b.val - a.val)
        .slice(0, 40);
      const pts: SmartScatterPoint[] = topPairs.length
        ? topPairs.map((p, idx) => ({ x: idx + 1, y: p.val, rawLabel: p.label }))
        : [{ x: 1, y: 0, rawLabel: 'لا توجد نقاط رقمية صالحة' }];
      notices.push('تعذر إيجاد نقاط رقمية مقترنة في المحورين المحددين؛ تم عرض توزيع التكرارات التلقائي بدون أخطاء.');
      return {
        kind: 'Scatter',
        points: pts,
        xTitle: `توزيع (${safeX})`,
        yTitle: 'عدد السجلات',
        useNumericX: false,
        xTickLabels: topPairs.map((p) => p.label),
        totalMatchedPoints: pts.length,
        adaptationNotice: notices.join(' • '),
      };
    }

    if (stride > 1) {
      notices.push(
        `تم أخذ عينة منتظمة (${formatSmartNum(points.length, 0)} نقطة ممثلة من إجمالي ${formatSmartNum(matchedCountEstimate, 0)} نقطة) لضمان سرعة واستقرار التشتت.`
      );
    }

    const yTitle = !useNumericPair && !effYIsNum && effXIsNum ? effX : effY || 'القيمة';
    const xTitle = useNumericPair ? effX : `تتابع السجلات (${effX})`;

    return {
      kind: 'Scatter',
      points,
      xTitle,
      yTitle,
      useNumericX: useNumericPair,
      totalMatchedPoints: matchedCountEstimate,
      adaptationNotice: notices.length ? notices.join(' • ') : undefined,
    };
  }

  // ==================== 4. HISTOGRAM (Single-Axis Friendly: Y Optional) ====================
  if (chartType === 'Histogram') {
    const notices: string[] = [];
    // If Y is explicitly omitted, prioritize X directly (even categorical X frequency if X is text)
    if (yIsExplicitlyOmitted) {
      if (xIsNum) {
        const hist = computeSmartHistogramBins(ds, safeX);
        if (hist) {
          return {
            kind: 'Histogram',
            labels: hist.labels,
            counts: hist.counts,
            mean: hist.mean,
            targetCol: safeX,
            adaptationNotice: `تم رسم المدرج التكراري لعمود المحور X الرقمي "${safeX}" مباشرة بدون الحاجة لاختيار محور Y.`,
          };
        }
      }
      const freq = aggregateSmartDataset(ds, safeX, safeX, 'count');
      const capped = capTopCategories(freq.labels, freq.values, 15, 'count');
      return {
        kind: 'Histogram',
        labels: capped.labels,
        counts: capped.values,
        mean: capped.values.length ? capped.values.reduce((a, b) => a + b, 0) / capped.values.length : 0,
        targetCol: safeX,
        isCategoricalFrequency: true,
        adaptationNotice: `تم رسم التوزيع التكراري لقيم العمود "${safeX}" مباشرة بدون الحاجة لمحور Y.`,
      };
    }

    const targetCol = yIsNum ? safeY : xIsNum ? safeX : numericCandidates[0] || '';
    if (targetCol && targetCol !== safeY && !yIsNum) {
      notices.push(`تم اختيار العمود الرقمي "${targetCol}" تلقائياً لرسم المدرج التكراري.`);
    }

    if (targetCol) {
      const hist = computeSmartHistogramBins(ds, targetCol);
      if (hist) {
        return {
          kind: 'Histogram',
          labels: hist.labels,
          counts: hist.counts,
          mean: hist.mean,
          targetCol,
          adaptationNotice: notices.length ? notices.join(' • ') : undefined,
        };
      }
    }

    // Pure non-numeric fallback: render frequency histogram of top categories in safeX
    const freq = aggregateSmartDataset(ds, safeX, safeX, 'count');
    const capped = capTopCategories(freq.labels, freq.values, 15, 'count');
    return {
      kind: 'Histogram',
      labels: capped.labels,
      counts: capped.values,
      mean: capped.values.length ? capped.values.reduce((a, b) => a + b, 0) / capped.values.length : 0,
      targetCol: safeX,
      isCategoricalFrequency: true,
      adaptationNotice: `لا توجد أعمدة رقمية كافية: تم عرض التوزيع التكراري لقيم العمود "${safeX}" تلقائياً.`,
    };
  }

  // ==================== 5. BOX PLOT ====================
  const boxY = yIsExplicitlyOmitted
    ? xIsNum
      ? safeX
      : numericCandidates[0] || ''
    : yIsNum
      ? safeY
      : xIsNum
        ? safeX
        : numericCandidates[0] || '';
  const notices: string[] = [];
  if (yIsExplicitlyOmitted && boxY) {
    notices.push(`تم استخدام العمود الرقمي "${boxY}" تلقائياً لحساب الربيعيات والصندوق بدون إجبار اختيار Y.`);
  } else if (boxY && boxY !== safeY && !yIsNum) {
    notices.push(`تم اختيار العمود الرقمي "${boxY}" تلقائياً لحساب الربيعيات والصندوق.`);
  }

  if (boxY) {
    const groups = computeSmartBoxPlotGroups(ds, safeX, boxY);
    if (groups.length) {
      return {
        kind: 'Box Plot',
        groups,
        targetYCol: boxY,
        effectiveX: safeX,
        adaptationNotice: notices.length ? notices.join(' • ') : undefined,
      };
    }
  }

  // Fallback for pure text/PDF datasets without numeric columns: compute distribution of text lengths
  const lengths = ds.rows.map((r) => String(r?.[safeX] ?? '').length).sort((a, b) => a - b);
  const safeLengths = lengths.length ? lengths : [0];
  return {
    kind: 'Box Plot',
    groups: [
      {
        label: `طول نصوص (${safeX})`,
        min: safeLengths[0],
        q1: quantileSorted(safeLengths, 0.25),
        median: quantileSorted(safeLengths, 0.5),
        q3: quantileSorted(safeLengths, 0.75),
        max: safeLengths[safeLengths.length - 1],
        count: safeLengths.length,
      },
    ],
    targetYCol: `طول النص (${safeX})`,
    effectiveX: safeX,
    adaptationNotice: 'الملف لا يحتوي على أرقام خالصة: تم عرض توزيع أطوال النصوص في مخطط الصندوق.',
  };
}
