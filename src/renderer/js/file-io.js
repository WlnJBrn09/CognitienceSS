/**
 * Cognitience SS — File I/O (open, save, export, folders)
 */

import { STATE, INITIAL_ROWS, INITIAL_COLS, api } from './state.js';
import { getActiveSheet, getCell, createWorkbook, setCellValue } from './workbook.js';
import { renderGrid } from './grid-render.js';
import { renderSheetTabs, renderSidebarSheets } from './sheets.js';
import { refreshActiveCell, finishEditing } from './editing.js';
import { notify, updateTitle, updateRightPanel } from './ui-chrome.js';

function resetViewState() {
  STATE.activeSheetIndex = STATE.workbook.activeSheetIndex || 0;
  STATE.activeCell = { row: 0, col: 0 };
  STATE.selection = { startRow: 0, startCol: 0, endRow: 0, endCol: 0 };
  STATE.dirty = false;
  STATE.undoStack = [];
  STATE.redoStack = [];
}

function refreshAllViews() {
  renderGrid();
  renderSheetTabs();
  renderSidebarSheets();
  refreshActiveCell();
  updateTitle();
  updateRightPanel();
}

function populateFromDelimited(content, delimiter) {
  const rows = content.split('\n');
  rows.forEach((row, r) => {
    if (r >= INITIAL_ROWS) return;
    const cols = row.split(delimiter);
    cols.forEach((val, c) => {
      if (c >= INITIAL_COLS) return;
      const trimmed = delimiter === ',' ? val.replace(/^"|"$/g, '').trim() : val.trim();
      if (trimmed) setCellValue(r, c, trimmed);
    });
  });
}

export async function newSpreadsheet() {
  if (STATE.dirty) {
    const ok = confirm('You have unsaved changes. Create new anyway?');
    if (!ok) return;
  }
  STATE.workbook = createWorkbook();
  resetViewState();
  refreshAllViews();
}

export async function openSpreadsheet(filePath) {
  try {
    const result = await api.sheet.open(filePath);
    if (!result) return;

    if (result.format === 'cognitience' || result.format === 'xlsx' || result.format === 'ods') {
      // Main process already parsed these into workbook JSON (with optional YAML frontmatter for .cogss)
      let content = result.content;
      if (typeof content === 'string' && content.startsWith('---')) {
        const endOfYaml = content.indexOf('---', 3);
        if (endOfYaml !== -1) content = content.slice(endOfYaml + 3).trim();
      }
      try {
        STATE.workbook = JSON.parse(content);
      } catch {
        STATE.workbook = createWorkbook(result.title);
      }
    } else if (result.format === 'csv') {
      STATE.workbook = createWorkbook(result.title);
      populateFromDelimited(result.content, ',');
    } else if (result.format === 'tsv') {
      STATE.workbook = createWorkbook(result.title);
      populateFromDelimited(result.content, '\t');
    } else if (result.format === 'json') {
      try {
        STATE.workbook = JSON.parse(result.content);
      } catch {
        STATE.workbook = createWorkbook(result.title);
      }
    } else {
      STATE.workbook = createWorkbook(result.title);
      populateFromDelimited(result.content, /[,\t]/);
    }

    STATE.workbook.filePath = result.filePath;
    STATE.workbook.title = result.title;
    resetViewState();
    refreshAllViews();
    notify('Opened: ' + result.title, 'success');
  } catch (e) {
    notify('Failed to open: ' + e.message, 'error');
  }
}

export async function saveSpreadsheet() {
  try {
    if (STATE.isEditing) finishEditing();

    const content = JSON.stringify(STATE.workbook);

    if (STATE.workbook.filePath) {
      await api.sheet.save({
        content,
        filePath: STATE.workbook.filePath,
        title: STATE.workbook.title,
      });
      STATE.dirty = false;
      STATE.workbook.isDirty = false;
      updateTitle();
      notify('Saved', 'success');
    } else {
      await saveAs();
    }
  } catch (e) {
    notify('Failed to save: ' + e.message, 'error');
  }
}

