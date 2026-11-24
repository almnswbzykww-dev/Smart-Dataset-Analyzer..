export type ChartType = 'Bar' | 'Line' | 'Pie' | 'Scatter' | 'Histogram' | 'Box Plot';

export type AggMode = 'sum' | 'avg' | 'count' | 'max' | 'min';

export const CHART_TYPE_LABELS_AR: Record<ChartType, string> = {
  Bar: 'مخطط الأعمدة',
  Line: 'المخطط الخطي',
  Pie: 'المخطط الدائري',
  Scatter: 'مخطط التشتت (النقاط)',
  Histogram: 'المدرج التكراري',
  'Box Plot': 'مخطط الصندوق (الربيعيات)',
};

export const AGG_MODE_LABELS_AR: Record<AggMode, string> = {
  sum: 'المجموع',
  avg: 'المتوسط',
  count: 'العدد',
  max: 'أعلى قيمة',
  min: 'أدنى قيمة',
};

export type PageType =
  | 'dashboard'
  | 'studio'
  | 'stats'
  | 'reports'
  | 'details'
  | 'loader'
  | 'settings'
  | 'about';

export type DatasetRow = Record<string, string | number>;

export type ColumnKind = 'numeric' | 'date' | 'text';

export interface DatasetCleaningSummary {
  missingHandledCount: number;
  numericNormalizedCount: number;
  datesNormalizedCount: number;
  duplicateRowsCount: number;
  originalRowsPreserved: boolean;
}

export interface Dataset {
  id: string;
  label: string;
  name: string;
  rowsCount: number;
  colsCount: number;
  columns: string[];
  numericCols: string[];
  dateCols?: string[];
  catCols: string[];
  columnTypes?: Record<string, ColumnKind>;
  defaultX: string;
  defaultY: string;
  rows: DatasetRow[];
  isCustom?: boolean;
  fileSizeBytes?: number;
  sourceFormat?: 'Excel' | 'CSV' | 'PDF' | 'JSON' | 'Sample';
  sheetName?: string;
  sheetNames?: string[];
  cleaningSummary?: DatasetCleaningSummary;
}

export interface PageInstance {
  instanceId: string;
  type: PageType;
  title: string;
  datasetKey: string;
  xCol: string;
  yCol: string;
  aggMode: AggMode;
  chartType: ChartType;
  catFilter: string;
  search: string;
}

export interface CompanySettings {
  companyName: string;
  location: string;
  address: string;
  logoDataUrl: string;
  updatedAtIso?: string;
}

export interface SavedAnalysisRecord {
  id: string;
  ownerId: string;
  title: string;
  pageType: Exclude<PageType, 'settings' | 'about'>;
  datasetName: string;
  xCol: string;
  yCol: string;
  chartType: ChartType;
  aggMode: AggMode;
  rowCount: number;
  colCount: number;
  summaryText: string;
  createdAtIso: string;
}

export interface UserProfileRecord {
  uid: string;
  displayName: string;
  email: string;
  phone?: string;
  provider: string;
}

export interface PrintPayload {
  kind: 'report' | 'data' | 'chart';
  title: string;
  subtitle?: string;
  chartImageDataUrl?: string;
  summaryPairs?: Array<{ name: string; value: string }>;
  tableHeaders?: string[];
  tableRows?: Array<Array<string | number>>;
  notes?: string;
}
