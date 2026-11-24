export type OfflineChartType = 'Bar' | 'Line' | 'Pie' | 'Scatter' | 'Histogram' | 'Box Plot';

export type OfflineAggMode = 'sum' | 'avg' | 'count' | 'max' | 'min';

export const OFFLINE_CHART_LABELS_AR: Record<OfflineChartType, string> = {
  Bar: 'مخطط الأعمدة',
  Line: 'المخطط الخطي',
  Pie: 'المخطط الدائري',
  Scatter: 'مخطط التشتت (النقاط)',
  Histogram: 'المدرج التكراري',
  'Box Plot': 'مخطط الصندوق (الربيعيات)',
};

export const OFFLINE_AGG_LABELS_AR: Record<OfflineAggMode, string> = {
  sum: 'المجموع',
  avg: 'المتوسط',
  count: 'العدد',
  max: 'أعلى قيمة',
  min: 'أدنى قيمة',
};

export type OfflinePageType =
  | 'dashboard'
  | 'studio'
  | 'stats'
  | 'reports'
  | 'details'
  | 'loader'
  | 'settings'
  | 'about';

export type OfflineDatasetRow = Record<string, string | number>;

export type OfflineColumnKind = 'numeric' | 'date' | 'text';

export interface OfflineCleaningSummary {
  missingHandledCount: number;
  numericNormalizedCount: number;
  datesNormalizedCount: number;
  duplicateRowsCount: number;
  originalRowsPreserved: boolean;
}

export interface OfflineDataset {
  id: string;
  label: string;
  name: string;
  rowsCount: number;
  colsCount: number;
  columns: string[];
  numericCols: string[];
  dateCols?: string[];
  catCols: string[];
  columnTypes?: Record<string, OfflineColumnKind>;
  defaultX: string;
  defaultY: string;
  rows: OfflineDatasetRow[];
  isCustom?: boolean;
  savedAtIso?: string;
  fileSizeBytes?: number;
  sourceFormat?: 'Excel' | 'CSV' | 'PDF' | 'JSON' | 'Sample';
  sheetName?: string;
  sheetNames?: string[];
  cleaningSummary?: OfflineCleaningSummary;
}

export interface OfflinePageInstance {
  instanceId: string;
  type: OfflinePageType;
  title: string;
  datasetKey: string;
  xCol: string;
  yCol: string;
  aggMode: OfflineAggMode;
  chartType: OfflineChartType;
  catFilter: string;
  search: string;
}

export interface OfflineCompanySettings {
  companyName: string;
  location: string;
  address: string;
  logoDataUrl: string;
  updatedAtIso?: string;
}

export interface OfflineSavedAnalysis {
  id: string;
  ownerId: string;
  title: string;
  pageType: Exclude<OfflinePageType, 'settings' | 'about'>;
  datasetName: string;
  xCol: string;
  yCol: string;
  chartType: OfflineChartType;
  aggMode: OfflineAggMode;
  rowCount: number;
  colCount: number;
  summaryText: string;
  createdAtIso: string;
}

export interface OfflineUserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone?: string;
  role: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface OfflinePrintPayload {
  kind: 'report' | 'data' | 'chart';
  title: string;
  subtitle?: string;
  chartImageDataUrl?: string;
  summaryPairs?: Array<{ name: string; value: string }>;
  tableHeaders?: string[];
  tableRows?: Array<Array<string | number>>;
  notes?: string;
}

export interface OfflineDatabaseBackup {
  version: number;
  exportedAtIso: string;
  app: string;
  customDatasets: OfflineDataset[];
  savedAnalyses: OfflineSavedAnalysis[];
  company: OfflineCompanySettings;
  userProfile: OfflineUserProfile | null;
}
