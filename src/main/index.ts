/**
 * Cognitience SS — Main Process Entry
 * Bootstraps the Electron app, creates the window, and initializes subsystems.
 */

import { app, BrowserWindow, Menu } from 'electron';
import { WindowManager } from './window-manager';
import { IPCMainRegistry } from './ipc-registry';
import { ConfigStore } from './config-store';
import { MenuBuilder } from './menu-builder';

let windowManager: WindowManager;
let configStore: ConfigStore;
let ipcRegistry: IPCMainRegistry;

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.whenReady().then(() => {
  configStore = new ConfigStore();
  windowManager = new WindowManager(configStore);
  ipcRegistry = new IPCMainRegistry(windowManager, configStore);

  ipcRegistry.registerAll();
  windowManager.createMainWindow();

  const menuBuilder = new MenuBuilder(windowManager, configStore);
  Menu.setApplicationMenu(menuBuilder.buildMenu());

  console.log(`[Cognitience SS] v${app.getVersion()} ready`);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    windowManager.createMainWindow();
  }
});

app.on('second-instance', () => {
  const win = windowManager.getMainWindow();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});
