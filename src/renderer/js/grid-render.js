/**
 * Cognitience SS — Grid Rendering
 */

import { STATE, INITIAL_ROWS, INITIAL_COLS, DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT } from './state.js';
import { colToLetter, cellAddr, escapeHtml, isErrorValue } from './helpers.js';
import { getActiveSheet } from './workbook.js';
import { onCellMouseDown, onCellMouseOver, onCellDblClick, onCellContextMenu } from './selection.js';
import { onColResizeStart, onRowResizeStart } from './rows-cols.js';

/** Returns the set of row indices hidden by the active filter, and a helper for merge lookups. */
function computeHiddenRows(sheet) {
  const hidden = new Set();
  const filter = sheet.filters;
  if (!filter) return hidden;
  const { startRow, endRow, startCol, endCol, criteria } = filter;
  if (!criteria || Object.keys(criteria).length === 0) return hidden;
  for (let r = startRow + 1; r <= endRow; r++) {
    let matches = true;
    for (const colStr of Object.keys(criteria)) {
      const col = parseInt(colStr, 10);
      if (col < startCol || col > endCol) continue;
      const needle = String(criteria[colStr] || '').toLowerCase();
      if (!needle) continue;
      const cell = sheet.cells[cellAddr(r, col)];
      const val = cell ? String(cell.computed ?? cell.value ?? '') : '';
      if (!val.toLowerCase().includes(needle)) { matches = false; break; }
    }
    if (!matches) hidden.add(r);
  }
  return hidden;
}

/** Builds a lookup of merged-cell anchor -> span, and a set of covered (hidden) cells. */
function computeMergeMaps(sheet) {
  const anchors = new Map(); // "r,c" -> {rowSpan, colSpan}
  const covered = new Set(); // "r,c" for non-anchor cells within a merge
  for (const m of sheet.mergedCells || []) {
    const minRow = Math.min(m.startRow, m.endRow);
    const maxRow = Math.max(m.startRow, m.endRow);
    const minCol = Math.min(m.startCol, m.endCol);
    const maxCol = Math.max(m.startCol, m.endCol);
    anchors.set(minRow + ',' + minCol, { rowSpan: maxRow - minRow + 1, colSpan: maxCol - minCol + 1 });
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (r === minRow && c === minCol) continue;
        covered.add(r + ',' + c);
      }
    }
  }
  return { anchors, covered };
}

function colWidth(sheet, c) {
  return sheet.colWidths[c] || DEFAULT_COL_WIDTH;
}
function rowHeight(sheet, r) {
  return sheet.rowHeights[r] || DEFAULT_ROW_HEIGHT;
}

function colOffset(sheet, c) {
  let offset = 50; // row-header width
  for (let k = 0; k < c; k++) offset += colWidth(sheet, k);
  return offset;
}
function rowOffset(sheet, r) {
  let offset = 24; // col-header height
  for (let k = 0; k < r; k++) offset += rowHeight(sheet, k);
  return offset;
}

