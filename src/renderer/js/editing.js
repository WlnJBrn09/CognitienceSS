/**
 * Cognitience SS — Cell Editing
 */

import { STATE } from './state.js';
import { cellAddr } from './helpers.js';
import { getCell, setCellValue, pushUndo } from './workbook.js';
import { renderGrid } from './grid-render.js';
import { updateTitle, updateRightPanel } from './ui-chrome.js';

export function startEditing(row, col) {
  STATE.isEditing = true;
  STATE.editingCell = { row, col };

  const cell = getCell(row, col);
  const formulaInput = document.getElementById('formula-input');
  if (formulaInput) {
    formulaInput.value = cell.value || '';
    formulaInput.focus();
  }
}

export function finishEditing() {
  if (!STATE.isEditing || !STATE.editingCell) return;

  const formulaInput = document.getElementById('formula-input');
  const value = formulaInput ? formulaInput.value : '';
  const { row, col } = STATE.editingCell;

  pushUndo();
  setCellValue(row, col, value);

  STATE.isEditing = false;
  STATE.editingCell = null;
  renderGrid();
  updateTitle();
}

export function cancelEditing() {
  STATE.isEditing = false;
  STATE.editingCell = null;
  refreshActiveCell();
}

export function refreshActiveCell() {
  const addr = cellAddr(STATE.activeCell.row, STATE.activeCell.col);
  const addrInput = document.getElementById('cell-address');
  if (addrInput) addrInput.value = addr;

  const cell = getCell(STATE.activeCell.row, STATE.activeCell.col);
  const formulaInput = document.getElementById('formula-input');
  if (formulaInput && !STATE.isEditing) {
    formulaInput.value = cell.value || '';
  }

  const btnBold = document.getElementById('btn-bold');
  const btnItalic = document.getElementById('btn-italic');
  const btnUnderline = document.getElementById('btn-underline');
  const btnStrike = document.getElementById('btn-strikethrough');
  if (btnBold) btnBold.classList.toggle('active', !!cell.style?.bold);
  if (btnItalic) btnItalic.classList.toggle('active', !!cell.style?.italic);
  if (btnUnderline) btnUnderline.classList.toggle('active', !!cell.style?.underline);
  if (btnStrike) btnStrike.classList.toggle('active', !!cell.style?.strikethrough);

  const fontFam = document.getElementById('font-family-select') || document.getElementById('font-family');
  const fontSz = document.getElementById('font-size-input') || document.getElementById('font-size');
  if (fontFam && cell.style?.fontFamily) fontFam.value = cell.style.fontFamily;
  if (fontSz && cell.style?.fontSize) fontSz.value = cell.style.fontSize;

  updateRightPanel();
}

export function getCellType(cell) {
  if (!cell || cell.value === '') return 'Empty';
  if (typeof cell.value === 'string' && cell.value.startsWith('=')) return 'Formula';
  if (cell.computed && typeof cell.computed === 'object' && cell.computed.type) return 'Error';
  if (typeof cell.computed === 'number') return 'Number';
  if (typeof cell.computed === 'boolean') return 'Boolean';
  return 'Text';
}
