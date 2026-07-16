/**
 * Cognitience SS — UI Chrome: toolbar, status bar, notifications, title,
 * zoom, context menus, and the right (properties) panel.
 */

import { STATE, api } from './state.js';
import { cellAddr, escapeHtml, selectionBounds } from './helpers.js';
import { getActiveSheet, getCell, undo, redo } from './workbook.js';
import { renderGrid } from './grid-render.js';
import {
  applyStyle, applyAlign, applyFont, applyFontSize, applyNumberFormat,
  applyTextColor, applyBgColor,
} from './formatting.js';
import { insertRow, insertColumn, deleteRow, deleteColumn } from './rows-cols.js';
import { mergeCells, sortSelection, toggleFilter } from './filter-sort-merge.js';
import { newSpreadsheet, openSpreadsheet, openFolder, saveSpreadsheet } from './file-io.js';
import { addSheet } from './sheets.js';
import { toggleSidebar, toggleRightPanel } from './view-toggles.js';
import { toggleCommandPalette } from './command-palette.js';
import { copyCells, cutCells, pasteCells } from './clipboard.js';
import { deleteSelectedCells } from './selection.js';

// ─── Notifications ──────────────────────────────────────────────────

export function notify(message, type = 'info') {
  const container = document.getElementById('notification-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'notification notification-' + type;
  el.innerHTML = `<span class="notification-message">${escapeHtml(message)}</span><button class="notification-close">&times;</button>`;
  el.querySelector('.notification-close').addEventListener('click', () => el.remove());
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ─── Title Bar ──────────────────────────────────────────────────────

export function updateTitle() {
  if (!STATE.workbook) return;
  const title = STATE.workbook.title || 'Untitled';
  const dirty = STATE.dirty ? ' •' : '';
  const docTitle = document.getElementById('doc-title');
  if (docTitle) docTitle.textContent = `${title}${dirty} — Cognitience SS`;
  document.title = `${title}${dirty} — Cognitience SS`;
}

// ─── Status Bar ─────────────────────────────────────────────────────

export function updateStatusBar() {
  const { minRow, maxRow, minCol, maxCol } = selectionBounds();

  const values = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const cell = getCell(r, c);
      if (cell.computed !== null && cell.computed !== '' && typeof cell.computed === 'number') {
        values.push(cell.computed);
      }
    }
  }

  const sumEl = document.getElementById('status-sum');
  const avgEl = document.getElementById('status-avg');
  const countEl = document.getElementById('status-count');
  if (sumEl) sumEl.textContent = values.length > 0 ? 'Sum: ' + values.reduce((a, b) => a + b, 0).toFixed(2) : '';
  if (avgEl) avgEl.textContent = values.length > 0 ? 'Avg: ' + (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : '';
  if (countEl) countEl.textContent = (values.length > 0 ? values.length + ' numeric, ' : '') + ((maxRow - minRow + 1) * (maxCol - minCol + 1)) + ' cells';

  const selRange = minRow === maxRow && minCol === maxCol
    ? cellAddr(STATE.activeCell.row, STATE.activeCell.col)
    : cellAddr(minRow, minCol) + ':' + cellAddr(maxRow, maxCol);
  const cellInfo = document.getElementById('status-cell-info');
  if (cellInfo) cellInfo.textContent = selRange;
}

// ─── Right Panel ────────────────────────────────────────────────────

export function updateRightPanel() {
  const panel = document.getElementById('right-panel');
  if (!panel || panel.classList.contains('hidden')) return;

  const sheet = getActiveSheet();
  const { row, col } = STATE.activeCell;
  const addr = cellAddr(row, col);
  const cell = sheet.cells[addr];

  const propAddr = document.getElementById('prop-cell-addr');
  const propValue = document.getElementById('prop-cell-value');
  const propFormat = document.getElementById('prop-cell-format');
  if (propAddr) propAddr.textContent = addr;
  if (propValue) propValue.textContent = cell ? (cell.computed !== null && cell.computed !== '' ? String(cell.computed) : String(cell.value || '—')) : '—';
  if (propFormat) propFormat.textContent = cell ? (cell.format?.type || 'General') : 'General';

  const selRangeEl = document.getElementById('prop-selection-range');
  const selCountEl = document.getElementById('prop-selection-count');
  const selSumEl = document.getElementById('prop-selection-sum');
  const selAvgEl = document.getElementById('prop-selection-avg');

  const { minRow: startRow, maxRow: endRow, minCol: startCol, maxCol: endCol } = selectionBounds();
  const rangeStr = startRow === endRow && startCol === endCol
    ? cellAddr(startRow, startCol)
    : `${cellAddr(startRow, startCol)}:${cellAddr(endRow, endCol)}`;

  if (selRangeEl) selRangeEl.textContent = rangeStr;

  let count = 0, sum = 0, numCount = 0;
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const c2 = sheet.cells[cellAddr(r, c)];
      if (c2 && c2.computed !== null && c2.computed !== '') {
        count++;
        if (typeof c2.computed === 'number') {
          sum += c2.computed;
          numCount++;
        }
      }
    }
  }
  if (selCountEl) selCountEl.textContent = String(count || (endRow - startRow + 1) * (endCol - startCol + 1));
  if (selSumEl) selSumEl.textContent = numCount > 0 ? String(Math.round(sum * 1000) / 1000) : '—';
  if (selAvgEl) selAvgEl.textContent = numCount > 0 ? String(Math.round((sum / numCount) * 1000) / 1000) : '—';

  const recentList = document.getElementById('recent-sheets-list');
  if (recentList) {
    const recent = (STATE.recentFiles || []).slice(0, 8);
    if (recent.length === 0) {
      recentList.innerHTML = '<div style="padding:6px 8px;font-size:11px;color:var(--fg-tab)">No recent files</div>';
    } else {
      recentList.innerHTML = recent.map((f) =>
        `<div class="recent-item" data-path="${escapeHtml(f.path)}">
          <span class="recent-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg></span>
          <span class="recent-name">${escapeHtml(f.name)}</span>
        </div>`
      ).join('');
    }
  }
}

