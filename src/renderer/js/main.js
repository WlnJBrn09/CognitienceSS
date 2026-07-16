/**
 * Cognitience SS — Renderer Entry Point
 * Wires up all modules and boots the application.
 */

import { STATE, api } from './state.js';
import { createWorkbook } from './workbook.js';
import { renderGrid } from './grid-render.js';
import { renderSheetTabs, renderSidebarSheets } from './sheets.js';
import { refreshActiveCell } from './editing.js';
import { initToolbar, updateTitle, updateStatusBar, updateRightPanel } from './ui-chrome.js';
import { initIpcListeners } from './ipc-listeners.js';
import { initKeyboardHandlers } from './keyboard.js';
import { initTheme } from './theme.js';

async function init() {
  STATE.workbook = createWorkbook();

  try {
    const autoSave = await api.config.get('editor.autoSave');
    if (typeof autoSave === 'boolean') STATE.autoSaveEnabled = autoSave;
    const showFormulas = await api.config.get('editor.showFormulas');
    if (typeof showFormulas === 'boolean') STATE.showFormulas = showFormulas;
    const showGridLines = await api.config.get('editor.showGridLines');
    if (typeof showGridLines === 'boolean') STATE.showGridLines = showGridLines;
  } catch (e) {
    console.warn('[Cognitience SS] Failed to load config, using defaults:', e);
  }

  initToolbar();
  initIpcListeners();
  initKeyboardHandlers();

  try {
    await initTheme();
  } catch (e) {
    console.warn('[Cognitience SS] Theme init failed, using default:', e);
    document.documentElement.setAttribute('data-theme', 'cognitience-light');
  }

  renderGrid();
  renderSheetTabs();
  renderSidebarSheets();
  refreshActiveCell();
  updateTitle();
  updateStatusBar();
  updateRightPanel();

  console.log('[Cognitience SS] Renderer initialized');
}

init();
