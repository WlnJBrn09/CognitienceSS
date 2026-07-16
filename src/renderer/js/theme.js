/**
 * Cognitience SS — Theme Management
 */

import { api } from './state.js';

const THEME_NAMES = {
  'cognitience-light': 'Cognitience Light',
  'cognitience-dark': 'Cognitience Dark',
  'cognitience-sepia': 'Cognitience Sepia',
  'cognitience-contrast-dark': 'High Contrast Dark',
};

export async function initTheme() {
  const theme = await api.theme.get();
  if (theme) document.documentElement.setAttribute('data-theme', theme);
  updateThemeStatus(theme || 'cognitience-light');
}

export function setTheme(themeId) {
  document.documentElement.setAttribute('data-theme', themeId);
  api.theme.set(themeId);
  updateThemeStatus(themeId);
}

function updateThemeStatus(themeId) {
  const el = document.getElementById('status-theme');
  if (el) el.textContent = THEME_NAMES[themeId] || themeId;
}