// ─── Zoom ───────────────────────────────────────────────────────────

export function setZoom(level) {
  STATE.zoom = Math.max(25, Math.min(200, level));
  const slider = document.getElementById('zoom-slider');
  const levelEl = document.getElementById('zoom-level');
  const table = document.getElementById('grid-table');
  if (slider) slider.value = STATE.zoom;
  if (levelEl) levelEl.textContent = STATE.zoom + '%';
  if (table) {
    table.style.transform = `scale(${STATE.zoom / 100})`;
    table.style.transformOrigin = 'top left';
  }
}

// ─── Context Menus ──────────────────────────────────────────────────

export function removeContextMenu() {
  document.querySelectorAll('.context-menu').forEach((m) => m.remove());
}

export function showGenericContextMenu(x, y, items) {
  removeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  items.forEach((item) => {
    if (item.type === 'separator') {
      menu.appendChild(Object.assign(document.createElement('div'), { className: 'context-menu-divider' }));
    } else {
      const el = document.createElement('div');
      el.className = 'context-menu-item';
      el.innerHTML = item.label + (item.shortcut ? `<span class="context-shortcut">${item.shortcut}</span>` : '');
      el.addEventListener('click', () => { item.action(); removeContextMenu(); });
      menu.appendChild(el);
    }
  });

  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = Math.max(0, window.innerWidth - rect.width - 4) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = Math.max(0, window.innerHeight - rect.height - 4) + 'px';

  setTimeout(() => document.addEventListener('click', removeContextMenu, { once: true }), 0);
}

export function showContextMenu(x, y, row, col) {
  showGenericContextMenu(x, y, [
    { label: 'Cut', shortcut: 'Ctrl+X', action: () => cutCells() },
    { label: 'Copy', shortcut: 'Ctrl+C', action: () => copyCells() },
    { label: 'Paste', shortcut: 'Ctrl+V', action: () => pasteCells() },
    { type: 'separator' },
    { label: 'Insert Row Above', action: () => insertRow(row) },
    { label: 'Insert Row Below', action: () => insertRow(row + 1) },
    { label: 'Insert Column Left', action: () => insertColumn(col) },
    { label: 'Insert Column Right', action: () => insertColumn(col + 1) },
    { type: 'separator' },
    { label: 'Delete Row', action: () => deleteRow(row) },
    { label: 'Delete Column', action: () => deleteColumn(col) },
    { type: 'separator' },
    { label: 'Clear Contents', shortcut: 'Delete', action: () => deleteSelectedCells() },
  ]);
}

