/**
 * Cognitience SS — IPC Event Listeners (main → renderer)
 * NOTE: preload already strips the Electron event object, so callbacks
 * receive the payload directly: api.on('channel', (data) => ...).
 */

import { STATE, api } from './state.js';
import { renderGrid } from './grid-render.js';
import { newSpreadsheet, openSpreadsheet, saveSpreadsheet, saveAs, exportAs } from './file-io.js';
import { addSheet } from './sheets.js';
import { fillDown, fillRight, insertRow, insertColumn, deleteRow, deleteColumn } from './rows-cols.js';
import { applyStyle, applyAlign, applyNumberFormat, applyDecimal, autoFitCol, autoFitRow } from './formatting.js';
import { sortSelection, toggleFilter, removeFilter } from './filter-sort-merge.js';
import { toggleFreezePanes } from './freeze-panes.js';
import { showFindBar } from './find-replace.js';
import { showFunctionPicker, showSettingsModal, showShortcutsModal } from './dialogs.js';
import { toggleGridLines } from './view-toggles.js';
import { setZoom, notify } from './ui-chrome.js';
import { toggleCommandPalette } from './command-palette.js';

export function initIpcListeners() {
  api.on('sheet:new', () => newSpreadsheet());
  api.on('sheet:open', () => openSpreadsheet());
  api.on('sheet:save', () => saveSpreadsheet());
  api.on('sheet:saveAs', () => saveAs());
  api.on('sheet:export', (data) => exportAs(data.format));
  api.on('sheet:print', () => {
    if (api.sheet.print) api.sheet.print();
    else window.print();
  });
  api.on('sheet:addSheet', () => addSheet());

  api.on('edit:find', () => showFindBar(false));
  api.on('edit:replace', () => showFindBar(true));
  api.on('edit:fillDown', () => fillDown());
  api.on('edit:fillRight', () => fillRight());
  api.on('edit:insertRowAbove', () => insertRow(STATE.activeCell.row));
  api.on('edit:insertRowBelow', () => insertRow(STATE.activeCell.row + 1));
  api.on('edit:insertColumnLeft', () => insertColumn(STATE.activeCell.col));
  api.on('edit:insertColumnRight', () => insertColumn(STATE.activeCell.col + 1));
  api.on('edit:deleteRow', () => deleteRow(STATE.activeCell.row));
  api.on('edit:deleteColumn', () => deleteColumn(STATE.activeCell.col));

  api.on('insert:function', () => showFunctionPicker());

  api.on('format:bold', () => applyStyle('bold'));
  api.on('format:italic', () => applyStyle('italic'));
  api.on('format:underline', () => applyStyle('underline'));
  api.on('format:strikethrough', () => applyStyle('strikethrough'));
  api.on('format:align', (data) => applyAlign(data.align));
  api.on('format:number', (data) => applyNumberFormat(data.type));
  api.on('format:decimal', (data) => applyDecimal(data.delta));
  api.on('format:autoFitCol', () => autoFitCol(STATE.activeCell.col));
  api.on('format:autoFitRow', () => autoFitRow(STATE.activeCell.row));

  api.on('tools:sort', (data) => sortSelection(data.direction));
  api.on('tools:filter', () => toggleFilter());
  api.on('tools:removeFilter', () => removeFilter());
  api.on('tools:settings', () => showSettingsModal());

  api.on('view:toggleGridLines', () => toggleGridLines());
  api.on('view:toggleFormulaBar', () => {
    const bar = document.getElementById('formula-bar');
    if (bar) bar.style.display = bar.style.display === 'none' ? 'flex' : 'none';
  });
  api.on('view:toggleStatusBar', () => {
    const bar = document.getElementById('status-bar');
    if (bar) bar.style.display = bar.style.display === 'none' ? 'flex' : 'none';
  });
  api.on('view:freezePanes', () => toggleFreezePanes());
  api.on('view:zoomIn', () => setZoom(STATE.zoom + 10));
  api.on('view:zoomOut', () => setZoom(STATE.zoom - 10));
  api.on('view:zoomReset', () => setZoom(100));
  api.on('view:toggleFullscreen', () => api.window.fullscreen());
  api.on('view:commandPalette', () => toggleCommandPalette());

  api.on('config:changed', (data) => {
    if (data.key === 'editor.showFormulas') {
      STATE.showFormulas = data.value;
      renderGrid();
    } else if (data.key === 'editor.autoSave') {
      STATE.autoSaveEnabled = !!data.value;
    } else if (data.key === 'editor.showGridLines') {
      STATE.showGridLines = !!data.value;
      document.getElementById('grid-viewport')?.classList.toggle('no-grid-lines', !STATE.showGridLines);
    }
  });

  api.on('theme:changed', (themeId) => {
    document.documentElement.setAttribute('data-theme', themeId);
  });

  api.on('help:shortcuts', () => showShortcutsModal());
  api.on('help:checkUpdates', async () => {
    try {
      const result = await api.updates.check();
      if (result.updateAvailable) {
        notify(`Update available: v${result.latestVersion}`, 'info');
      } else if (result.error) {
        notify('Could not check for updates', 'warning');
      } else {
        notify("You're up to date", 'success');
      }
    } catch (e) {
      notify('Update check failed', 'error');
    }
  });
}
