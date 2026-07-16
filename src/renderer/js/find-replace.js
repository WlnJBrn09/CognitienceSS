/**
 * Cognitience SS — Find & Replace
 */

import { STATE } from './state.js';
import { parseCellAddr } from './helpers.js';
import { getActiveSheet, getCell, setCellValue, pushUndo } from './workbook.js';
import { renderGrid } from './grid-render.js';
import { refreshActiveCell } from './editing.js';
import { scrollToActiveCell } from './selection.js';
import { notify } from './ui-chrome.js';

function ensureFindBar(replaceMode) {
  let bar = document.getElementById('find-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'find-bar';
    bar.style.cssText = 'display:flex;align-items:center;gap:6px;height:32px;padding:0 8px;background:var(--bg-toolbar);border-bottom:1px solid var(--border-color);';
    bar.innerHTML = `
      <input type="text" id="find-input" placeholder="Find…" style="flex:0 0 180px;padding:4px 8px;background:var(--bg-input);color:var(--fg-input);border:1px solid var(--border-input);border-radius:4px;font-size:12px;outline:none;" />
      <input type="text" id="replace-input" placeholder="Replace with…" style="flex:0 0 180px;padding:4px 8px;background:var(--bg-input);color:var(--fg-input);border:1px solid var(--border-input);border-radius:4px;font-size:12px;outline:none;" />
      <button id="find-prev" class="tool-btn" title="Previous match">&uarr;</button>
      <button id="find-next" class="tool-btn" title="Next match">&darr;</button>
      <button id="find-replace-one" class="tool-btn tool-btn-label" title="Replace">Replace</button>
      <button id="find-replace-all" class="tool-btn tool-btn-label" title="Replace All">Replace All</button>
      <span id="find-status" style="font-size:11px;color:var(--fg-tab);white-space:nowrap;"></span>
      <div style="flex:1;"></div>
      <button id="find-close" class="tool-btn" title="Close">&times;</button>
    `;
    const formulaBar = document.getElementById('formula-bar');
    formulaBar.parentNode.insertBefore(bar, formulaBar.nextSibling);

    document.getElementById('find-next').addEventListener('click', () => findNext(1));
    document.getElementById('find-prev').addEventListener('click', () => findNext(-1));
    document.getElementById('find-replace-one').addEventListener('click', () => replaceOne());
    document.getElementById('find-replace-all').addEventListener('click', () => replaceAll());
    document.getElementById('find-close').addEventListener('click', () => hideFindBar());
    document.getElementById('find-input').addEventListener('input', () => runSearch());
    document.getElementById('find-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); findNext(e.shiftKey ? -1 : 1); }
      if (e.key === 'Escape') { e.preventDefault(); hideFindBar(); }
    });
    document.getElementById('replace-input').addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); hideFindBar(); }
    });
  }
  bar.style.display = 'flex';
  const replaceInput = document.getElementById('replace-input');
  const replaceOneBtn = document.getElementById('find-replace-one');
  const replaceAllBtn = document.getElementById('find-replace-all');
  replaceInput.style.display = replaceMode ? 'inline-block' : 'none';
  replaceOneBtn.style.display = replaceMode ? 'inline-flex' : 'none';
  replaceAllBtn.style.display = replaceMode ? 'inline-flex' : 'none';
  return bar;
}

export function showFindBar(replaceMode = false) {
  ensureFindBar(replaceMode);
  const input = document.getElementById('find-input');
  input.focus();
  input.select();
  runSearch();
}

export function hideFindBar() {
  const bar = document.getElementById('find-bar');
  if (bar) bar.style.display = 'none';
  STATE.findMatches = [];
  STATE.findIndex = -1;
}

function runSearch() {
  const input = document.getElementById('find-input');
  const query = input ? input.value : '';
  STATE.findMatches = [];
  STATE.findIndex = -1;
  if (!query) { updateFindStatus(); return; }

  const sheet = getActiveSheet();
  const needle = query.toLowerCase();
  for (const [addr, cell] of Object.entries(sheet.cells)) {
    const val = String(cell.computed ?? cell.value ?? '').toLowerCase();
    if (val.includes(needle)) STATE.findMatches.push(addr);
  }
  STATE.findMatches.sort((a, b) => {
    const pa = parseCellAddr(a), pb = parseCellAddr(b);
    return pa.row - pb.row || pa.col - pb.col;
  });
  if (STATE.findMatches.length) {
    STATE.findIndex = 0;
    jumpToMatch();
  }
  updateFindStatus();
}

function jumpToMatch() {
  const addr = STATE.findMatches[STATE.findIndex];
  if (!addr) return;
  const parsed = parseCellAddr(addr);
  STATE.activeCell = { row: parsed.row, col: parsed.col };
  STATE.selection = { startRow: parsed.row, startCol: parsed.col, endRow: parsed.row, endCol: parsed.col };
  renderGrid();
  refreshActiveCell();
  scrollToActiveCell();
}

export function findNext(direction = 1) {
  if (!STATE.findMatches.length) { runSearch(); return; }
  STATE.findIndex = (STATE.findIndex + direction + STATE.findMatches.length) % STATE.findMatches.length;
  jumpToMatch();
  updateFindStatus();
}

function updateFindStatus() {
  const status = document.getElementById('find-status');
  if (!status) return;
  status.textContent = STATE.findMatches.length ? `${STATE.findIndex + 1} of ${STATE.findMatches.length}` : 'No results';
}

export function replaceOne() {
  if (STATE.findIndex < 0 || !STATE.findMatches.length) { runSearch(); return; }
  const addr = STATE.findMatches[STATE.findIndex];
  const parsed = parseCellAddr(addr);
  const cell = getCell(parsed.row, parsed.col);
  const findVal = document.getElementById('find-input').value;
  const replaceVal = document.getElementById('replace-input').value;
  if (!findVal) return;
  pushUndo();
  const newVal = String(cell.value || '').split(findVal).join(replaceVal);
  setCellValue(parsed.row, parsed.col, newVal);
  renderGrid();
  runSearch();
}

export function replaceAll() {
  const findVal = document.getElementById('find-input').value;
  const replaceVal = document.getElementById('replace-input').value;
  if (!findVal) return;
  pushUndo();
  const sheet = getActiveSheet();
  let count = 0;
  for (const [addr, cell] of Object.entries(sheet.cells)) {
    const val = String(cell.value || '');
    if (val.toLowerCase().includes(findVal.toLowerCase())) {
      const parsed = parseCellAddr(addr);
      const newVal = val.split(findVal).join(replaceVal);
      setCellValue(parsed.row, parsed.col, newVal);
      count++;
    }
  }
  renderGrid();
  runSearch();
  notify(`Replaced ${count} occurrence(s)`, 'info');
}