// ─── Toolbar ────────────────────────────────────────────────────────

export function initToolbar() {
  document.getElementById('btn-minimize')?.addEventListener('click', () => api.window.minimize());
  document.getElementById('btn-maximize')?.addEventListener('click', () => api.window.maximize());
  document.getElementById('btn-close')?.addEventListener('click', () => api.window.close());

  document.querySelectorAll('[data-cmd]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd');
      switch (cmd) {
        case 'new-file': newSpreadsheet(); break;
        case 'open-file': openSpreadsheet(); break;
        case 'open-folder': openFolder(); break;
        case 'save-file': saveSpreadsheet(); break;
        case 'undo': undo(); renderGrid(); break;
        case 'redo': redo(); renderGrid(); break;
        case 'bold': applyStyle('bold'); break;
        case 'italic': applyStyle('italic'); break;
        case 'underline': applyStyle('underline'); break;
        case 'strikethrough': applyStyle('strikethrough'); break;
        case 'align-left': applyAlign('left'); break;
        case 'align-center': applyAlign('center'); break;
        case 'align-right': applyAlign('right'); break;
        case 'format-currency': applyNumberFormat('currency'); break;
        case 'format-percent': applyNumberFormat('percent'); break;
        case 'format-number': applyNumberFormat('number'); break;
        case 'insert-row': insertRow(); break;
        case 'insert-col': insertColumn(); break;
        case 'merge-cells': mergeCells(); break;
        case 'sort-asc': sortSelection('asc'); break;
        case 'sort-desc': sortSelection('desc'); break;
        case 'filter': toggleFilter(); break;
        default: break;
      }
    });
  });

  document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => toggleSidebar());

  const fontFamEl = document.getElementById('font-family-select');
  if (fontFamEl) fontFamEl.addEventListener('change', (e) => applyFont(e.target.value));

  const fontSzEl = document.getElementById('font-size-input');
  if (fontSzEl) fontSzEl.addEventListener('change', (e) => applyFontSize(parseInt(e.target.value, 10)));

  const textColorBtn = document.getElementById('text-color-btn');
  const textColorInput = document.getElementById('text-color');
  if (textColorBtn && textColorInput) {
    textColorBtn.addEventListener('click', () => textColorInput.click());
    textColorInput.addEventListener('input', (e) => {
      applyTextColor(e.target.value);
      const bar = document.getElementById('text-color-bar');
      if (bar) bar.style.background = e.target.value;
    });
  }

  const bgColorBtn = document.getElementById('bg-color-btn');
  const bgColorInput = document.getElementById('bg-color');
  if (bgColorBtn && bgColorInput) {
    bgColorBtn.addEventListener('click', () => bgColorInput.click());
    bgColorInput.addEventListener('input', (e) => {
      applyBgColor(e.target.value);
      const bar = document.getElementById('bg-color-bar');
      if (bar) bar.style.background = e.target.value;
    });
  }

  document.getElementById('btn-command-palette')?.addEventListener('click', () => toggleCommandPalette());

  document.getElementById('zoom-in')?.addEventListener('click', () => setZoom(STATE.zoom + 10));
  document.getElementById('zoom-out')?.addEventListener('click', () => setZoom(STATE.zoom - 10));
  document.getElementById('zoom-slider')?.addEventListener('input', (e) => setZoom(parseInt(e.target.value, 10)));

  document.getElementById('btn-add-sheet')?.addEventListener('click', () => addSheet());

  document.getElementById('formula-input')?.addEventListener('input', () => {
    if (!STATE.isEditing) {
      STATE.isEditing = true;
      STATE.editingCell = { ...STATE.activeCell };
    }
  });

  document.getElementById('btn-toggle-right-panel')?.addEventListener('click', () => toggleRightPanel());
  document.getElementById('close-right-panel')?.addEventListener('click', () => toggleRightPanel());
}