export function renderGrid() {
  const table = document.getElementById('grid-table');
  if (!table) return;
  const sheet = getActiveSheet();
  const frozenRows = sheet.frozenRows || 0;
  const frozenCols = sheet.frozenCols || 0;
  const hiddenRows = computeHiddenRows(sheet);
  const { anchors, covered } = computeMergeMaps(sheet);

  let html = '<thead><tr><th class="corner"></th>';

  for (let c = 0; c < INITIAL_COLS; c++) {
    const selected = c >= Math.min(STATE.selection.startCol, STATE.selection.endCol) &&
                     c <= Math.max(STATE.selection.startCol, STATE.selection.endCol) &&
                     STATE.activeCell.col === c ? ' selected' : '';
    const width = colWidth(sheet, c);
    let style = `width:${width}px;min-width:${width}px;`;
    if (c < frozenCols) style += `left:${colOffset(sheet, c)}px;z-index:3;`;
    html += `<th class="col-header${selected}" data-col="${c}" style="${style}">${colToLetter(c)}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (let r = 0; r < INITIAL_ROWS; r++) {
    if (hiddenRows.has(r)) continue;
    const rowSelected = r >= Math.min(STATE.selection.startRow, STATE.selection.endRow) &&
                        r <= Math.max(STATE.selection.startRow, STATE.selection.endRow) &&
                        STATE.activeCell.row === r ? ' selected' : '';
    const height = rowHeight(sheet, r);
    let rowHeaderStyle = `height:${height}px;`;
    if (r < frozenRows) rowHeaderStyle += `top:${rowOffset(sheet, r)}px;z-index:3;`;
    html += `<tr><th class="row-header${rowSelected}" data-row="${r}" style="${rowHeaderStyle}">${r + 1}</th>`;

    for (let c = 0; c < INITIAL_COLS; c++) {
      if (covered.has(r + ',' + c)) continue;

      const key = cellAddr(r, c);
      const cell = sheet.cells[key];
      const isActive = r === STATE.activeCell.row && c === STATE.activeCell.col;
      const inRange = r >= Math.min(STATE.selection.startRow, STATE.selection.endRow) &&
                      r <= Math.max(STATE.selection.startRow, STATE.selection.endRow) &&
                      c >= Math.min(STATE.selection.startCol, STATE.selection.endCol) &&
                      c <= Math.max(STATE.selection.startCol, STATE.selection.endCol);

      let classes = [];
      if (isActive) classes.push('active');
      else if (inRange) classes.push('in-range');
      else if (cell) classes.push('selected');

      let displayValue = '';
      if (cell) {
        const computed = cell.computed;
        if (STATE.showFormulas && typeof cell.value === 'string' && cell.value.startsWith('=')) {
          displayValue = cell.value;
          classes.push('cell-formula');
        } else if (isErrorValue(computed)) {
          displayValue = computed.type;
          classes.push('cell-error');
        } else if (computed !== null && computed !== '') {
          displayValue = formatCellValue(computed, cell.format);
          if (typeof computed === 'number') classes.push('cell-number');
        } else {
          displayValue = cell.value || '';
        }

        if (cell.style) {
          if (cell.style.bold) classes.push('cell-bold');
          if (cell.style.italic) classes.push('cell-italic');
          if (cell.style.hAlign !== 'auto') classes.push('cell-align-' + cell.style.hAlign);
        }
      }

      let style = cell ? buildCellStyle(cell) : '';
      let attrs = '';
      const anchor = anchors.get(r + ',' + c);
      if (anchor) {
        attrs += ` rowspan="${anchor.rowSpan}" colspan="${anchor.colSpan}"`;
      }
      if (r < frozenRows || c < frozenCols) {
        style += 'position:sticky;';
        if (r < frozenRows) style += `top:${rowOffset(sheet, r)}px;`;
        if (c < frozenCols) style += `left:${colOffset(sheet, c)}px;`;
        style += `z-index:${(r < frozenRows && c < frozenCols) ? 2 : 1};`;
      }

      html += `<td class="${classes.join(' ')}" data-row="${r}" data-col="${c}" style="${style}"${attrs}>${escapeHtml(displayValue)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody>';

  table.innerHTML = html;
  attachCellListeners();
}

export function formatCellValue(value, format) {
  if (value === null || value === '') return '';
  if (isErrorValue(value)) return value.type;

  const fmt = format || { type: 'auto', decimalPlaces: 2, currencySymbol: '$', dateFormat: 'MM/DD/YYYY' };

  switch (fmt.type) {
    case 'number':
      return Number(value).toFixed(fmt.decimalPlaces);
    case 'currency':
      return fmt.currencySymbol + Number(value).toFixed(fmt.decimalPlaces);
    case 'percent':
      return (Number(value) * 100).toFixed(fmt.decimalPlaces) + '%';
    case 'scientific':
      return Number(value).toExponential(fmt.decimalPlaces);
    case 'date':
      return new Date(value).toLocaleDateString();
    case 'text':
      return String(value);
    case 'auto':
    default:
      if (typeof value === 'number') {
        return Number.isInteger(value) ? String(value) : value.toFixed(2);
      }
      return String(value);
  }
}

export function buildCellStyle(cell) {
  if (!cell || !cell.style) return '';
  let s = '';
  if (cell.style.fontFamily) s += `font-family:${cell.style.fontFamily};`;
  if (cell.style.fontSize) s += `font-size:${cell.style.fontSize}px;`;
  if (cell.style.fontColor) s += `color:${cell.style.fontColor};`;
  if (cell.style.bgColor) s += `background:${cell.style.bgColor};`;
  if (cell.style.bold) s += 'font-weight:bold;';
  if (cell.style.italic) s += 'font-style:italic;';
  if (cell.style.underline && cell.style.strikethrough) s += 'text-decoration:underline line-through;';
  else if (cell.style.underline) s += 'text-decoration:underline;';
  else if (cell.style.strikethrough) s += 'text-decoration:line-through;';
  if (cell.style.hAlign && cell.style.hAlign !== 'auto') s += `text-align:${cell.style.hAlign};`;
  if (cell.style.wrap) s += 'white-space:pre-wrap;';
  return s;
}

export function attachCellListeners() {
  const cells = document.querySelectorAll('#grid-table td');
  cells.forEach(td => {
    td.addEventListener('mousedown', onCellMouseDown);
    td.addEventListener('mouseover', onCellMouseOver);
    td.addEventListener('dblclick', onCellDblClick);
    td.addEventListener('contextmenu', onCellContextMenu);
  });

  document.querySelectorAll('#grid-table th.col-header').forEach(th => {
    const handle = document.createElement('div');
    handle.className = 'col-resize-handle';
    th.appendChild(handle);
    handle.addEventListener('mousedown', onColResizeStart);
  });

  document.querySelectorAll('#grid-table th.row-header').forEach(th => {
    const handle = document.createElement('div');
    handle.className = 'row-resize-handle';
    th.appendChild(handle);
    handle.addEventListener('mousedown', onRowResizeStart);
  });
}
