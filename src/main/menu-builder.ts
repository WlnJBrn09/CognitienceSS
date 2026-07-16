/**
 * Cognitience SS — Menu Builder
 * Constructs the application menu (File, Edit, View, Insert, Format, Tools, Help).
 */

import { Menu, dialog, app, shell } from 'electron';
import { WindowManager } from './window-manager';
import { ConfigStore } from './config-store';
import { APP_PUBLISHER, GITHUB_RELEASES_URL } from '../shared/constants';

export class MenuBuilder {
  constructor(
    private windowManager: WindowManager,
    private configStore: ConfigStore,
  ) {}

  buildMenu(): Menu {
    const template: Electron.MenuItemConstructorOptions[] = [
      // ─── File Menu ────────────────────────────────────
      {
        label: '&File',
        submenu: [
          {
            label: 'New Spreadsheet',
            accelerator: 'CmdOrCtrl+N',
            click: () => this.windowManager.send('sheet:new'),
          },
          {
            label: 'Open…',
            accelerator: 'CmdOrCtrl+O',
            click: () => this.windowManager.send('sheet:open'),
          },
          { type: 'separator' },
          {
            label: 'Save',
            accelerator: 'CmdOrCtrl+S',
            click: () => this.windowManager.send('sheet:save'),
          },
          {
            label: 'Save As…',
            accelerator: 'CmdOrCtrl+Shift+S',
            click: () => this.windowManager.send('sheet:saveAs'),
          },
          { type: 'separator' },
          {
            label: 'Export as…',
            submenu: [
              {
                label: 'CSV (.csv)',
                click: () => this.windowManager.send('sheet:export', { format: 'csv' }),
              },
              {
                label: 'TSV (.tsv)',
                click: () => this.windowManager.send('sheet:export', { format: 'tsv' }),
              },
              {
                label: 'JSON (.json)',
                click: () => this.windowManager.send('sheet:export', { format: 'json' }),
              },
              {
                label: 'Excel (.xlsx)',
                click: () => this.windowManager.send('sheet:export', { format: 'xlsx' }),
              },
              {
                label: 'HTML (.html)',
                click: () => this.windowManager.send('sheet:export', { format: 'html' }),
              },
              {
                label: 'PDF (.pdf)',
                click: () => this.windowManager.send('sheet:export', { format: 'pdf' }),
              },
              {
                label: 'Cognitience Spreadsheet (.cogss)',
                click: () => this.windowManager.send('sheet:export', { format: 'cogss' }),
              },
            ],
          },
          { type: 'separator' },
          {
            label: 'Print…',
            accelerator: 'CmdOrCtrl+P',
            click: () => this.windowManager.send('sheet:print'),
          },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },

      // ─── Edit Menu ────────────────────────────────────
      {
        label: '&Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Find',
            accelerator: 'CmdOrCtrl+F',
            click: () => this.windowManager.send('edit:find'),
          },
          {
            label: 'Replace',
            accelerator: 'CmdOrCtrl+H',
            click: () => this.windowManager.send('edit:replace'),
          },
          { type: 'separator' },
          {
            label: 'Fill Down',
            accelerator: 'CmdOrCtrl+D',
            click: () => this.windowManager.send('edit:fillDown'),
          },
          {
            label: 'Fill Right',
            accelerator: 'CmdOrCtrl+R',
            click: () => this.windowManager.send('edit:fillRight'),
          },
          { type: 'separator' },
          {
            label: 'Delete Row',
            click: () => this.windowManager.send('edit:deleteRow'),
          },
          {
            label: 'Delete Column',
            click: () => this.windowManager.send('edit:deleteColumn'),
          },
          {
            label: 'Insert Row Above',
            accelerator: 'CmdOrCtrl+Shift+=',
            click: () => this.windowManager.send('edit:insertRowAbove'),
          },
          {
            label: 'Insert Column Left',
            accelerator: 'CmdOrCtrl+Shift+Alt+=',
            click: () => this.windowManager.send('edit:insertColumnLeft'),
          },
        ],
      },

      // ─── View Menu ────────────────────────────────────
      {
        label: '&View',
        submenu: [
          {
            label: 'Toggle Formula Bar',
            click: () => this.windowManager.send('view:toggleFormulaBar'),
          },
          {
            label: 'Toggle Status Bar',
            click: () => this.windowManager.send('view:toggleStatusBar'),
          },
          {
            label: 'Toggle Grid Lines',
            click: () => this.windowManager.send('view:toggleGridLines'),
          },
          { type: 'separator' },
          {
            label: 'Show Formulas',
            accelerator: 'CmdOrCtrl+`',
            type: 'checkbox',
            checked: this.configStore.get('editor.showFormulas') as boolean,
            click: (menuItem) => {
              this.configStore.set('editor.showFormulas', menuItem.checked);
              this.windowManager.send('config:changed', { key: 'editor.showFormulas', value: menuItem.checked });
            },
          },
          {
            label: 'Freeze Panes',
            click: () => this.windowManager.send('view:freezePanes'),
          },
          { type: 'separator' },
          {
            label: 'Zoom In',
            accelerator: 'CmdOrCtrl+=',
            click: () => this.windowManager.send('view:zoomIn'),
          },
          {
            label: 'Zoom Out',
            accelerator: 'CmdOrCtrl+-',
            click: () => this.windowManager.send('view:zoomOut'),
          },
          {
            label: 'Reset Zoom',
            accelerator: 'CmdOrCtrl+0',
            click: () => this.windowManager.send('view:zoomReset'),
          },
          { type: 'separator' },
          {
            label: 'Toggle Full Screen',
            accelerator: 'F11',
            click: () => this.windowManager.send('view:toggleFullscreen'),
          },
          { type: 'separator' },
          {
            label: 'Command Palette…',
            accelerator: 'CmdOrCtrl+Shift+P',
            click: () => this.windowManager.send('view:commandPalette'),
          },
          { type: 'separator' },
          {
            label: 'Switch Theme',
            submenu: this.buildThemeMenu(),
          },
        ],
      },

      // ─── Insert Menu ──────────────────────────────────
      {
        label: '&Insert',
        submenu: [
          {
            label: 'Row Above',
            click: () => this.windowManager.send('edit:insertRowAbove'),
          },
          {
            label: 'Row Below',
            click: () => this.windowManager.send('edit:insertRowBelow'),
          },
          {
            label: 'Column Left',
            click: () => this.windowManager.send('edit:insertColumnLeft'),
          },
          {
            label: 'Column Right',
            click: () => this.windowManager.send('edit:insertColumnRight'),
          },
          { type: 'separator' },
          {
            label: 'New Sheet',
            accelerator: 'CmdOrCtrl+Shift+N',
            click: () => this.windowManager.send('sheet:addSheet'),
          },
          { type: 'separator' },
          {
            label: 'Function…',
            accelerator: 'Shift+F3',
            click: () => this.windowManager.send('insert:function'),
          },
        ],
      },

      // ─── Format Menu ──────────────────────────────────
      {
        label: 'F&ormat',
        submenu: [
          {
            label: 'Number Format',
            submenu: [
              { label: 'Automatic', click: () => this.windowManager.send('format:number', { type: 'auto' }) },
              { label: 'Number', click: () => this.windowManager.send('format:number', { type: 'number' }) },
              { label: 'Currency', click: () => this.windowManager.send('format:number', { type: 'currency' }) },
              { label: 'Percent', click: () => this.windowManager.send('format:number', { type: 'percent' }) },
              { label: 'Scientific', click: () => this.windowManager.send('format:number', { type: 'scientific' }) },
              { label: 'Date', click: () => this.windowManager.send('format:number', { type: 'date' }) },
              { label: 'Text', click: () => this.windowManager.send('format:number', { type: 'text' }) },
            ],
          },
          { type: 'separator' },
          {
            label: 'Align Left',
            click: () => this.windowManager.send('format:align', { align: 'left' }),
          },
          {
            label: 'Align Center',
            click: () => this.windowManager.send('format:align', { align: 'center' }),
          },
          {
            label: 'Align Right',
            click: () => this.windowManager.send('format:align', { align: 'right' }),
          },
          { type: 'separator' },
          {
            label: 'Bold',
            accelerator: 'CmdOrCtrl+B',
            click: () => this.windowManager.send('format:bold'),
          },
          {
            label: 'Italic',
            accelerator: 'CmdOrCtrl+I',
            click: () => this.windowManager.send('format:italic'),
          },
          {
            label: 'Underline',
            accelerator: 'CmdOrCtrl+U',
            click: () => this.windowManager.send('format:underline'),
          },
          {
            label: 'Strikethrough',
            click: () => this.windowManager.send('format:strikethrough'),
          },
          { type: 'separator' },
          {
            label: 'Increase Decimal',
            click: () => this.windowManager.send('format:decimal', { delta: 1 }),
          },
          {
            label: 'Decrease Decimal',
            click: () => this.windowManager.send('format:decimal', { delta: -1 }),
          },
          { type: 'separator' },
          {
            label: 'Auto-fit Column Width',
            click: () => this.windowManager.send('format:autoFitCol'),
          },
          {
            label: 'Auto-fit Row Height',
            click: () => this.windowManager.send('format:autoFitRow'),
          },
        ],
      },

      // ─── Tools Menu ──────────────────────────────────
      {
        label: '&Tools',
        submenu: [
          {
            label: 'Sort Ascending',
            click: () => this.windowManager.send('tools:sort', { direction: 'asc' }),
          },
          {
            label: 'Sort Descending',
            click: () => this.windowManager.send('tools:sort', { direction: 'desc' }),
          },
          { type: 'separator' },
          {
            label: 'Filter…',
            click: () => this.windowManager.send('tools:filter'),
          },
          {
            label: 'Remove Filter',
            click: () => this.windowManager.send('tools:removeFilter'),
          },
          { type: 'separator' },
          {
            label: 'Auto Save',
            type: 'checkbox',
            checked: this.configStore.get('editor.autoSave') as boolean,
            click: (menuItem) => {
              this.configStore.set('editor.autoSave', menuItem.checked);
              this.windowManager.send('config:changed', { key: 'editor.autoSave', value: menuItem.checked });
            },
          },
          { type: 'separator' },
          {
            label: 'Settings…',
            accelerator: 'CmdOrCtrl+,',
            click: () => this.windowManager.send('tools:settings'),
          },
        ],
      },

      // ─── Help Menu ─────────────────────────────────────
      {
        label: '&Help',
        submenu: [
          {
            label: 'Documentation',
            click: () => shell.openExternal('https://github.com/Maq-Swarm/cognitience-ss#readme'),
          },
          {
            label: 'Keyboard Shortcuts',
            accelerator: 'CmdOrCtrl+/',
            click: () => this.windowManager.send('help:shortcuts'),
          },
          { type: 'separator' },
          {
            label: 'Report Issue',
            click: () => shell.openExternal('https://github.com/Maq-Swarm/cognitience-ss/issues'),
          },
          {
            label: 'Check for Updates',
            click: () => this.windowManager.send('help:checkUpdates'),
          },
          { type: 'separator' },
          {
            label: 'About Cognitience SS',
            click: () => {
              const win = this.windowManager.getMainWindow();
              if (win) {
                dialog.showMessageBox(win, {
                  type: 'info',
                  title: 'About Cognitience SS',
                  message: 'Cognitience SS',
                  detail: 'The VS Code of spreadsheets.\n\nVersion: ' + app.getVersion() + '\nPublisher: ' + APP_PUBLISHER + '\nLicense: MIT\nElectron: ' + process.versions.electron + '\nNode: ' + process.versions.node + '\nV8: ' + process.versions.v8,
                });
              }
            },
          },
        ],
      },
    ];

    return Menu.buildFromTemplate(template);
  }

  private buildThemeMenu(): Electron.MenuItemConstructorOptions[] {
    return [
      { label: 'Cognitience Dark', type: 'radio', checked: this.configStore.get('theme.current') === 'cognitience-dark', click: () => this.setTheme('cognitience-dark') },
      { label: 'Cognitience Light', type: 'radio', checked: this.configStore.get('theme.current') === 'cognitience-light', click: () => this.setTheme('cognitience-light') },
      { label: 'Cognitience Sepia', type: 'radio', checked: this.configStore.get('theme.current') === 'cognitience-sepia', click: () => this.setTheme('cognitience-sepia') },
      { label: 'High Contrast Dark', type: 'radio', checked: this.configStore.get('theme.current') === 'cognitience-contrast-dark', click: () => this.setTheme('cognitience-contrast-dark') },
    ];
  }

  private setTheme(themeId: string) {
    this.configStore.set('theme.current', themeId);
    this.windowManager.send('theme:changed', themeId);
  }
}
