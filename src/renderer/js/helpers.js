/**
 * Cognitience SS — Pure Helper Functions
 */

import { STATE } from './state.js';

export function colToLetter(col) {
  let result = '';
  let c = col;
  while (c >= 0) {
    result = String.fromCharCode(65 + (c % 26)) + result;
    c = Math.floor(c / 26) - 1;
  }
  return result;
}

export function letterToCol(letters) {
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return col - 1;
}

export function cellAddr(row, col) {
  return colToLetter(col) + (row + 1);
}

export function parseCellAddr(addr) {
  const match = String(addr || '').match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return null;
  return { row: parseInt(match[2], 10) - 1, col: letterToCol(match[1].toUpperCase()) };
}

export function uid() {
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Normalized bounds of the current selection (min/max row/col). */
export function selectionBounds() {
  const sel = STATE.selection;
  return {
    minRow: Math.min(sel.startRow, sel.endRow),
    maxRow: Math.max(sel.startRow, sel.endRow),
    minCol: Math.min(sel.startCol, sel.endCol),
    maxCol: Math.max(sel.startCol, sel.endCol),
  };
}

export function isErrorValue(val) {
  return val && typeof val === 'object' && typeof val.type === 'string';
}