export async function saveAs() {
  try {
    if (STATE.isEditing) finishEditing();

    const content = JSON.stringify(STATE.workbook);
    const result = await api.sheet.saveAs({
      content,
      title: STATE.workbook.title,
    });

    if (result && result.filePath) {
      STATE.workbook.filePath = result.filePath;
      STATE.dirty = false;
      STATE.workbook.isDirty = false;
      updateTitle();
      notify('Saved as: ' + result.filePath, 'success');
    }
  } catch (e) {
    notify('Failed to save: ' + e.message, 'error');
  }
}

export async function openFolder() {
  try {
    const result = await api.dialog.openFolder();
    if (!result) return;
    notify(`Opened folder: ${result.path}`, 'info');

    const spreadsheetFiles = result.files.filter((f) => {
      const ext = f.name.split('.').pop().toLowerCase();
      return ['cogss', 'csv', 'tsv', 'json', 'xlsx', 'xls', 'ods'].includes(ext);
    });

    if (spreadsheetFiles.length === 0) {
      notify('No spreadsheet files found in this folder', 'warning');
      return;
    }

    STATE.currentFolder = result;
    STATE.folderFiles = spreadsheetFiles;

    const firstFile = spreadsheetFiles[0];
    await openSpreadsheet(firstFile.path);
    updateRightPanel();
    notify(`Found ${spreadsheetFiles.length} spreadsheet(s) in folder`, 'info');
  } catch (err) {
    notify('Failed to open folder: ' + err.message, 'error');
  }
}

export async function newFolder() {
  try {
    const folderPath = await api.dialog.newFolder();
    if (!folderPath) return;
    const folderName = prompt('New folder name:');
    if (!folderName || !folderName.trim()) return;
    const fullPath = folderPath + '/' + folderName.trim();
    await api.fs.mkdir(fullPath);
    notify(`Created folder: ${fullPath}`, 'info');
  } catch (err) {
    notify('Failed to create folder: ' + err.message, 'error');
  }
}

export function workbookToCSV() {
  let csv = '';
  for (let r = 0; r < INITIAL_ROWS; r++) {
    const row = [];
    let hasData = false;
    for (let c = 0; c < INITIAL_COLS; c++) {
      const cell = getCell(r, c);
      let val = STATE.showFormulas ? String(cell.value ?? '') : String(cell.computed ?? cell.value ?? '');
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = '"' + val.replace(/"/g, '""') + '"';
      }
      if (val) hasData = true;
      row.push(val);
    }
    if (hasData) csv += row.join(',') + '\n';
  }
  return csv;
}

export function workbookToTSV() {
  let tsv = '';
  for (let r = 0; r < INITIAL_ROWS; r++) {
    const row = [];
    let hasData = false;
    for (let c = 0; c < INITIAL_COLS; c++) {
      const cell = getCell(r, c);
      const val = STATE.showFormulas ? String(cell.value ?? '') : String(cell.computed ?? cell.value ?? '');
      if (val) hasData = true;
      row.push(val);
    }
    if (hasData) tsv += row.join('\t') + '\n';
  }
  return tsv;
}

export async function exportAs(format) {
  try {
    if (STATE.isEditing) finishEditing();

    let content;
    if (format === 'csv') {
      content = workbookToCSV();
    } else if (format === 'tsv') {
      content = workbookToTSV();
    } else if (format === 'json') {
      content = JSON.stringify(STATE.workbook, null, 2);
    } else {
      // xlsx, html, pdf, cogss — main process expects the workbook JSON
      content = JSON.stringify(STATE.workbook);
    }

    const result = await api.sheet.export({ format, content, title: STATE.workbook.title });
    if (result && result.success === false) {
      if (result.error) notify('Export failed: ' + result.error, 'error');
      return;
    }
    notify('Export complete', 'success');
  } catch (e) {
    notify('Export failed: ' + e.message, 'error');
  }
}
