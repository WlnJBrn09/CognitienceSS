/**
 * Cognitience SS — Row / Column Insert, Delete, Resize, Fill
 */

import { STATE } from './state.js';
import { cellAddr, parseCellAddr, selectionBounds } from './helpers.js';
import { getActiveSheet, getCell, setCellValue, pushUndo, markDirty } from './workbook.js';
import { renderGrid } from './grid-render.js';
import { refreshActiveCell } from './editing.js';

export function insertRow(beforeRow) {
  if (beforeRow === undefined || beforeRow === null) beforeRow = STATE.activeCell.row;
  pushUndo();
  const sheet = getActiveSheet();
  const newCells = {};
  for (const [addr, cell] of Object.entries(sheet.cells)) {
    const parsed = parseCellAddr(addr);
    if (!parsed) continue;
    if (parsed.row >= beforeRow) {
      newCells[cellAddr(parsed.row + 1, parsed.col)] = cell;
    } else {
      newCells[addr] = cell;
    }
  }
  sheet.cells = newCells;
  renderGrid();
  refreshActiveCell();
  markDirty();
}

export function insertColumn(beforeCol) {
  if (beforeCol === undefined || beforeCol === null) beforeCol = STATE.activeCell.col;
  pushUndo();
  const sheet = getActiveSheet();
  const newCells = {};
  for (const [addr, cell] of Object.entries(sheet.cells)) {
    const parsed = parseCellAddr(addr);
    if (!parsed) continue;
    if (parsed.col >= beforeCol) {
      newCells[cellAddr(parsed.row, parsed.col + 1)] = cell;
    } else {
      newCells[addr] = cell;
    }
  }
  sheet.cells = newCells;
  renderGrid();
  refreshActiveCell();
  markDirty();
}

export function deleteRow(row) {
  if (row === undefined || row === null) row = STATE.activeCell.row;
  pushUndo();
  const sheet = getActiveSheet();
  const newCells = {};
  for (const [addr, cell] of Object.entries(sheet.cells)) {
    const parsed = parseCellAddr(addr);
    if (!parsed) continue;
    if (parsed.row === row) continue;
    if (parsed.row > row) {
      newCells[cellAddr(parsed.row - 1, parsed.col)] = cell;
    } else {
      newCells[addr] = cell;
    }
  }
  sheet.cells = newCells;
  renderGrid();
  refreshActiveCell();
  markDirty();
}

export function deleteColumn(col) {
  if (col === undefined || col === null) col = STATE.activeCell.col;
  pushUndo();
  const sheet = getActiveSheet();
  const newCells = {};
  for (const [addr, cell] of Object.entries(sheet.cells)) {
    const parsed = parseCellAddr(addr);
    if (!parsed) continue;
    if (parsed.col === col) continue;
    if (parsed.col > col) {
      newCells[cellAddr(parsed.row, parsed.col - 1)] = cell;
    } else {
      newCells[addr] = cell;
    }
  }
  sheet.cells = newCells;
  renderGrid();
  refreshActiveCell();
  markDirty();
}

export function onColResizeStart(e) {
  e.preventDefault();
  e.stopPropagation();
  const th = e.target.parentElement;
  const col = parseInt(th.dataset.col, 10);
  const startX = e.clientX;
  const startWidth = th.offsetWidth;

  const onMove = (ev) => {
    const diff = ev.clientX - startX;
    const newWidth = Math.max(30, startWidth + diff);
    const sheet = getActiveSheet();
    sheet.colWidths[col] = newWidth;
    th.style.width = newWidth + 'px';
    th.style.minWidth = newWidth + 'px';
  };

  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    markDirty();
    renderGrid();
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

export function onRowResizeStart(e) {
  e.preventDefault();
  e.stopPropagation();
  const th = e.target.parentElement;
  const row = parseInt(th.dataset.row, 10);
  const startY = e.clientY;
  const startHeight = th.offsetHeight;

  const onMove = (ev) => {
    const diff = ev.clientY - startY;
    const newHeight = Math.max(16, startHeight + diff);
    const sheet = getActiveSheet();
    sheet.rowHeights[row] = newHeight;
    th.style.height = newHeight + 'px';
  };

  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    markDirty();
    renderGrid();
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

export function fillDown() {
  pushUndo();
  const sourceCell = getCell(STATE.activeCell.row, STATE.activeCell.col);
  const { minRow, maxRow, minCol, maxCol } = selectionBounds();
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      if (r !== STATE.activeCell.row || c !== STATE.activeCell.col) {
        setCellValue(r, c, sourceCell.value);
      }
    }
  }
  renderGrid();
}

export function fillRight() {
  pushUndo();
  const sourceCell = getCell(STATE.activeCell.row, STATE.activeCell.col);
  const { minRow, maxRow, minCol, maxCol } = selectionBounds();
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      if (r !== STATE.activeCell.row || c !== STATE.activeCell.col) {
        setCellValue(r, c, sourceCell.value);
      }
    }
  }
  renderGrid();
}
