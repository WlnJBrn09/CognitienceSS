/**
 * Cognitience SS — Freeze Panes
 */

import { STATE } from './state.js';
import { cellAddr } from './helpers.js';
import { getActiveSheet, markDirty } from './workbook.js';
import { renderGrid } from './grid-render.js';
import { notify } from './ui-chrome.js';

export function toggleFreezePanes() {
  const sheet = getActiveSheet();
  const { row, col } = STATE.activeCell;

  if ((sheet.frozenRows || 0) === row && (sheet.frozenCols || 0) === col) {
    sheet.frozenRows = 0;
    sheet.frozenCols = 0;
    notify('Freeze panes removed', 'info');
  } else {
    sheet.frozenRows = row;
    sheet.frozenCols = col;
    notify(`Freeze panes set at ${cellAddr(row, col)}`, 'info');
  }
  markDirty();
  renderGrid();
}
