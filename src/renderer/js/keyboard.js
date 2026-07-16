/**
 * Cognitience SS — Keyboard Handling
 */

import { STATE, INITIAL_ROWS, INITIAL_COLS } from './state.js';
import { parseCellAddr } from './helpers.js';
import { undo, redo } from './workbook.js';
import { renderGrid } from './grid-render.js';
import { startEditing, finishEditing, cancelEditing, refreshActiveCell } from './editing.js';
import { moveActiveCell, deleteSelectedCells } from './selection.js';
import { copyCells, cutCells, pasteCells } from './clipboard.js';
import { applyStyle } from './formatting.js';
import { newSpreadsheet, openSpreadsheet, saveSpreadsheet, saveAs } from './file-io.js';
import { toggleShowFormulas } from './view-toggles.js';
import { toggleCommandPalette } from './command-palette.js';
import { showFindBar } from './find-replace.js';
import { updateStatusBar } from './ui-chrome.js';

export function initKeyboardHandlers() {
  document.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;

    // ── Editing mode ──
    if (STATE.isEditing) {
      if (e.key === 'Enter') {
        e.preventDefault();
        finishEditing();
        moveActiveCell(1, 0);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEditing();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        finishEditing();
        moveActiveCell(0, e.shiftKey ? -1 : 1);
      }
      return;
    }

    // ── Formula bar focused (not yet marked editing) ──
    if (document.activeElement === document.getElementById('formula-input')) {
      if (e.key === 'Enter') { e.preventDefault(); finishEditing(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelEditing(); }
      return;
    }

    // ── Cell address box ──
    if (document.activeElement === document.getElementById('cell-address')) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const addr = document.getElementById('cell-address').value.toUpperCase();
        const parsed = parseCellAddr(addr);
        if (parsed) {
          STATE.activeCell = parsed;
          STATE.selection = { startRow: parsed.row, startCol: parsed.col, endRow: parsed.row, endCol: parsed.col };
          renderGrid();
          refreshActiveCell();
        }
      }
      return;
    }

    // ── Find bar input focused: let find-replace.js handle its own keys ──
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#find-bar')) {
      return;
    }

    // ── Ctrl/Cmd shortcuts ──
    if (ctrl) {
      switch (e.key.toLowerCase()) {
        case 'n':
          if (e.shiftKey) return; // handled elsewhere (add sheet)
          e.preventDefault(); newSpreadsheet(); return;
        case 'o': e.preventDefault(); openSpreadsheet(); return;
        case 's':
          e.preventDefault();
          if (e.shiftKey) saveAs(); else saveSpreadsheet();
          return;
        case 'z': e.preventDefault(); undo(); renderGrid(); refreshActiveCell(); updateStatusBar(); return;
        case 'y': e.preventDefault(); redo(); renderGrid(); refreshActiveCell(); updateStatusBar(); return;
        case 'c': e.preventDefault(); copyCells(); return;
        case 'x': e.preventDefault(); cutCells(); return;
        case 'v': e.preventDefault(); pasteCells(); return;
        case 'b': e.preventDefault(); applyStyle('bold'); return;
        case 'i': e.preventDefault(); applyStyle('italic'); return;
        case 'u': e.preventDefault(); applyStyle('underline'); return;
        case 'f': e.preventDefault(); showFindBar(false); return;
        case 'h': e.preventDefault(); showFindBar(true); return;
        case '`': e.preventDefault(); toggleShowFormulas(); return;
        case 'p':
          if (e.shiftKey) { e.preventDefault(); toggleCommandPalette(); return; }
          break;
        default: break;
      }
      if (e.shiftKey && e.key === 'Z') { e.preventDefault(); redo(); renderGrid(); refreshActiveCell(); updateStatusBar(); return; }
    }

    // ── Navigation ──
    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); moveActiveCell(-1, 0, e.shiftKey); break;
      case 'ArrowDown': e.preventDefault(); moveActiveCell(1, 0, e.shiftKey); break;
      case 'ArrowLeft': e.preventDefault(); moveActiveCell(0, -1, e.shiftKey); break;
      case 'ArrowRight': e.preventDefault(); moveActiveCell(0, 1, e.shiftKey); break;
      case 'Enter': e.preventDefault(); startEditing(STATE.activeCell.row, STATE.activeCell.col); break;
      case 'Tab': e.preventDefault(); moveActiveCell(0, e.shiftKey ? -1 : 1); break;
      case 'Delete':
      case 'Backspace': e.preventDefault(); deleteSelectedCells(); break;
      case 'F2': e.preventDefault(); startEditing(STATE.activeCell.row, STATE.activeCell.col); break;
      default:
        if (e.key.length === 1 && !ctrl && !e.altKey) {
          startEditing(STATE.activeCell.row, STATE.activeCell.col);
          const formulaInput = document.getElementById('formula-input');
          if (formulaInput) formulaInput.value = '';
        }
    }
  });
}
