/**
 * Cognitience SS — Export Manager
 * Handles exporting spreadsheets to multiple formats: .cogss, .csv, .tsv, .xlsx, .json, .html, .pdf
 */

import { BrowserWindow, dialog } from 'electron';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as XLSX from 'xlsx';
import { COGNITIENCE_DOC_FORMAT, APP_VERSION } from '../shared/constants';
import { ExportRequest } from '../shared/types';

export class ExportManager {

  async exportDocument(data: ExportRequest): Promise<{ success: boolean; filePath: string | null; error?: string }> {
    const { format, content, title } = data;

    const filters = this.getFilters(format);
    const result = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow() || undefined!, {
      title: `Export as ${format.toUpperCase()}`,
      defaultPath: title || 'Untitled',
      filters,
    });

    if (result.canceled || !result.filePath) {
      return { success: false, filePath: null };
    }

    const filePath = result.filePath;

    try {
      switch (format) {
        case 'cogss':
        case 'csv':
        case 'tsv':
        case 'json':
          fs.writeFileSync(filePath, content, 'utf-8');
          break;
        case 'xlsx':
          this.exportXlsx(filePath, content);
          break;
        case 'html':
          this.exportHtml(filePath, content, title);
          break;
        case 'pdf':
          await this.exportPdf(filePath, content, title);
          break;
        default:
          return { success: false, filePath: null, error: `Unknown format: ${format}` };
      }

      return { success: true, filePath };
    } catch (err) {
      return { success: false, filePath: null, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private getFilters(format: string): Electron.FileFilter[] {
    switch (format) {
      case 'cogss': return [{ name: 'Cognitience Spreadsheet', extensions: ['cogss'] }];
      case 'csv': return [{ name: 'CSV', extensions: ['csv'] }];
      case 'tsv': return [{ name: 'TSV', extensions: ['tsv'] }];
      case 'xlsx': return [{ name: 'Excel', extensions: ['xlsx'] }];
      case 'json': return [{ name: 'JSON', extensions: ['json'] }];
      case 'html': return [{ name: 'HTML', extensions: ['html'] }];
      case 'pdf': return [{ name: 'PDF', extensions: ['pdf'] }];
      default: return [{ name: 'All Files', extensions: ['*'] }];
    }
  }

  // ─── .cogss Format (YAML frontmatter + JSON body) ─────────

  buildCogss(workbookJson: string, title: string): string {
    const now = new Date();
    const workbook = JSON.parse(workbookJson);
    const stats = this.computeStats(workbook);

    const frontmatter = {
      magic: COGNITIENCE_DOC_FORMAT.magic,
      version: COGNITIENCE_DOC_FORMAT.version,
      title: title || 'Untitled',
      author: workbook.metadata?.author || '',
      created: workbook.createdAt || now.toISOString(),
      modified: now.toISOString(),
      app_version: APP_VERSION,
      format: COGNITIENCE_DOC_FORMAT.format,
      sheet_count: stats.sheetCount,
      cell_count: stats.cellCount,
      filled_cells: stats.filledCells,
      formula_count: stats.formulaCount,
    };

    const yamlStr = yaml.dump(frontmatter, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      sortKeys: false,
    });

    return `---\n${yamlStr}---\n\n${workbookJson}`;
  }

  parseCogss(raw: string): { frontmatter: Record<string, any>; content: string } | null {
    const trimmed = raw.trimStart();
    if (!trimmed.startsWith('---')) return null;

    const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) return null;

    const [, yamlStr, body] = match;
    try {
      const frontmatter = yaml.load(yamlStr) as Record<string, any> || {};
      if (frontmatter.magic !== COGNITIENCE_DOC_FORMAT.magic) return null;
      return { frontmatter, content: body.trim() };
    } catch {
      return null;
    }
  }

  // ─── Excel Export ─────────────────────────────────────────

