/**
 * Cognitience SS — Window Manager
 * Creates and manages the main application window with state persistence.
 */

import { BrowserWindow, screen } from 'electron';
import * as path from 'path';
import { ConfigStore } from './config-store';
import { DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT, MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT } from '../shared/constants';

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private configStore: ConfigStore;

  constructor(configStore: ConfigStore) {
    this.configStore = configStore;
  }

  createMainWindow(): BrowserWindow {
    const savedBounds = this.configStore.get('window.bounds') as { x: number; y: number; width: number; height: number } | undefined;
    const isMaximized = this.configStore.get('window.maximized') as boolean | undefined;

    const bounds = savedBounds || {
      width: DEFAULT_WINDOW_WIDTH,
      height: DEFAULT_WINDOW_HEIGHT,
      x: undefined,
      y: undefined,
    };

    // Center if no saved position
    if (!bounds.x || !bounds.y) {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
      bounds.x = Math.round((screenWidth - bounds.width) / 2);
      bounds.y = Math.round((screenHeight - bounds.height) / 2);
    }

    const iconPath = path.join(__dirname, '..', '..', 'resources', 'icon.png');

    this.mainWindow = new BrowserWindow({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      minWidth: MIN_WINDOW_WIDTH,
      minHeight: MIN_WINDOW_HEIGHT,
      frame: false,
      titleBarStyle: 'hidden',
      icon: iconPath,
      backgroundColor: '#ffffff',
      show: false,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    // Load the renderer
    const rendererPath = path.join(__dirname, '..', 'renderer', 'index.html');
    this.mainWindow.loadFile(rendererPath);

    // Show when ready
    this.mainWindow.once('ready-to-show', () => {
      if (isMaximized) {
        this.mainWindow?.maximize();
      }
      this.mainWindow?.show();
    });

    // Save window state on move/resize
    this.mainWindow.on('resize', () => this.saveWindowState());
    this.mainWindow.on('move', () => this.saveWindowState());
    this.mainWindow.on('close', () => this.saveWindowState());

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    return this.mainWindow;
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  send(channel: string, ...args: unknown[]): void {
    this.mainWindow?.webContents.send(channel, ...args);
  }

  private saveWindowState(): void {
    if (!this.mainWindow) return;
    try {
      const bounds = this.mainWindow.getBounds();
      this.configStore.set('window.bounds', bounds);
      this.configStore.set('window.maximized', this.mainWindow.isMaximized());
    } catch {
      // Window may be closing
    }
  }
}
