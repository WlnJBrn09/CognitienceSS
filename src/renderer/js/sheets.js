/**
 * Cognitience SS — Sheet Tabs & Sidebar
 */

import { STATE } from './state.js';
import { uid, deepClone } from './helpers.js';
import { createSheet, markDirty } from './workbook.js';
import { renderGrid } from './grid-render.js';
import { finishEditing, refreshActiveCell } from './editing.js';
import { notify, showGenericContextMenu } from './ui-chrome.js';

export function renderSheetTabs() {
  const container = document.getElementById('sheet-tabs-scroll');
  if (!container) return;
  container.innerHTML = '';

  STATE.workbook.sheets.forEach((sheet, i) => {
    const tab = document.createElement('div');
    tab.className = 'sheet-tab' + (i === STATE.activeSheetIndex ? ' active' : '');

    const nameSpan = document.createElement('span');
    nameSpan.className = 'sheet-tab-name';
    nameSpan.textContent = sheet.name;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'sheet-tab-close';
    closeBtn.innerHTML = '×';
    closeBtn.title = 'Close ' + sheet.name;
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSheet(i);
    });

    tab.appendChild(nameSpan);
    tab.appendChild(closeBtn);

    tab.addEventListener('click', () => switchSheet(i));
    tab.addEventListener('dblclick', () => renameSheet(i));
    tab.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showSheetContextMenu(e.clientX, e.clientY, i);
    });
    container.appendChild(tab);
  });
}

export function switchSheet(index) {
  if (STATE.isEditing) finishEditing();
  STATE.activeSheetIndex = index;
  STATE.activeCell = { row: 0, col: 0 };
  STATE.selection = { startRow: 0, startCol: 0, endRow: 0, endCol: 0 };
  renderGrid();
  renderSheetTabs();
  renderSidebarSheets();
  refreshActiveCell();
}

export function addSheet() {
  const sheet = createSheet('Sheet ' + (STATE.workbook.sheets.length + 1));
  STATE.workbook.sheets.push(sheet);
  switchSheet(STATE.workbook.sheets.length - 1);
  markDirty();
}

export function renameSheet(index) {
  const newName = prompt('Rename sheet:', STATE.workbook.sheets[index].name);
  if (newName && newName.trim()) {
    STATE.workbook.sheets[index].name = newName.trim();
    renderSheetTabs();
    renderSidebarSheets();
    markDirty();
  }
}

export function deleteSheet(index) {
  if (STATE.workbook.sheets.length <= 1) {
    notify('Cannot delete the last sheet', 'warning');
    return;
  }
  STATE.workbook.sheets.splice(index, 1);
  if (STATE.activeSheetIndex >= STATE.workbook.sheets.length) {
    STATE.activeSheetIndex = STATE.workbook.sheets.length - 1;
  }
  switchSheet(STATE.activeSheetIndex);
  markDirty();
}

export function closeSheet(index) {
  const sheet = STATE.workbook.sheets[index];
  if (STATE.dirty) {
    const ok = confirm(`Close "${sheet.name}"? Unsaved changes will be lost.`);
    if (!ok) return;
  }
  deleteSheet(index);
}

export function duplicateSheet(index) {
  const original = STATE.workbook.sheets[index];
  const copy = deepClone(original);
  copy.id = uid();
  copy.name = original.name + ' (Copy)';
  STATE.workbook.sheets.splice(index + 1, 0, copy);
  renderSheetTabs();
  renderSidebarSheets();
  markDirty();
}

export function moveSheet(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= STATE.workbook.sheets.length) return;
  const [sheet] = STATE.workbook.sheets.splice(index, 1);
  STATE.workbook.sheets.splice(newIndex, 0, sheet);
  if (STATE.activeSheetIndex === index) STATE.activeSheetIndex = newIndex;
  renderSheetTabs();
  renderSidebarSheets();
  markDirty();
}

export function showSheetContextMenu(x, y, index) {
  showGenericContextMenu(x, y, [
    { label: 'Rename', action: () => renameSheet(index) },
    { label: 'Delete', action: () => deleteSheet(index) },
    { label: 'Duplicate', action: () => duplicateSheet(index) },
    { label: 'Move Left', action: () => moveSheet(index, -1) },
    { label: 'Move Right', action: () => moveSheet(index, 1) },
  ]);
}

export function renderSidebarSheets() {
  const container = document.getElementById('sidebar-content');
  if (!container) return;
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'sidebar-section-header';
  header.innerHTML = '<span>Sheets</span><button class="sidebar-add-btn" id="sidebar-new-sheet" title="New Sheet">+</button>';
  container.appendChild(header);

  document.getElementById('sidebar-new-sheet')?.addEventListener('click', () => addSheet());

  STATE.workbook.sheets.forEach((sheet, i) => {
    const item = document.createElement('div');
    item.className = 'sidebar-item' + (i === STATE.activeSheetIndex ? ' active' : '');

    const icon = document.createElement('span');
    icon.className = 'sidebar-item-icon';
    icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>';

    const name = document.createElement('span');
    name.className = 'sidebar-item-name';
    name.textContent = sheet.name;

    const actions = document.createElement('div');
    actions.className = 'sidebar-item-actions';

    const renameBtn = document.createElement('button');
    renameBtn.className = 'sidebar-action-btn';
    renameBtn.title = 'Rename';
    renameBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    renameBtn.addEventListener('click', (e) => { e.stopPropagation(); renameSheet(i); });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'sidebar-action-btn';
    closeBtn.title = 'Close';
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeSheet(i); });

    actions.appendChild(renameBtn);
    actions.appendChild(closeBtn);

    item.appendChild(icon);
    item.appendChild(name);
    item.appendChild(actions);

    item.addEventListener('click', () => switchSheet(i));
    item.addEventListener('dblclick', () => renameSheet(i));
    container.appendChild(item);
  });
}
