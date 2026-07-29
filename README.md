# Cognition SS

Local-first spreadsheet with liquid-glass UI and a **Rust** backend.

## Desktop app (native)

No Electron. WebView2 / WebKit host + local Rust backend.

```bash
npm run native:build
npm run native
npm run dist
```

Port **8788**. Package: `dist/CognitienceSS_v*_win.zip`

## Dev server

```bash
cargo run
```

http://127.0.0.1:8788

## License

MIT