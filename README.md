# Cognitience SS

**The VS Code of spreadsheets.**

Cognitience SS is a modern desktop spreadsheet built with Electron and TypeScript. Part of the Cognitience suite — same design language and theming as [Cognitience WP](https://github.com/Maq-Swarm/cognitience-wp).

## Features

- **Spreadsheet grid** — 50×26 cells, expandable via insert row/column
- **Safe formula engine** — Tokenizer + recursive-descent evaluator (no `eval`); dependency graph with `#CIRCULAR!` detection; 20+ functions (SUM, AVERAGE, IF, CONCAT, …)
- **Cell formatting** — Bold, italic, underline, strikethrough, fonts, text/background color, alignment, number formats
- **Merge, sort & filter** — Merge/unmerge selection, sort A→Z / Z→A, auto-filter
- **Find & replace** — Ctrl+F / Ctrl+H
- **Freeze panes** — Freeze at the active cell
- **4 themes** — Cognitience Light, Dark (Catppuccin Mocha–inspired), Sepia, High Contrast Dark
- **Multi-sheet workbooks** — Add, rename, delete, duplicate, reorder
- **Undo/redo** — Up to 100 levels
- **File I/O** — Native `.cogss`, CSV/TSV/JSON, Excel `.xlsx`/`.xls` import & export, HTML & PDF export
- **Auto-save** — After 3 seconds of inactivity (when a file path exists)
- **Command palette** — Ctrl+Shift+P
- **Print, settings & shortcuts** — From the application menu

## Architecture

```
cognitience-ss/
├── src/
│   ├── main/           # Electron main process
│   ├── preload/        # contextBridge API
│   ├── renderer/       # UI (HTML/CSS + ES modules)
│   │   ├── js/         # Spreadsheet engine & UI modules
│   │   └── css/
│   └── shared/         # Types & constants
├── resources/
├── scripts/
└── .github/workflows/
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Install & Run

```bash
git clone https://github.com/Maq-Swarm/cognitience-ss.git
cd cognitience-ss
npm install
npm run build
npm start
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript and copy renderer assets |
| `npm start` / `npm run dev` | Build and launch Electron |
| `npm run watch` | TypeScript watch mode |
| `npm run package` / `npm run dist` | Package with electron-builder |
| `npm run package:win` | Windows NSIS + portable |

## License

MIT © Maq-Swarm
