/**
 * Cognitience SS — Command Palette
 * Uses the existing #command-palette DOM structure defined in index.html.
 */

import { STATE } from './state.js';
import { undo, redo } from './workbook.js';
import { newSpreadsheet, openSpreadsheet, saveSpreadsheet, saveAs, openFolder, newFolder, exportAs } from './file-io.js';
import { renameSheet, addSheet } from './sheets.js';
import { toggleGridLines, toggleShowFormulas, toggleSidebar } from './view-toggles.js';
import { setTheme } from './theme.js';
import { showFindBar } from './find-replace.js';
import { showSettingsModal, showShortcutsModal, showFunctionPicker } from './dialogs.js';
import { toggleFreezePanes } from './freeze-panes.js';
import { renderGrid } from './grid-render.js';

function getCommands() {
  return [
    { label: 'New Spreadsheet', shortcut: 'Ctrl+N', action: () => newSpreadsheet() },
    { label: 'Open File…', shortcut: 'Ctrl+O', action: () => openSpreadsheet() },
    { label: 'Open Folder…', action: () => openFolder() },
    { label: 'New Folder…', action: () => newFolder() },
    { label: 'Save', shortcut: 'Ctrl+S', action: () => saveSpreadsheet() },
    { label: 'Save As…', shortcut: 'Ctrl+Shift+S', action: () => saveAs() },
    { label: 'Rename Sheet', action: () => renameSheet(STATE.activeSheetIndex) },
    { label: 'Add Sheet', shortcut: 'Ctrl+Shift+N', action: () => addSheet() },
    { label: 'Undo', shortcut: 'Ctrl+Z', action: () => { undo(); renderGrid(); } },
    { label: 'Redo', shortcut: 'Ctrl+Y', action: () => { redo(); renderGrid(); } },
    { label: 'Find', shortcut: 'Ctrl+F', action: () => showFindBar(false) },
    { label: 'Replace', shortcut: 'Ctrl+H', action: () => showFindBar(true) },
    { label: 'Insert Function…', shortcut: 'Shift+F3', action: () => showFunctionPicker() },
    { label: 'Toggle Freeze Panes', action: () => toggleFreezePanes() },
    { label: 'Toggle Grid Lines', action: () => toggleGridLines() },
    { label: 'Show Formulas', shortcut: 'Ctrl+`', action: () => toggleShowFormulas() },
    { label: 'Toggle Sidebar', shortcut: 'Ctrl+B', action: () => toggleSidebar() },
    { label: 'Theme: Cognitience Light', action: () => setTheme('cognitience-light') },
    { label: 'Theme: Cognitience Dark', action: () => setTheme('cognitience-dark') },
    { label: 'Theme: Cognitience Sepia', action: () => setTheme('cognitience-sepia') },
    { label: 'Theme: High Contrast Dark', action: () => setTheme('cognitience-contrast-dark') },
    { label: 'Export as CSV', action: () => exportAs('csv') },
    { label: 'Export as TSV', action: () => exportAs('tsv') },
    { label: 'Export as JSON', action: () => exportAs('json') },
    { label: 'Export as Excel (.xlsx)', action: () => exportAs('xlsx') },
    { label: 'Export as HTML', action: () => exportAs('html') },
    { label: 'Export as PDF', action: () => exportAs('pdf') },
    { label: 'Export as Cognitience (.cogss)', action: () => exportAs('cogss') },
    { label: 'Settings', shortcut: 'Ctrl+,', action: () => showSettingsModal() },
    { label: 'Keyboard Shortcuts', shortcut: 'Ctrl+/', action: () => showShortcutsModal() },
  ];
}

let selectedIndex = 0;

function renderResults(filter = '') {
  const list = document.getElementById('palette-results');
  if (!list) return;
  const commands = getCommands().filter((c) => c.label.toLowerCase().includes(filter.toLowerCase()));
  selectedIndex = 0;
  list.innerHTML = commands.map((cmd, i) => `
    <div class="palette-item${i === 0 ? ' selected' : ''}" data-index="${i}">
      <span class="palette-icon">⌘</span>
      <span class="palette-label">${cmd.label}</span>
      ${cmd.shortcut ? `<span class="palette-shortcut">${cmd.shortcut}</span>` : ''}
    </div>
  `).join('');

  list.querySelectorAll('.palette-item').forEach((el, i) => {
    el.addEventListener('click', () => {
      commands[i].action();
      closeCommandPalette();
    });
  });

  list._commands = commands;
}

function moveSelection(delta) {
  const list = document.getElementById('palette-results');
  if (!list) return;
  const items = list.querySelectorAll('.palette-item');
  if (!items.length) return;
  items[selectedIndex]?.classList.remove('selected');
  selectedIndex = Math.max(0, Math.min(items.length - 1, selectedIndex + delta));
  items[selectedIndex]?.classList.add('selected');
  items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
}

function runSelected() {
  const list = document.getElementById('palette-results');
  const commands = list?._commands || [];
  const cmd = commands[selectedIndex];
  if (cmd) {
    cmd.action();
    closeCommandPalette();
  }
}

function onPaletteKeyDown(e) {
  if (e.key === 'Escape') { e.preventDefault(); closeCommandPalette(); }
  else if (e.key === 'Enter') { e.preventDefault(); runSelected(); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveSelection(-1); }
}

function onPaletteInput(e) {
  renderResults(e.target.value);
}

let wired = false;
function wirePaletteOnce() {
  if (wired) return;
  wired = true;
  document.getElementById('palette-overlay')?.addEventListener('click', () => closeCommandPalette());
  document.getElementById('palette-input')?.addEventListener('input', onPaletteInput);
  document.getElementById('palette-input')?.addEventListener('keydown', onPaletteKeyDown);
}

export function openCommandPalette() {
  const el = document.getElementById('command-palette');
  if (!el) return;
  wirePaletteOnce();
  el.classList.remove('hidden');
  const input = document.getElementById('palette-input');
  if (input) {
    input.value = '';
    input.focus();
  }
  renderResults('');
}

export function closeCommandPalette() {
  document.getElementById('command-palette')?.classList.add('hidden');
}

export function toggleCommandPalette() {
  const el = document.getElementById('command-palette');
  if (!el) return;
  if (el.classList.contains('hidden')) openCommandPalette();
  else closeCommandPalette();
}
