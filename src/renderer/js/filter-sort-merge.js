/**
 * Cognitience SS — Merge Cells, Sort, Filter
 */

import { STATE } from './state.js';
import { colToLetter, selectionBounds, deepClone } from './helpers.js';
import { getActiveSheet, getCell, setCell, pushUndo, markDirty } from './workbook.js';
import { renderGrid } from './grid-render.js';
import { notify } from './ui-chrome.js';

export function mergeCells() {
  const sheet = getActiveSheet();
  const { minRow, maxRow, minCol, maxCol } = selectionBounds();
  if (minRow === maxRow && minCol === maxCol) {
    notify('Select multiple cells to merge', 'warning');
    return;
  }
  pushUndo();
  const existingIndex = sheet.mergedCells.findIndex(
    (m) => m.startRow === minRow && m.startCol === minCol && m.endRow === maxRow && m.endCol === maxCol
  );
  if (existingIndex !== -1) {
    sheet.mergedCells.splice(existingIndex, 1);
    notify('Cells unmerged', 'info');
  } else {
    sheet.mergedCells = sheet.mergedCells.filter(
      (m) => !(m.startRow <= maxRow && m.endRow >= minRow && m.startCol <= maxCol && m.endCol >= minCol)
    );
    sheet.mergedCells.push({ startRow: minRow, startCol: minCol, endRow: maxRow, endCol: maxCol });
    notify('Cells merged', 'info');
  }
  markDirty();
  renderGrid();
}

export function sortSelection(direction = 'asc') {
  const { minRow, maxRow, minCol, maxCol } = selectionBounds();
  if (minRow === maxRow) {
    notify('Select multiple rows to sort', 'warning');
    return;
  }
  pushUndo();

  const sortCol = (STATE.activeCell.col >= minCol && STATE.activeCell.col <= maxCol) ? STATE.activeCell.col : minCol;

  const rows = [];
  for (let r = minRow; r <= maxRow; r++) {
    const rowCells = [];
    for (let c = minCol; c <= maxCol; c++) {
      rowCells.push(deepClone(getCell(r, c)));
    }
    rows.push(rowCells);
  }

  const keyIndex = sortCol - minCol;
  rows.sort((a, b) => {
    const av = a[keyIndex]?.computed;
    const bv = b[keyIndex]?.computed;
    const an = Number(av), bn = Number(bv);
    let cmp;
    if (av !== null && av !== '' && bv !== null && bv !== '' && !isNaN(an) && !isNaN(bn)) {
      cmp = an - bn;
    } else {
      cmp = String(av ?? '').localeCompare(String(bv ?? ''));
    }
    return direction === 'desc' ? -cmp : cmp;
  });

  for (let i = 0; i < rows.length; i++) {
    const r = minRow + i;
    for (let j = 0; j < rows[i].length; j++) {
      const c = minCol + j;
      setCell(r, c, rows[i][j]);
    }
  }

  renderGrid();
  notify('Sorted ' + (direction === 'desc' ? 'Z→A' : 'A→Z'), 'info');
}

export function toggleFilter() {
  const sheet = getActiveSheet();
  if (sheet.filters) {
    removeFilter();
    return;
  }
  const { minRow, maxRow, minCol, maxCol } = selectionBounds();
  const col = STATE.activeCell.col;
  const text = prompt(`Filter column ${colToLetter(col)} — show rows containing:`, '');
  if (text === null) return;

  const criteria = {};
  if (text.trim()) criteria[col] = text.trim();
  sheet.filters = { startRow: minRow, endRow: maxRow, startCol: minCol, endCol: maxCol, criteria };
  STATE.filterActive = true;
  markDirty();
  renderGrid();
  notify('Filter applied', 'info');
}

export function removeFilter() {
  const sheet = getActiveSheet();
  sheet.filters = null;
  STATE.filterActive = false;
  markDirty();
  renderGrid();
  notify('Filter removed', 'info');
}
