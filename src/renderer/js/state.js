/**
 * Cognitience SS — Global State & Constants
 */

export const api = window.cognitience;

export const DEFAULT_COL_WIDTH = 100;
export const DEFAULT_ROW_HEIGHT = 24;
export const INITIAL_ROWS = 50;
export const INITIAL_COLS = 26;

export const STATE = {
  workbook: null,
  activeSheetIndex: 0,
  activeCell: { row: 0, col: 0 },
  selection: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
  isSelecting: false,
  isEditing: false,
  editingCell: null,
  showGridLines: true,
  showFormulas: false,
  zoom: 100,
  clipboard: null,
  clipboardMode: null, // 'copy' | 'cut'
  undoStack: [],
  redoStack: [],
  maxUndo: 100,
  autoSaveTimer: null,
  dirty: false,
  autoSaveEnabled: true,
  filterActive: false,
  findMatches: [],
  findIndex: -1,
  recentFiles: [],
  currentFolder: null,
  folderFiles: [],
};
