/**
 * Cognitience SS — IPC Registry
 * Registers all IPC handlers between the main process and renderer.
 */

import { ipcMain, dialog, clipboard, shell, BrowserWindow, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import { WindowManager } from './window-manager';
import { ConfigStore } from './config-store';
import { ExportManager } from './export-manager';
import { BUILTIN_THEMES, GITHUB_LATEST_API, GITHUB_RELEASES_URL, NATIVE_EXTENSION, SUPPORTED_IMPORT_EXTENSIONS } from '../shared/constants';

export class IPCMainRegistry {
  private exportManager: ExportManager;

  constructor(
    private windowManager: WindowManager,
    private configStore: ConfigStore,
  ) {
    this.exportManager = new ExportManager();
  }

  registerAll() {
    this.registerSpreadsheetHandlers();
    this.registerConfigHandlers();
    this.registerThemeHandlers();
    this.registerClipboardHandlers();
    this.registerFileHandlers();
    this.registerWindowHandlers();
    this.registerUpdateHandlers();
  }

  // ─── Spreadsheet Operations ─────────────────────────────────

  private registerSpreadsheetHandlers() {
    ipcMain.handle('sheet:new', async () => {
      this.windowManager.send('sheet:new');
      return { success: true };
    });

    ipcMain.handle('sheet:open', async (_, filePath?: string) => {
      if (!filePath) {
        const result = await dialog.showOpenDialog({
          title: 'Open Spreadsheet',
          filters: [
            { name: 'All Supported', extensions: SUPPORTED_IMPORT_EXTENSIONS },
            { name: 'Cognitience Spreadsheet', extensions: [NATIVE_EXTENSION] },
            { name: 'Excel', extensions: ['xlsx', 'xls'] },
            { name: 'CSV', extensions: ['csv'] },
            { name: 'TSV', extensions: ['tsv'] },
            { name: 'OpenDocument', extensions: ['ods'] },
            { name: 'JSON', extensions: ['json'] },
            { name: 'HTML', extensions: ['html', 'htm'] },
            { name: 'All Files', extensions: ['*'] },
          ],
          properties: ['openFile'],
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        filePath = result.filePaths[0];
      }

      const ext = path.extname(filePath).toLowerCase();
      let content = '';
      let format = 'unknown';

      try {
        if (ext === '.cogss') {
          content = fs.readFileSync(filePath, 'utf-8');
          format = 'cognitience';
        } else if (ext === '.csv') {
          content = fs.readFileSync(filePath, 'utf-8');
          format = 'csv';
        } else if (ext === '.tsv') {
          content = fs.readFileSync(filePath, 'utf-8');
          format = 'tsv';
        } else if (ext === '.xlsx' || ext === '.xls') {
          const buffer = fs.readFileSync(filePath);
          content = ExportManager.parseExcelBuffer(buffer, path.basename(filePath, ext));
          format = 'xlsx';
        } else if (ext === '.json') {
          content = fs.readFileSync(filePath, 'utf-8');
          format = 'json';
        } else if (ext === '.html' || ext === '.htm') {
          content = fs.readFileSync(filePath, 'utf-8');
          format = 'html';
        } else if (ext === '.ods') {
          // ODS via SheetJS when possible
          try {
            const buffer = fs.readFileSync(filePath);
            content = ExportManager.parseExcelBuffer(buffer, path.basename(filePath, ext));
            format = 'ods';
          } catch {
            content = fs.readFileSync(filePath).toString('base64');
            format = 'ods';
          }
        } else {
          content = fs.readFileSync(filePath, 'utf-8');
          format = 'plaintext';
        }
      } catch (e) {
        throw new Error(`Failed to open file: ${e instanceof Error ? e.message : String(e)}`);
      }

      return {
        title: path.basename(filePath, ext),
        content,
        format,
        filePath,
      };
    });

    ipcMain.handle('sheet:save', async (_, data: { content: string; filePath: string; title: string }) => {
      fs.writeFileSync(data.filePath, data.content, 'utf-8');
      return { success: true, filePath: data.filePath };
    });

    ipcMain.handle('sheet:saveAs', async (_, data: { content: string; title: string }) => {
      const result = await dialog.showSaveDialog({
        title: 'Save Spreadsheet',
        defaultPath: data.title || 'Untitled',
        filters: [
          { name: 'Cognitience Spreadsheet', extensions: [NATIVE_EXTENSION] },
          { name: 'CSV', extensions: ['csv'] },
          { name: 'TSV', extensions: ['tsv'] },
          { name: 'JSON', extensions: ['json'] },
          { name: 'HTML', extensions: ['html'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (result.canceled || !result.filePath) return null;

      fs.writeFileSync(result.filePath, data.content, 'utf-8');
      return { success: true, filePath: result.filePath };
    });

    ipcMain.handle('sheet:export', async (_, data: { format: string; content: string; title: string }) => {
      return this.exportManager.exportDocument({
        format: data.format as any,
        content: data.content,
        title: data.title,
      });
    });

    ipcMain.handle('sheet:print', async () => {
      const win = this.windowManager.getMainWindow();
      if (!win) return { success: false };
      win.webContents.print({ silent: false, printBackground: true });
      return { success: true };
    });
  }

  // ─── Configuration ─────────────────────────────────────────

  private registerConfigHandlers() {
    ipcMain.handle('config:get', async (_, key: string) => {
      return this.configStore.get(key);
    });

    ipcMain.handle('config:set', async (_, key: string, value: unknown) => {
      this.configStore.set(key, value);
      this.windowManager.send('config:changed', { key, value });
      return { success: true };
    });

    ipcMain.handle('config:getAll', async () => {
      return this.configStore.getAll();
    });
  }

  // ─── Theme ─────────────────────────────────────────────────

  private registerThemeHandlers() {
    ipcMain.handle('theme:get', async () => {
      return this.configStore.get('theme.current');
    });

    ipcMain.handle('theme:set', async (_, themeId: string) => {
      this.configStore.set('theme.current', themeId);
      this.windowManager.send('theme:changed', themeId);
      return { success: true };
    });

    ipcMain.handle('theme:list', async () => {
      return BUILTIN_THEMES;
    });
  }

  // ─── Clipboard ────────────────────────────────────────────

  private registerClipboardHandlers() {
    ipcMain.handle('clipboard:write', async (_, text: string) => {
      clipboard.writeText(text);
      return { success: true };
    });

    ipcMain.handle('clipboard:read', async () => {
      return clipboard.readText();
    });
  }

  // ─── File System ──────────────────────────────────────────

  private registerFileHandlers() {
    ipcMain.handle('fs:read', async (_, filePath: string) => {
      try {
        return fs.readFileSync(filePath, 'utf-8');
      } catch (err) {
        throw new Error(`Failed to read file: ${err}`);
      }
    });

    ipcMain.handle('fs:write', async (_, filePath: string, content: string) => {
      fs.writeFileSync(filePath, content, 'utf-8');
      return { success: true };
    });

    ipcMain.handle('fs:exists', async (_, filePath: string) => {
      return fs.existsSync(filePath);
    });

    ipcMain.handle('fs:mkdir', async (_, dirPath: string) => {
      fs.mkdirSync(dirPath, { recursive: true });
      return { success: true };
    });

    ipcMain.handle('dialog:openFolder', async () => {
      const result = await dialog.showOpenDialog({
        title: 'Open Folder',
        properties: ['openDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      const folderPath = result.filePaths[0];
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });
      const files = entries
        .filter(e => e.isFile())
        .map(e => ({ name: e.name, path: path.join(folderPath, e.name) }));
      const folders = entries
        .filter(e => e.isDirectory())
        .map(e => ({ name: e.name, path: path.join(folderPath, e.name) }));
      return { path: folderPath, files, folders };
    });

    ipcMain.handle('dialog:newFolder', async () => {
      const result = await dialog.showOpenDialog({
        title: 'New Folder Location',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0];
    });
  }

  // ─── Window ───────────────────────────────────────────────

  private registerWindowHandlers() {
    ipcMain.handle('win:minimize', async () => {
      this.windowManager.getMainWindow()?.minimize();
    });

    ipcMain.handle('win:maximize', async () => {
      const win = this.windowManager.getMainWindow();
      if (win) {
        if (win.isMaximized()) {
          win.unmaximize();
        } else {
          win.maximize();
        }
      }
    });

    ipcMain.handle('win:close', async () => {
      this.windowManager.getMainWindow()?.close();
    });

    ipcMain.handle('win:fullscreen', async () => {
      const win = this.windowManager.getMainWindow();
      if (win) {
        win.setFullScreen(!win.isFullScreen());
      }
    });
  }

  // ─── Update Checking ─────────────────────────────────────

  private registerUpdateHandlers() {
    ipcMain.handle('updates:check', async () => {
      try {
        const url = GITHUB_LATEST_API;

        const data: string = await new Promise((resolve, reject) => {
          const req = https.get(url, {
            headers: {
              'User-Agent': 'cognitience-ss',
              'Accept': 'application/vnd.github.v3+json',
            },
          }, (res: any) => {
            let body = '';
            res.on('data', (chunk: string) => body += chunk);
            res.on('end', () => resolve(body));
          });
          req.on('error', reject);
          req.setTimeout(10000, () => req.destroy(new Error('timeout')));
        });

        const release = JSON.parse(data);
        const latestVersion = release.tag_name?.replace(/^v/, '') || '';
        const downloadUrl = release.assets?.find((a: any) =>
          a.name.endsWith('.exe') || a.name.endsWith('Setup.exe')
        )?.browser_download_url || release.html_url;

        const currentVersion = app.getVersion();
        return {
          currentVersion,
          latestVersion,
          updateAvailable: latestVersion && latestVersion !== currentVersion,
          downloadUrl,
          releaseNotes: release.body || '',
          releaseUrl: release.html_url || GITHUB_RELEASES_URL,
        };
      } catch (err) {
        return {
          currentVersion: app.getVersion(),
          latestVersion: null,
          updateAvailable: false,
          error: err instanceof Error ? err.message : String(err),
          releaseUrl: GITHUB_RELEASES_URL,
        };
      }
    });

    ipcMain.handle('updates:downloadAndInstall', async (_, url: string) => {
      try {
        await shell.openExternal(url);
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    });
  }
}
