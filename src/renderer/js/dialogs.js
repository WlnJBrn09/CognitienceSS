/**
 * Cognitience SS — Modal Dialogs: Settings, Keyboard Shortcuts, Function Picker
 * All modals are created dynamically since they aren't part of the static index.html.
 */

import { STATE, api } from './state.js';
import { FUNCTION_LIST } from './formula-engine.js';
import { renderGrid } from './grid-render.js';
import { toggleGridLines } from './view-toggles.js';
import { startEditing } from './editing.js';

function createBackdrop(zIndex) {
  const backdrop = document.createElement('div');
  backdrop.style.cssText = `position:fixed;top:0;left:0;width:100vw;height:100vh;background:var(--bg-overlay,rgba(0,0,0,0.4));z-index:${zIndex};`;
  return backdrop;
}

function removeModal(id) {
  document.getElementById(id)?.remove();
  document.getElementById(id + '-backdrop')?.remove();
}

// ─── Settings Modal ─────────────────────────────────────────────────

export function showSettingsModal() {
  removeModal('settings-panel');

  const backdrop = createBackdrop(1099);
  backdrop.id = 'settings-panel-backdrop';
  backdrop.addEventListener('click', () => removeModal('settings-panel'));

  const panel = document.createElement('div');
  panel.id = 'settings-panel';
  panel.innerHTML = `
    <div class="settings-header">
      <h3>Settings</h3>
      <button class="panel-close" id="settings-close">&times;</button>
    </div>
    <div class="settings-body">
      <div class="settings-group">
        <div class="settings-group-title">Editor</div>
        <div class="settings-row">
          <label for="setting-autosave">Auto Save</label>
          <input type="checkbox" id="setting-autosave" ${STATE.autoSaveEnabled ? 'checked' : ''} />
        </div>
        <div class="settings-row">
          <label for="setting-gridlines">Show Grid Lines</label>
          <input type="checkbox" id="setting-gridlines" ${STATE.showGridLines ? 'checked' : ''} />
        </div>
        <div class="settings-row">
          <label for="setting-formulas">Show Formulas</label>
          <input type="checkbox" id="setting-formulas" ${STATE.showFormulas ? 'checked' : ''} />
        </div>
      </div>
      <div class="settings-group">
        <div class="settings-group-title">Appearance</div>
        <div class="settings-row">
          <label for="setting-theme">Theme</label>
          <select id="setting-theme">
            <option value="cognitience-light">Cognitience Light</option>
            <option value="cognitience-dark">Cognitience Dark</option>
            <option value="cognitience-sepia">Cognitience Sepia</option>
            <option value="cognitience-contrast-dark">High Contrast Dark</option>
          </select>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(panel);

  const themeSelect = panel.querySelector('#setting-theme');
  if (themeSelect) themeSelect.value = document.documentElement.getAttribute('data-theme') || 'cognitience-light';

  panel.querySelector('#settings-close').addEventListener('click', () => removeModal('settings-panel'));

  panel.querySelector('#setting-autosave').addEventListener('change', (e) => {
    STATE.autoSaveEnabled = e.target.checked;
    api.config.set('editor.autoSave', e.target.checked);
  });
  panel.querySelector('#setting-gridlines').addEventListener('change', (e) => {
    if (e.target.checked !== STATE.showGridLines) toggleGridLines();
  });
  panel.querySelector('#setting-formulas').addEventListener('change', (e) => {
    STATE.showFormulas = e.target.checked;
    renderGrid();
  });
  themeSelect?.addEventListener('change', (e) => {
    document.documentElement.setAttribute('data-theme', e.target.value);
    api.theme.set(e.target.value);
  });
}

// ─── Keyboard Shortcuts Modal ───────────────────────────────────────

const SHORTCUTS = [
  { keys: 'Ctrl+N', desc: 'New spreadsheet' },
  { keys: 'Ctrl+O', desc: 'Open file' },
  { keys: 'Ctrl+S', desc: 'Save' },
  { keys: 'Ctrl+Shift+S', desc: 'Save as' },
  { keys: 'Ctrl+Z', desc: 'Undo' },
  { keys: 'Ctrl+Y', desc: 'Redo' },
  { keys: 'Ctrl+C / Ctrl+X / Ctrl+V', desc: 'Copy / cut / paste' },
  { keys: 'Ctrl+B / Ctrl+I / Ctrl+U', desc: 'Bold / italic / underline' },
  { keys: 'Ctrl+F', desc: 'Find' },
  { keys: 'Ctrl+H', desc: 'Find & replace' },
  { keys: 'Ctrl+`', desc: 'Toggle show formulas' },
  { keys: 'Ctrl+Shift+P', desc: 'Command palette' },
  { keys: 'Arrows / Tab / Enter', desc: 'Navigate cells' },
  { keys: 'F2', desc: 'Edit active cell' },
  { keys: 'Delete / Backspace', desc: 'Clear selected cells' },
  { keys: 'Ctrl+,', desc: 'Settings' },
];

