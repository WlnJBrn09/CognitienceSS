/**
 * Cognitience SS — Shared Constants
 * Application-wide constants for window bounds, file extensions, default settings,
 * IPC channel names, and document format metadata.
 */

export const APP_NAME = 'Cognitience SS';
export const APP_PUBLISHER = 'Maq-Swarm';
export const APP_VERSION = '1.0.0';

// ─── Window Defaults ─────────────────────────────────────────

export const DEFAULT_WINDOW_WIDTH = 1280;
export const DEFAULT_WINDOW_HEIGHT = 800;
export const MIN_WINDOW_WIDTH = 720;
export const MIN_WINDOW_HEIGHT = 480;
export const TITLE_BAR_HEIGHT = 36;

// ─── Spreadsheet Defaults ────────────────────────────────────

export const DEFAULT_ROWS = 1000;
export const DEFAULT_COLS = 26;
export const MAX_ROWS = 100000;
export const MAX_COLS = 702; // A..ZZ
export const DEFAULT_COL_WIDTH = 100;
export const DEFAULT_ROW_HEIGHT = 24;
export const MIN_COL_WIDTH = 30;
export const MIN_ROW_HEIGHT = 16;

// ─── File Extensions ─────────────────────────────────────────

export const NATIVE_EXTENSION = 'cogss';
export const SUPPORTED_IMPORT_EXTENSIONS = ['cogss', 'csv', 'tsv', 'xlsx', 'xls', 'ods', 'json', 'html'];
export const SUPPORTED_EXPORT_EXTENSIONS = ['cogss', 'csv', 'tsv', 'xlsx', 'json', 'html', 'pdf'];

// ─── Document Format ─────────────────────────────────────────

export const COGNITIENCE_DOC_FORMAT = {
  magic: 'COGSS',
  version: '1.0.0',
  format: 'cognitience-ss',
} as const;

// ─── GitHub URLs ─────────────────────────────────────────────

export const GITHUB_REPO = 'Maq-Swarm/cognitience-ss';
export const GITHUB_LATEST_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
export const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;

// ─── Default Configuration ───────────────────────────────────

export const DEFAULT_CONFIG: Record<string, unknown> = {
  'theme.current': 'cognitience-light',
  'editor.autoSave': true,
  'editor.autoSaveDelay': 3000,
  'editor.showGridLines': true,
  'editor.showFormulas': false,
  'editor.showRowNumbers': true,
  'editor.showColumnHeaders': true,
  'editor.defaultColWidth': DEFAULT_COL_WIDTH,
  'editor.defaultRowHeight': DEFAULT_ROW_HEIGHT,
  'editor.fontSize': 13,
  'editor.fontFamily': "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  'editor.formulaFontSize': 13,
  'editor.tabSize': 2,
  'editor.recentFiles': [],
  'editor.maxRecentFiles': 10,
  'editor.defaultSheetCount': 3,
  'editor.undoLimit': 100,
  'editor.showStatusBar': true,
  'editor.showFormulaBar': true,
};

// ─── Built-in Themes ─────────────────────────────────────────

export const BUILTIN_THEMES = [
  { id: 'cognitience-dark', label: 'Cognitience Dark', type: 'dark' as const },
  { id: 'cognitience-light', label: 'Cognitience Light', type: 'light' as const },
  { id: 'cognitience-sepia', label: 'Cognitience Sepia', type: 'light' as const },
  { id: 'cognitience-contrast-dark', label: 'High Contrast Dark', type: 'dark' as const },
];

// ─── IPC Channel Names ───────────────────────────────────────

export const IPC_CHANNELS = {
  // Spreadsheet operations
  SHEET_NEW: 'sheet:new',
  SHEET_OPEN: 'sheet:open',
  SHEET_SAVE: 'sheet:save',
  SHEET_SAVE_AS: 'sheet:saveAs',
  SHEET_EXPORT: 'sheet:export',
  SHEET_IMPORT: 'sheet:import',
  SHEET_GET_STATS: 'sheet:getStats',

  // Configuration
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_GET_ALL: 'config:getAll',

  // Theme
  THEME_GET: 'theme:get',
  THEME_SET: 'theme:set',
  THEME_LIST: 'theme:list',

  // Clipboard
  CLIPBOARD_WRITE: 'clipboard:write',
  CLIPBOARD_READ: 'clipboard:read',

  // File system
  FS_READ: 'fs:read',
  FS_WRITE: 'fs:write',
  FS_EXISTS: 'fs:exists',
  FS_MKDIR: 'fs:mkdir',

  // Window
  WIN_MINIMIZE: 'win:minimize',
  WIN_MAXIMIZE: 'win:maximize',
  WIN_CLOSE: 'win:close',
  WIN_FULLSCREEN: 'win:fullscreen',

  // Updates
  UPDATES_CHECK: 'updates:check',
  UPDATES_DOWNLOAD: 'updates:downloadAndInstall',
} as const;
