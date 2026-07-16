/**
 * Cognitience SS — Clipboard (copy / cut / paste)
 */

import { STATE, INITIAL_ROWS, INITIAL_COLS } from './state.js';
import { cellAddr, parseCellAddr, deepClone, selectionBounds } from './helpers.js';
import { getCell, setCellValue, pushUndo } from './workbook.js';
import { renderGrid } from './grid-render.js';
import { notify } from './ui-chrome.js';

export function captureSelection() {
  const { minRow, maxRow, minCol, maxCol } = selectionBounds();
  const cells = {};
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const cell = getCell(r, c);
      if (cell.value !== '') {
        cells[cellAddr(r, c)] = deepClone(cell);
      }
    }
  }
  return { startRow: minRow, startCol: minCol, cells };
}

export function copyCells() {
  STATE.clipboard = captureSelection();
  STATE.clipboardMode = 'copy';
  notify('Copied', 'info');
}

export function cutCells() {
  STATE.clipboard = captureSelection();
  STATE.clipboardMode = 'cut';
  notify('Cut', 'info');
}

export function pasteCells() {
  if (!STATE.clipboard) return;
  pushUndo();

  const offsetRow = STATE.activeCell.row - STATE.clipboard.startRow;
  const offsetCol = STATE.activeCell.col - STATE.clipboard.startCol;

  for (const [addr, cell] of Object.entries(STATE.clipboard.cells)) {
    const parsed = parseCellAddr(addr);
    if (!parsed) continue;
    const newRow = parsed.row + offsetRow;
    const newCol = parsed.col + offsetCol;
    if (newRow >= 0 && newRow < INITIAL_ROWS && newCol >= 0 && newCol < INITIAL_COLS) {
      setCellValue(newRow, newCol, cell.value);
    }
  }

  if (STATE.clipboardMode === 'cut') {
    for (const addr of Object.keys(STATE.clipboard.cells)) {
      const parsed = parseCellAddr(addr);
      if (parsed) setCellValue(parsed.row, parsed.col, '');
    }
    STATE.clipboard = null;
  }

  renderGrid();
  notify('Pasted', 'info');
}
