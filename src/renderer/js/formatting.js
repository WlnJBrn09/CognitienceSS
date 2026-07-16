/**
 * Cognitience SS — Cell Formatting
 */

import { INITIAL_ROWS, INITIAL_COLS, DEFAULT_ROW_HEIGHT } from './state.js';
import { selectionBounds, isErrorValue } from './helpers.js';
import { getCell, setCell, pushUndo, getActiveSheet } from './workbook.js';
import { renderGrid, formatCellValue } from './grid-render.js';
import { refreshActiveCell } from './editing.js';

export function forEachSelectedCell(callback) {
  const { minRow, maxRow, minCol, maxCol } = selectionBounds();
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      callback(r, c, getCell(r, c));
    }
  }
}

export function applyStyle(prop) {
  pushUndo();
  forEachSelectedCell((row, col, cell) => {
    cell.style[prop] = !cell.style[prop];
    setCell(row, col, cell);
  });
  renderGrid();
  refreshActiveCell();
}

export function applyAlign(align) {
  pushUndo();
  forEachSelectedCell((row, col, cell) => {
    cell.style.hAlign = align;
    setCell(row, col, cell);
  });
  renderGrid();
  refreshActiveCell();
}

export function applyFont(fontFamily) {
  pushUndo();
  forEachSelectedCell((row, col, cell) => {
    cell.style.fontFamily = fontFamily;
    setCell(row, col, cell);
  });
  renderGrid();
}

export function applyFontSize(fontSize) {
  pushUndo();
  forEachSelectedCell((row, col, cell) => {
    cell.style.fontSize = fontSize;
    setCell(row, col, cell);
  });
  renderGrid();
}

export function applyNumberFormat(formatType) {
  pushUndo();
  forEachSelectedCell((row, col, cell) => {
    cell.format.type = formatType;
    setCell(row, col, cell);
  });
  renderGrid();
}

export function applyTextColor(color) {
  pushUndo();
  forEachSelectedCell((row, col, cell) => {
    cell.style.fontColor = color;
    setCell(row, col, cell);
  });
  renderGrid();
}

export function applyBgColor(color) {
  pushUndo();
  forEachSelectedCell((row, col, cell) => {
    cell.style.bgColor = color;
    setCell(row, col, cell);
  });
  renderGrid();
}

/** Increases/decreases decimal places shown for numeric formats by `delta`. */
export function applyDecimal(delta) {
  pushUndo();
  forEachSelectedCell((row, col, cell) => {
    const current = typeof cell.format.decimalPlaces === 'number' ? cell.format.decimalPlaces : 2;
    cell.format.decimalPlaces = Math.max(0, Math.min(10, current + delta));
    if (cell.format.type === 'auto') cell.format.type = 'number';
    setCell(row, col, cell);
  });
  renderGrid();
}

let _measureCtx = null;
function measureText(text, font) {
  if (!_measureCtx) {
    const canvas = document.createElement('canvas');
    _measureCtx = canvas.getContext('2d');
  }
  _measureCtx.font = font;
  return _measureCtx.measureText(text).width;
}

export function autoFitCol(col) {
  const sheet = getActiveSheet();
  let maxWidth = 40;
  for (let r = 0; r < INITIAL_ROWS; r++) {
    const cell = getCell(r, col);
    if (!cell || cell.value === '') continue;
    const computed = cell.computed;
    const text = isErrorValue(computed) ? computed.type : formatCellValue(computed, cell.format) || String(cell.value || '');
    const font = `${cell.style?.fontSize || 13}px ${cell.style?.fontFamily || 'Segoe UI'}`;
    const width = measureText(text, font) + 20;
    if (width > maxWidth) maxWidth = width;
  }
  sheet.colWidths[col] = Math.min(400, Math.max(30, Math.round(maxWidth)));
  renderGrid();
}

export function autoFitRow(row) {
  const sheet = getActiveSheet();
  let maxHeight = DEFAULT_ROW_HEIGHT;
  for (let c = 0; c < INITIAL_COLS; c++) {
    const cell = getCell(row, c);
    if (!cell || cell.value === '') continue;
    const fontSize = cell.style?.fontSize || 13;
    const lineHeight = Math.round(fontSize * 1.6) + 8;
    if (lineHeight > maxHeight) maxHeight = lineHeight;
  }
  sheet.rowHeights[row] = maxHeight;
  renderGrid();
}
