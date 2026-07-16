/**
 * Cognitience SS — Shared Types
 * Common interfaces used across main process, renderer, and shared modules.
 */

// ─── Spreadsheet Types ───────────────────────────────────────────

export interface CellAddress {
  row: number;
  col: number;
}

export interface CellData {
  value: string;         // Raw value as entered (e.g., "=SUM(A1:A5)" or "42")
  computed: CellValue;   // Computed result (e.g., 42, "hello", or #REF!)
  format: CellFormat;
  style: CellStyle;
}

export type CellValue = string | number | boolean | null | ErrorValue;

export interface ErrorValue {
  type: '#REF!' | '#NAME?' | '#VALUE!' | '#DIV/0!' | '#N/A' | '#NUM!' | '#NULL!';
  message: string;
}

export interface CellFormat {
  type: 'auto' | 'number' | 'currency' | 'percent' | 'date' | 'text' | 'scientific';
  decimalPlaces: number;
  currencySymbol: string;
  dateFormat: string;
}

export interface CellStyle {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  bgColor: string;
  hAlign: 'left' | 'center' | 'right' | 'auto';
  vAlign: 'top' | 'middle' | 'bottom';
  wrap: boolean;
}

export interface SheetData {
  id: string;
  name: string;
  cells: Record<string, CellData>;   // Key: "A1", "B2", etc.
  colWidths: Record<number, number>; // Key: col index
  rowHeights: Record<number, number>;
  frozenRows: number;
  frozenCols: number;
  mergedCells: MergedCellRange[];
  conditionalFormats: ConditionalFormat[];
  filters: AutoFilter | null;
}

export interface MergedCellRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface ConditionalFormat {
  range: string;          // e.g., "A1:D10"
  condition: FormatCondition;
  style: Partial<CellStyle>;
}

export interface FormatCondition {
  type: 'greaterThan' | 'lessThan' | 'equalTo' | 'between' | 'textContains' | 'duplicate' | 'formula';
  value1: string;
  value2?: string;
}

export interface AutoFilter {
  range: string;
  columnFilters: Record<number, string[]>;
}

export interface WorkbookData {
  id: string;
  title: string;
  sheets: SheetData[];
  activeSheetIndex: number;
  filePath: string | null;
  isDirty: boolean;
  createdAt: string;
  modifiedAt: string;
  metadata: WorkbookMetadata;
}

export interface WorkbookMetadata {
  author: string;
  subject: string;
  keywords: string[];
  appVersion: string;
}

// ─── Selection Types ──────────────────────────────────────────────

export interface SelectionState {
  activeCell: CellAddress;
  selectionRange: CellRange;
  isSelecting: boolean;
}

export interface CellRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

// ─── Document Stats ───────────────────────────────────────────────

export interface SheetStats {
  cellCount: number;
  filledCells: number;
  formulaCount: number;
  sheetCount: number;
  rowCount: number;
  colCount: number;
}

// ─── Export Request ───────────────────────────────────────────────

export interface ExportRequest {
  format: 'cogss' | 'csv' | 'tsv' | 'xlsx' | 'json' | 'html' | 'pdf';
  content: string;
  title: string;
  window?: any;
}
