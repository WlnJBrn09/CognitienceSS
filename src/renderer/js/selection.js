/**
 * Cognitience SS — Selection & Cell Interaction
 */

import { STATE, INITIAL_ROWS, INITIAL_COLS } from './state.js';
import { selectionBounds } from './helpers.js';
import { setCellValue, pushUndo } from './workbook.js';
import { renderGrid } from './grid-render.js';
import { finishEditing, startEditing, refreshActiveCell } from './editing.js';
import { updateStatusBar, showContextMenu, updateRightPanel } from './ui-chrome.js';

export function onCellMouseDown(e) {
  if (e.button !== 0) return;
  const row = parseInt(e.target.dataset.row, 10);
  const col = parseInt(e.target.dataset.col, 10);
  if (isNaN(row) || isNaN(col)) return;

  if (e.shiftKey) {
    STATE.selection.endRow = row;
    STATE.selection.endCol = col;
  } else {
    STATE.activeCell = { row, col };
    STATE.selection = { startRow: row, startCol: col, endRow: row, endCol: col };
  }
  STATE.isSelecting = true;

  if (STATE.isEditing) finishEditing();
  renderGrid();
  refreshActiveCell();
  updateStatusBar();
}

export function onCellMouseOver(e) {
  if (!STATE.isSelecting) return;
  const row = parseInt(e.target.dataset.row, 10);
  const col = parseInt(e.target.dataset.col, 10);
  if (isNaN(row) || isNaN(col)) return;
  STATE.selection.endRow = row;
  STATE.selection.endCol = col;
  renderGrid();
  updateStatusBar();
}

export function onCellDblClick(e) {
  const row = parseInt(e.target.dataset.row, 10);
  const col = parseInt(e.target.dataset.col, 10);
  if (isNaN(row) || isNaN(col)) return;
  startEditing(row, col);
}

export function onCellContextMenu(e) {
  e.preventDefault();
  const row = parseInt(e.target.dataset.row, 10);
  const col = parseInt(e.target.dataset.col, 10);
  showContextMenu(e.clientX, e.clientY, row, col);
}

document.addEventListener('mouseup', () => {
  STATE.isSelecting = false;
});

export function moveActiveCell(dRow, dCol, extendSelection = false) {
  const newRow = Math.max(0, Math.min(INITIAL_ROWS - 1, STATE.activeCell.row + dRow));
  const newCol = Math.max(0, Math.min(INITIAL_COLS - 1, STATE.activeCell.col + dCol));

  if (extendSelection) {
    STATE.selection.endRow = newRow;
    STATE.selection.endCol = newCol;
  } else {
    STATE.activeCell = { row: newRow, col: newCol };
    STATE.selection = { startRow: newRow, startCol: newCol, endRow: newRow, endCol: newCol };
  }

  renderGrid();
  refreshActiveCell();
  updateStatusBar();
  scrollToActiveCell();
}

export function scrollToActiveCell() {
  const td = document.querySelector(`#grid-table td[data-row="${STATE.activeCell.row}"][data-col="${STATE.activeCell.col}"]`);
  if (td) td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

export function deleteSelectedCells() {
  pushUndo();
  const { minRow, maxRow, minCol, maxCol } = selectionBounds();
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      setCellValue(r, c, '');
    }
  }
  renderGrid();
  refreshActiveCell();
  updateStatusBar();
  updateRightPanel();
}
