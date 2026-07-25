# Cognition SS

Local-first spreadsheet with an Apple-inspired liquid-glass UI and a **Rust** backend.

Nothing is uploaded to the cloud. Workbooks are JSON files on disk. Open **xlsx**, **csv**, and **parquet** from your Documents folder.

## Requirements

- Rust 1.75+ (`cargo`)
- Node.js 18+ (for Electron packaging)
- A modern browser (Chrome, Edge, Firefox, Safari)

## Desktop app (Electron)

```bash
cargo build --release
npm install
npm run dist
```

Output: `dist/CognitienceSS_v2.0.0.exe` (portable)

## Run (dev server)

```bash
cargo run
```

Then open **http://127.0.0.1:8788**

```bash
npm run electron:dev   # Electron shell + release backend
```

Optional environment variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8788` | HTTP port (localhost only) |
| `COGNITION_DATA_DIR` | `./documents` | Where `.json` workbooks are stored |
| `COGNITION_STATIC_DIR` | `./static` | Frontend assets |
| `COGNITION_DOCS_DIR` | user Documents | Folder scanned for xlsx/csv/parquet |

## Features

- Clean sheet UI (no cloud icon, Share/Upgrade, Google side panel, or menubar clutter)
- **Left sidebar**: New Document, Open Document, and live list of xlsx / csv / parquet
- Correct open/display for **Excel (.xlsx)**, **CSV/TSV**, and **Parquet**
- Formula bar with basic `=SUM()`, arithmetic, and cell references
- Export to `.xlsx`, `.csv`, `.tsv`, `.json`
- Liquid-glass chrome; solid grid for legibility
- Dark mode toggle

## Project layout

```
cognition-ss/
├── build/           # App icons
├── dist/            # Packaged Electron builds
├── documents/       # Local workbook JSON store
├── electron/        # Electron shell
├── scripts/         # Icon helper
├── src/             # Rust backend (Axum)
│   ├── documents.rs
│   ├── export.rs
│   ├── files.rs
│   └── main.rs
├── static/          # Frontend
│   ├── assets/logo.png
│   ├── vendor/
│   ├── index.html
│   ├── liquid-glass.js
│   ├── script.js
│   └── style.css
├── Cargo.toml
└── package.json
```

## API (local only)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health + local-mode flag |
| `GET` | `/api/documents` | List workbooks |
| `POST` | `/api/documents` | Create |
| `GET` | `/api/documents/{id}` | Load |
| `PUT` | `/api/documents/{id}` | Save |
| `DELETE` | `/api/documents/{id}` | Delete |
| `GET` | `/api/files` | List xlsx/csv/parquet in Documents |
| `POST` | `/api/files/open` | Open relative path from Documents |
| `POST` | `/api/files/import` | Upload/import a file |
| `POST` | `/api/export` | Export workbook |

## Shortcuts

| Key | Action |
| --- | --- |
| Ctrl+S | Save |
| Ctrl+Z / Ctrl+Y | Undo / Redo |
| Arrow keys | Move selection |
| Enter / F2 | Edit cell |
| Delete | Clear cell |
