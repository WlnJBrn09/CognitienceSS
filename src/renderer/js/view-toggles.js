/**
 * Cognitience SS — View Toggles
 */

import { STATE } from './state.js';
import { renderGrid } from './grid-render.js';
import { updateRightPanel } from './ui-chrome.js';

export function toggleGridLines() {
  STATE.showGridLines = !STATE.showGridLines;
  document.getElementById('grid-viewport')?.classList.toggle('no-grid-lines', !STATE.showGridLines);
}

export function toggleShowFormulas() {
  STATE.showFormulas = !STATE.showFormulas;
  renderGrid();
}

export function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('hidden');
}

export function toggleRightPanel() {
  const panel = document.getElementById('right-panel');
  if (!panel) return;
  panel.classList.toggle('hidden');
  updateRightPanel();
}
