/**
 * Cognitience SS — Workbook / Sheet Data Model
 */

import { STATE, api } from './state.js';
import { cellAddr, parseCellAddr, uid, deepClone } from './helpers.js';
import { evaluateFormula, recalculateAll, setFormulaAccessors } from './formula-engine.js';

export function createEmptyCell() {
  return {
    value: '',
    computed: null,
    format: { type: 'auto', decimalPlaces: 2, currencySymbol: '$', dateFormat: 'MM/DD/YYYY' },
    style: {
      bold: false, italic: false, underline: false, strikethrough: false,
      fontFamily: "'Segoe UI', sans-serif", fontSize: 13,
      fontColor: '', bgColor: '', hAlign: 'auto', vAlign: 'middle', wrap: false,
    },
  };
}

export function createSheet(name) {
  return {
    id: uid(),
    name: name || 'Sheet 1',
    cells: {},
    colWidths: {},
    rowHeights: {},
    frozenRows: 0,
    frozenCols: 0,
    mergedCells: [],
    conditionalFormats: [],
    filters: null,
  };
}

export function createWorkbook(title) {
  const sheets = [];
  for (let i = 0; i < 3; i++) {
    sheets.push(createSheet('Sheet ' + (i + 1)));
  }
  return {
    id: uid(),
    title: title || 'Untitled',
    sheets,
    activeSheetIndex: 0,
    filePath: null,
    isDirty: false,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    metadata: { author: '', subject: '', keywords: [], appVersion: '1.0.0' },
  };
}

export function getActiveSheet() {
  return STATE.workbook.sheets[STATE.activeSheetIndex];
}

export function getCell(row, col) {
  const sheet = getActiveSheet();
  const key = cellAddr(row, col);
  return sheet.cells[key] || createEmptyCell();
}

export function setCell(row, col, cellData) {
  const sheet = getActiveSheet();
  const key = cellAddr(row, col);
  sheet.cells[key] = cellData;
  markDirty();
}

/** Sets computed value only, without marking the document dirty (used during recalculation). */
function setComputedOnly(row, col, value) {
  const sheet = getActiveSheet();
  const key = cellAddr(row, col);
  const cell = sheet.cells[key];
  if (cell) cell.computed = value;
}

export function setCellValue(row, col, value) {
  const cell = getCell(row, col);
  cell.value = String(value);
  if (typeof value === 'string' && value.startsWith('=')) {
    cell.computed = evaluateFormula(value);
  } else {
    const num = Number(value);
    cell.computed = (value !== '' && !isNaN(num)) ? num : value;
  }
  setCell(row, col, cell);
  recalculateAll(getCell, setComputedOnly, getActiveSheet().cells);
}

export function markDirty() {
  if (!STATE.workbook) return;
  STATE.dirty = true;
  STATE.workbook.isDirty = true;
  STATE.workbook.modifiedAt = new Date().toISOString();
  scheduleAutoSave();
}

export function scheduleAutoSave() {
  if (!STATE.autoSaveEnabled) return;
  if (STATE.autoSaveTimer) clearTimeout(STATE.autoSaveTimer);
  STATE.autoSaveTimer = setTimeout(() => autoSave(), 3000);
}

export async function autoSave() {
  if (!STATE.autoSaveEnabled) return;
  if (!STATE.dirty || !STATE.workbook || !STATE.workbook.filePath) return;
  try {
    await api.sheet.save({
      content: JSON.stringify(STATE.workbook),
      filePath: STATE.workbook.filePath,
      title: STATE.workbook.title,
    });
    STATE.dirty = false;
    STATE.workbook.isDirty = false;
  } catch (e) {
    console.error('[Cognitience SS] Auto-save failed:', e);
  }
}

// ─── Undo / Redo ────────────────────────────────────────────────────

export function pushUndo() {
  STATE.undoStack.push(deepClone(STATE.workbook));
  if (STATE.undoStack.length > STATE.maxUndo) STATE.undoStack.shift();
  STATE.redoStack = [];
}

export function undo() {
  if (STATE.undoStack.length === 0) return false;
  STATE.redoStack.push(deepClone(STATE.workbook));
  STATE.workbook = STATE.undoStack.pop();
  markDirty();
  return true;
}

export function redo() {
  if (STATE.redoStack.length === 0) return false;
  STATE.undoStack.push(deepClone(STATE.workbook));
  STATE.workbook = STATE.redoStack.pop();
  markDirty();
  return true;
}

// ─── Wire formula engine accessors to the live workbook ────────────

setFormulaAccessors({
  getCell: (row, col) => getCell(row, col),
  getActiveSheetCells: () => getActiveSheet().cells,
});