  private exportXlsx(filePath: string, content: string) {
    let workbook: any;
    try {
      workbook = JSON.parse(content);
    } catch {
      // Fallback: treat as CSV
      const ws = XLSX.utils.aoa_to_sheet(
        content.split('\n').map((row) => row.split(','))
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      XLSX.writeFile(wb, filePath);
      return;
    }

    const wb = XLSX.utils.book_new();
    const sheets = workbook.sheets || [];
    for (const sheet of sheets) {
      const rows: any[][] = [];
      const cells = sheet.cells || {};
      let maxRow = 0;
      let maxCol = 0;
      for (const addr of Object.keys(cells)) {
        const m = addr.match(/^([A-Z]+)(\d+)$/);
        if (!m) continue;
        let col = 0;
        for (let i = 0; i < m[1].length; i++) col = col * 26 + (m[1].charCodeAt(i) - 64);
        col -= 1;
        const row = parseInt(m[2], 10) - 1;
        maxRow = Math.max(maxRow, row);
        maxCol = Math.max(maxCol, col);
      }
      for (let r = 0; r <= maxRow; r++) {
        const rowArr: any[] = [];
        for (let c = 0; c <= maxCol; c++) {
          let result = '';
          let n = c;
          while (n >= 0) {
            result = String.fromCharCode(65 + (n % 26)) + result;
            n = Math.floor(n / 26) - 1;
          }
          const key = result + (r + 1);
          const cell = cells[key];
          if (cell) {
            rowArr.push(cell.value ?? '');
          } else {
            rowArr.push('');
          }
        }
        rows.push(rowArr);
      }
      const ws = XLSX.utils.aoa_to_sheet(rows.length ? rows : [['']]);
      XLSX.utils.book_append_sheet(wb, ws, (sheet.name || 'Sheet').slice(0, 31));
    }
    if (sheets.length === 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), 'Sheet1');
    }
    XLSX.writeFile(wb, filePath);
  }

  /** Parse an Excel buffer into Cognitience workbook JSON string */
  static parseExcelBuffer(buffer: Buffer, title: string): string {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheets = wb.SheetNames.map((name, idx) => {
      const ws = wb.Sheets[name];
      const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
      const cells: Record<string, any> = {};
      for (let r = 0; r < aoa.length; r++) {
        const row = aoa[r] || [];
        for (let c = 0; c < row.length; c++) {
          const val = row[c];
          if (val === '' || val === null || val === undefined) continue;
          let result = '';
          let n = c;
          while (n >= 0) {
            result = String.fromCharCode(65 + (n % 26)) + result;
            n = Math.floor(n / 26) - 1;
          }
          const key = result + (r + 1);
          const str = String(val);
          const num = Number(val);
          cells[key] = {
            value: str,
            computed: (str !== '' && !isNaN(num) && str.trim() !== '') ? num : str,
            format: { type: 'auto', decimalPlaces: 2, currencySymbol: '$', dateFormat: 'MM/DD/YYYY' },
            style: {
              bold: false, italic: false, underline: false, strikethrough: false,
              fontFamily: "'Segoe UI', sans-serif", fontSize: 13,
              fontColor: '', bgColor: '', hAlign: 'auto', vAlign: 'middle', wrap: false,
            },
          };
        }
      }
      return {
        id: `sheet-import-${idx}-${Date.now()}`,
        name,
        cells,
        colWidths: {},
        rowHeights: {},
        frozenRows: 0,
        frozenCols: 0,
        mergedCells: [],
        conditionalFormats: [],
        filters: null,
      };
    });

    const workbook = {
      id: `wb-import-${Date.now()}`,
      title: title || 'Untitled',
      sheets: sheets.length ? sheets : [{
        id: `sheet-1`,
        name: 'Sheet 1',
        cells: {},
        colWidths: {},
        rowHeights: {},
        frozenRows: 0,
        frozenCols: 0,
        mergedCells: [],
        conditionalFormats: [],
        filters: null,
      }],
      activeSheetIndex: 0,
      filePath: null,
      isDirty: false,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      metadata: { author: '', subject: '', keywords: [], appVersion: APP_VERSION },
    };
    return JSON.stringify(workbook);
  }

  // ─── HTML Export ──────────────────────────────────────────

  private exportHtml(filePath: string, content: string, title: string) {
    let tableHtml = '';
    try {
      const workbook = JSON.parse(content);
      const sheet = workbook.sheets?.[workbook.activeSheetIndex || 0] || workbook.sheets?.[0];
      if (sheet) {
        const cells = sheet.cells || {};
        let maxRow = 0;
        let maxCol = 0;
        for (const addr of Object.keys(cells)) {
          const m = addr.match(/^([A-Z]+)(\d+)$/);
          if (!m) continue;
          let col = 0;
          for (let i = 0; i < m[1].length; i++) col = col * 26 + (m[1].charCodeAt(i) - 64);
          col -= 1;
          maxRow = Math.max(maxRow, parseInt(m[2], 10) - 1);
          maxCol = Math.max(maxCol, col);
        }
        const rows: string[] = [];
        for (let r = 0; r <= maxRow; r++) {
          const tds: string[] = [];
          for (let c = 0; c <= maxCol; c++) {
            let result = '';
            let n = c;
            while (n >= 0) {
              result = String.fromCharCode(65 + (n % 26)) + result;
              n = Math.floor(n / 26) - 1;
            }
            const cell = cells[result + (r + 1)];
            const val = cell ? String(cell.computed ?? cell.value ?? '') : '';
            tds.push(`<td>${val.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`);
          }
          rows.push(`<tr>${tds.join('')}</tr>`);
        }
        tableHtml = rows.join('\n');
      }
    } catch {
      tableHtml = content.split('\n').map(row => {
        const cells = row.split(',').map(cell =>
          `<td>${cell.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`
        ).join('');
        return `<tr>${cells}</tr>`;
      }).join('\n');
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title || 'Untitled'}</title>
<style>
body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; margin: 20px; color: #1e1e2e; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #cdd6f4; padding: 8px 12px; text-align: left; }
th { background: #f5f5f5; font-weight: 600; }
tr:nth-child(even) { background: #f8f8f8; }
h1 { font-size: 24px; margin-bottom: 16px; }
</style>
</head>
<body>
<h1>${title || 'Untitled'}</h1>
<table>${tableHtml}</table>
</body>
</html>`;
    fs.writeFileSync(filePath, html, 'utf-8');
  }

  // ─── PDF Export (via hidden BrowserWindow) ────────────────

  private async exportPdf(filePath: string, content: string, title: string): Promise<void> {
    const win = new BrowserWindow({
      show: false,
      width: 800,
      height: 1100,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        offscreen: true,
      },
    });

    let tableRows = '';
    try {
      const workbook = JSON.parse(content);
      const sheet = workbook.sheets?.[0];
      if (sheet) {
        const cells = sheet.cells || {};
        let maxRow = 0;
        let maxCol = 0;
        for (const addr of Object.keys(cells)) {
          const m = addr.match(/^([A-Z]+)(\d+)$/);
          if (!m) continue;
          let col = 0;
          for (let i = 0; i < m[1].length; i++) col = col * 26 + (m[1].charCodeAt(i) - 64);
          col -= 1;
          maxRow = Math.max(maxRow, parseInt(m[2], 10) - 1);
          maxCol = Math.max(maxCol, col);
        }
        for (let r = 0; r <= maxRow; r++) {
          const tds: string[] = [];
          for (let c = 0; c <= maxCol; c++) {
            let result = '';
            let n = c;
            while (n >= 0) {
              result = String.fromCharCode(65 + (n % 26)) + result;
              n = Math.floor(n / 26) - 1;
            }
            const cell = cells[result + (r + 1)];
            const val = cell ? String(cell.computed ?? cell.value ?? '') : '';
            tds.push(`<td>${val.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`);
          }
          tableRows += `<tr>${tds.join('')}</tr>`;
        }
      }
    } catch {
      tableRows = content.split('\n').map(row => {
        const cells = row.split(',').map(cell =>
          `<td>${cell.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`
        ).join('');
        return `<tr>${cells}</tr>`;
      }).join('\n');
    }

    const styledHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${title || 'Untitled'}</title>
<style>
@page { margin: 0.5in; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #000; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #000; padding: 4px 8px; text-align: left; }
th { background: #eee; font-weight: bold; }
h1 { font-size: 18pt; margin: 0 0 12px; }
</style>
</head>
<body>
<h1>${title || 'Untitled'}</h1>
<table>${tableRows}</table>
</body>
</html>`;

    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(styledHtml));
    await new Promise(resolve => setTimeout(resolve, 500));

    const pdfBuffer = await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { marginType: 'custom', top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
    });

    fs.writeFileSync(filePath, pdfBuffer);
    win.close();
  }

  // ─── Helpers ──────────────────────────────────────────────

  private computeStats(workbook: any): { sheetCount: number; cellCount: number; filledCells: number; formulaCount: number } {
    const sheets = workbook.sheets || [];
    let filledCells = 0;
    let formulaCount = 0;
    for (const sheet of sheets) {
      const cells = sheet.cells || {};
      for (const [, cell] of Object.entries(cells)) {
        if ((cell as any).value !== '' && (cell as any).value !== null) {
          filledCells++;
          if (typeof (cell as any).value === 'string' && (cell as any).value.startsWith('=')) {
            formulaCount++;
          }
        }
      }
    }
    return {
      sheetCount: sheets.length,
      cellCount: 0,
      filledCells,
      formulaCount,
    };
  }
}
