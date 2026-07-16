/**
 * Cognitience SS — Preload Script
 * Exposes a safe API bridge between the main process and renderer via contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // ─── Spreadsheet Operations ──────────────────────────────
  sheet: {
    new: () => ipcRenderer.invoke('sheet:new'),
    open: (filePath?: string) => ipcRenderer.invoke('sheet:open', filePath),
    save: (data: { content: string; filePath: string; title: string }) =>
      ipcRenderer.invoke('sheet:save', data),
    saveAs: (data: { content: string; title: string }) =>
      ipcRenderer.invoke('sheet:saveAs', data),
    export: (data: { format: string; content: string; title: string }) =>
      ipcRenderer.invoke('sheet:export', data),
    print: () => ipcRenderer.invoke('sheet:print'),
    getStats: () => ipcRenderer.invoke('sheet:getStats'),
  },

  // ─── Configuration ───────────────────────────────────────
  config: {
    get: (key: string) => ipcRenderer.invoke('config:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('config:set', key, value),
    getAll: () => ipcRenderer.invoke('config:getAll'),
  },

  // ─── Theme ───────────────────────────────────────────────
  theme: {
    get: () => ipcRenderer.invoke('theme:get'),
    set: (themeId: string) => ipcRenderer.invoke('theme:set', themeId),
    list: () => ipcRenderer.invoke('theme:list'),
  },

  // ─── Clipboard ──────────────────────────────────────────
  clipboard: {
    write: (text: string) => ipcRenderer.invoke('clipboard:write', text),
    read: () => ipcRenderer.invoke('clipboard:read'),
  },

  // ─── File System ─────────────────────────────────────────
  fs: {
    read: (filePath: string) => ipcRenderer.invoke('fs:read', filePath),
    write: (filePath: string, content: string) => ipcRenderer.invoke('fs:write', filePath, content),
    exists: (filePath: string) => ipcRenderer.invoke('fs:exists', filePath),
    mkdir: (dirPath: string) => ipcRenderer.invoke('fs:mkdir', dirPath),
  },

  // ─── Dialog ────────────────────────────────────────────
  dialog: {
    openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
    newFolder: () => ipcRenderer.invoke('dialog:newFolder'),
  },

  // ─── Window ──────────────────────────────────────────────
  window: {
    minimize: () => ipcRenderer.invoke('win:minimize'),
    maximize: () => ipcRenderer.invoke('win:maximize'),
    close: () => ipcRenderer.invoke('win:close'),
    fullscreen: () => ipcRenderer.invoke('win:fullscreen'),
  },

  // ─── Updates ─────────────────────────────────────────────
  updates: {
    check: () => ipcRenderer.invoke('updates:check'),
    downloadAndInstall: (url: string) => ipcRenderer.invoke('updates:downloadAndInstall', url),
  },

  // ─── Event Listeners ─────────────────────────────────────
  on: (channel: string, callback: (...args: any[]) => void) => {
    const validChannels = [
      'sheet:new', 'sheet:open', 'sheet:save', 'sheet:saveAs', 'sheet:export', 'sheet:print', 'sheet:addSheet',
      'edit:find', 'edit:replace', 'edit:fillDown', 'edit:fillRight',
      'edit:deleteRow', 'edit:deleteColumn', 'edit:insertRowAbove', 'edit:insertRowBelow',
      'edit:insertColumnLeft', 'edit:insertColumnRight',
      'insert:function', 'insert:chart', 'insert:link', 'insert:comment',
      'format:number', 'format:align', 'format:bold', 'format:italic', 'format:underline',
      'format:strikethrough', 'format:decimal', 'format:autoFitCol', 'format:autoFitRow',
      'tools:sort', 'tools:filter', 'tools:removeFilter', 'tools:settings',
      'view:toggleFormulaBar', 'view:toggleStatusBar', 'view:toggleGridLines',
      'view:freezePanes', 'view:zoomIn', 'view:zoomOut', 'view:zoomReset',
      'view:toggleFullscreen', 'view:commandPalette',
      'config:changed', 'theme:changed',
      'dialog:openFolder', 'dialog:newFolder',
      'help:shortcuts', 'help:checkUpdates',
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },

  removeListener: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
};

contextBridge.exposeInMainWorld('cognitience', api);