export function showShortcutsModal() {
  removeModal('shortcuts-modal');

  const backdrop = createBackdrop(1199);
  backdrop.id = 'shortcuts-modal-backdrop';
  backdrop.addEventListener('click', () => removeModal('shortcuts-modal'));

  const modal = document.createElement('div');
  modal.id = 'shortcuts-modal';
  modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:480px;background:var(--bg-menu);border:1px solid var(--border-color);border-radius:10px;box-shadow:0 12px 40px var(--shadow);z-index:1200;overflow:hidden;';
  modal.innerHTML = `
    <div class="wizard-header">
      <h3>Keyboard Shortcuts</h3>
      <button class="wizard-close" id="shortcuts-close">&times;</button>
    </div>
    <div class="wizard-list" style="max-height:400px;">
      ${SHORTCUTS.map((s) => `
        <div class="wizard-item" style="display:flex;justify-content:space-between;align-items:center;">
          <span class="fn-desc" style="margin-top:0;">${s.desc}</span>
          <span class="fn-name" style="font-size:12px;">${s.keys}</span>
        </div>
      `).join('')}
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
  modal.querySelector('#shortcuts-close').addEventListener('click', () => removeModal('shortcuts-modal'));
}

// ─── Function Picker ─────────────────────────────────────────────────

export function showFunctionPicker() {
  removeModal('function-wizard');

  const backdrop = createBackdrop(1199);
  backdrop.id = 'function-wizard-backdrop';
  backdrop.addEventListener('click', () => removeModal('function-wizard'));

  const modal = document.createElement('div');
  modal.id = 'function-wizard';
  modal.innerHTML = `
    <div class="wizard-header">
      <h3>Insert Function</h3>
      <button class="wizard-close" id="fn-wizard-close">&times;</button>
    </div>
    <div class="wizard-search">
      <input type="text" id="fn-wizard-search" placeholder="Search functions…" />
    </div>
    <div class="wizard-list" id="fn-wizard-list"></div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  const list = modal.querySelector('#fn-wizard-list');
  const searchInput = modal.querySelector('#fn-wizard-search');

  function renderList(filter = '') {
    const filtered = FUNCTION_LIST.filter((f) => f.name.toLowerCase().includes(filter.toLowerCase()));
    list.innerHTML = filtered.map((f) => `
      <div class="wizard-item" data-name="${f.name}">
        <div class="fn-name">${f.name}(...)</div>
        <div class="fn-desc">${f.desc} — e.g. <code>=${f.example}</code></div>
      </div>
    `).join('');
    list.querySelectorAll('.wizard-item').forEach((el) => {
      el.addEventListener('click', () => {
        insertFunctionIntoCell(el.dataset.name);
        removeModal('function-wizard');
      });
    });
  }

  searchInput.addEventListener('input', () => renderList(searchInput.value));
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') removeModal('function-wizard'); });
  modal.querySelector('#fn-wizard-close').addEventListener('click', () => removeModal('function-wizard'));

  renderList();
  searchInput.focus();
}

function insertFunctionIntoCell(name) {
  const formulaInput = document.getElementById('formula-input');
  if (!formulaInput) return;

  if (!STATE.isEditing) {
    startEditing(STATE.activeCell.row, STATE.activeCell.col);
  }

  const current = formulaInput.value || '';
  const insertion = name + '(';
  const newValue = current.startsWith('=') ? current + insertion : '=' + insertion;
  formulaInput.value = newValue;
  formulaInput.focus();
  formulaInput.setSelectionRange(newValue.length, newValue.length);
}
