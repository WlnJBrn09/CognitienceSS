//! User Documents folder listing + open/import for xlsx, csv, parquet (and json workbooks).

use std::fs;
use std::io::Cursor;
use std::path::{Component, Path, PathBuf};

use arrow::array::{Array, BooleanArray, Float64Array, Int64Array, StringArray};
use arrow::datatypes::DataType;
use arrow::record_batch::RecordBatch;
use bytes::Bytes;
use calamine::{open_workbook_auto_from_rs, Data, Reader};
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
use serde::{Deserialize, Serialize};

use crate::documents::{sheet_from_grid, Sheet};

/// Extensions shown in the Documents sidebar.
const LIST_EXT: &[&str] = &["xlsx", "xlsm", "xls", "csv", "tsv", "parquet", "json"];
/// Also openable via Open/Import.
const OPEN_EXT: &[&str] = &["xlsx", "xlsm", "xls", "csv", "tsv", "parquet", "json", "cog"];

const MAX_IMPORT_ROWS: usize = 20_000;
const MAX_IMPORT_COLS: usize = 200;

#[derive(Debug, Clone, Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub ext: String,
    pub size: u64,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct OpenedFile {
    pub name: String,
    pub path: String,
    pub ext: String,
    pub title: String,
    pub format: String,
    pub sheets: Vec<Sheet>,
    pub active_sheet: usize,
}

#[derive(Debug, Deserialize)]
pub struct OpenPathBody {
    pub path: String,
}

#[derive(Debug)]
pub enum FileError {
    NotFound,
    InvalidPath,
    Unsupported,
    Io(std::io::Error),
    Other(String),
}

impl std::fmt::Display for FileError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotFound => write!(f, "file not found"),
            Self::InvalidPath => write!(f, "invalid path"),
            Self::Unsupported => write!(f, "unsupported file type"),
            Self::Io(e) => write!(f, "io: {e}"),
            Self::Other(s) => write!(f, "{s}"),
        }
    }
}

pub fn resolve_documents_dir() -> PathBuf {
    if let Ok(p) = std::env::var("COGNITION_DOCS_DIR") {
        return PathBuf::from(p);
    }
    dirs::document_dir().unwrap_or_else(|| {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        home.join("Documents")
    })
}

pub fn list_documents_folder(root: &Path) -> Result<Vec<FileEntry>, FileError> {
    if !root.exists() {
        fs::create_dir_all(root).map_err(FileError::Io)?;
    }
    let mut out = Vec::new();
    collect_files(root, root, 0, &mut out)?;
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

fn collect_files(
    root: &Path,
    dir: &Path,
    depth: u8,
    out: &mut Vec<FileEntry>,
) -> Result<(), FileError> {
    if depth > 3 {
        return Ok(());
    }
    let entries = fs::read_dir(dir).map_err(FileError::Io)?;
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            collect_files(root, &path, depth + 1, out)?;
            continue;
        }
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        if !LIST_EXT.contains(&ext.as_str()) {
            continue;
        }
        let meta = entry.metadata().map_err(FileError::Io)?;
        let rel = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        out.push(FileEntry {
            name,
            path: rel,
            ext: ext.clone(),
            size: meta.len(),
            kind: kind_for_ext(&ext).into(),
        });
    }
    Ok(())
}

fn kind_for_ext(ext: &str) -> &'static str {
    match ext {
        "xlsx" | "xlsm" | "xls" => "excel",
        "csv" | "tsv" => "csv",
        "parquet" => "parquet",
        "json" | "cog" => "cognition",
        _ => "file",
    }
}

/// Resolve a relative path under Documents; reject path traversal.
pub fn safe_join(root: &Path, rel: &str) -> Result<PathBuf, FileError> {
    let rel = rel.trim().trim_start_matches(['/', '\\']);
    if rel.is_empty() {
        return Err(FileError::InvalidPath);
    }
    let candidate = root.join(rel);
    let canon_root = fs::canonicalize(root).map_err(FileError::Io)?;
    let full = if candidate.exists() {
        fs::canonicalize(&candidate).map_err(FileError::Io)?
    } else {
        let mut norm = PathBuf::new();
        for c in Path::new(rel).components() {
            match c {
                Component::Normal(s) => norm.push(s),
                Component::CurDir => {}
                _ => return Err(FileError::InvalidPath),
            }
        }
        if norm.as_os_str().is_empty() {
            return Err(FileError::InvalidPath);
        }
        return Ok(root.join(norm));
    };
    if !full.starts_with(&canon_root) {
        return Err(FileError::InvalidPath);
    }
    Ok(full)
}

pub fn open_file(root: &Path, rel: &str) -> Result<OpenedFile, FileError> {
    let path = safe_join(root, rel)?;
    if !path.is_file() {
        return Err(FileError::NotFound);
    }
    let name = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "spreadsheet".into());
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let title = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "Untitled spreadsheet".into());

    let bytes = fs::read(&path).map_err(FileError::Io)?;
    open_bytes(&name, rel, &ext, &title, &bytes)
}

pub fn open_bytes(
    name: &str,
    rel: &str,
    ext: &str,
    title: &str,
    bytes: &[u8],
) -> Result<OpenedFile, FileError> {
    if !OPEN_EXT.contains(&ext) {
        return Err(FileError::Unsupported);
    }
    let sheets = match ext {
        "csv" => vec![sheet_from_grid("Sheet1", parse_csv(bytes, b',')?)],
        "tsv" => vec![sheet_from_grid("Sheet1", parse_csv(bytes, b'\t')?)],
        "xlsx" | "xlsm" | "xls" => parse_excel(bytes)?,
        "parquet" => vec![sheet_from_grid("Sheet1", parse_parquet(bytes)?)],
        "json" | "cog" => parse_cognition_json(bytes)?,
        _ => return Err(FileError::Unsupported),
    };

    Ok(OpenedFile {
        name: name.into(),
        path: rel.into(),
        ext: ext.into(),
        title: title.into(),
        format: kind_for_ext(ext).into(),
        sheets,
        active_sheet: 0,
    })
}

fn parse_csv(bytes: &[u8], delim: u8) -> Result<Vec<Vec<String>>, FileError> {
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(false)
        .delimiter(delim)
        .flexible(true)
        .from_reader(Cursor::new(bytes));
    let mut grid = Vec::new();
    for (i, result) in rdr.records().enumerate() {
        if i >= MAX_IMPORT_ROWS {
            break;
        }
        let record = result.map_err(|e| FileError::Other(format!("csv: {e}")))?;
        let mut row: Vec<String> = record.iter().map(|s| s.to_string()).collect();
        if row.len() > MAX_IMPORT_COLS {
            row.truncate(MAX_IMPORT_COLS);
        }
        grid.push(row);
    }
    if grid.is_empty() {
        grid.push(vec![String::new()]);
    }
    Ok(grid)
}

fn parse_excel(bytes: &[u8]) -> Result<Vec<Sheet>, FileError> {
    let cursor = Cursor::new(bytes.to_vec());
    let mut workbook = open_workbook_auto_from_rs(cursor)
        .map_err(|e| FileError::Other(format!("excel open: {e}")))?;
    let names = workbook.sheet_names().to_vec();
    if names.is_empty() {
        return Ok(vec![sheet_from_grid("Sheet1", vec![vec![String::new()]])]);
    }
    let mut sheets = Vec::new();
    for name in names {
        let range = match workbook.worksheet_range(&name) {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!(sheet = %name, error = %e, "skip sheet");
                continue;
            }
        };
        let mut grid: Vec<Vec<String>> = Vec::new();
        for (ri, row) in range.rows().enumerate() {
            if ri >= MAX_IMPORT_ROWS {
                break;
            }
            let mut out_row = Vec::new();
            for (ci, cell) in row.iter().enumerate() {
                if ci >= MAX_IMPORT_COLS {
                    break;
                }
                out_row.push(cell_to_string(cell));
            }
            grid.push(out_row);
        }
        if grid.is_empty() {
            grid.push(vec![String::new()]);
        }
        sheets.push(sheet_from_grid(&name, grid));
    }
    if sheets.is_empty() {
        sheets.push(sheet_from_grid("Sheet1", vec![vec![String::new()]]));
    }
    Ok(sheets)
}

fn cell_to_string(cell: &Data) -> String {
    match cell {
        Data::Empty => String::new(),
        Data::String(s) => s.clone(),
        Data::Float(f) => format_number(*f),
        Data::Int(i) => i.to_string(),
        Data::Bool(b) => {
            if *b {
                "TRUE".into()
            } else {
                "FALSE".into()
            }
        }
        Data::DateTime(dt) => format!("{dt:?}"),
        Data::DateTimeIso(s) | Data::DurationIso(s) => s.clone(),
        Data::Error(e) => format!("#{e:?}"),
    }
}

fn format_number(f: f64) -> String {
    if f.fract() == 0.0 && f.abs() < 1e15 {
        format!("{f:.0}")
    } else {
        // Trim trailing zeros
        let s = format!("{f}");
        s
    }
}

fn parse_parquet(bytes: &[u8]) -> Result<Vec<Vec<String>>, FileError> {
    let data = Bytes::copy_from_slice(bytes);
    let builder = ParquetRecordBatchReaderBuilder::try_new(data)
        .map_err(|e| FileError::Other(format!("parquet: {e}")))?;
    let schema = builder.schema().clone();
    let reader = builder
        .build()
        .map_err(|e| FileError::Other(format!("parquet reader: {e}")))?;

    // Header row from column names
    let headers: Vec<String> = schema.fields().iter().map(|f| f.name().clone()).collect();
    let mut grid = vec![headers];

    let mut rows = 0usize;
    for batch in reader {
        let batch = batch.map_err(|e| FileError::Other(format!("parquet batch: {e}")))?;
        let rows_in = batch.num_rows().min(MAX_IMPORT_ROWS.saturating_sub(rows));
        if rows_in == 0 {
            break;
        }
        append_batch_rows(&batch, rows_in, &mut grid)?;
        rows += rows_in;
        if rows >= MAX_IMPORT_ROWS {
            break;
        }
    }
    if grid.len() == 1 {
        // only headers
        grid.push(vec![String::new(); grid[0].len().max(1)]);
    }
    Ok(grid)
}

fn append_batch_rows(
    batch: &RecordBatch,
    rows: usize,
    grid: &mut Vec<Vec<String>>,
) -> Result<(), FileError> {
    let ncols = batch.num_columns().min(MAX_IMPORT_COLS);
    for r in 0..rows {
        let mut row = Vec::with_capacity(ncols);
        for c in 0..ncols {
            let col = batch.column(c);
            row.push(array_value_to_string(col.as_ref(), r));
        }
        grid.push(row);
    }
    Ok(())
}

fn array_value_to_string(arr: &dyn Array, row: usize) -> String {
    if arr.is_null(row) {
        return String::new();
    }
    match arr.data_type() {
        DataType::Utf8 => {
            let a = arr.as_any().downcast_ref::<StringArray>().unwrap();
            a.value(row).to_string()
        }
        DataType::LargeUtf8 => {
            // fall through via display
            format_array_fallback(arr, row)
        }
        DataType::Int64 => {
            let a = arr.as_any().downcast_ref::<Int64Array>().unwrap();
            a.value(row).to_string()
        }
        DataType::Float64 => {
            let a = arr.as_any().downcast_ref::<Float64Array>().unwrap();
            format_number(a.value(row))
        }
        DataType::Boolean => {
            let a = arr.as_any().downcast_ref::<BooleanArray>().unwrap();
            if a.value(row) {
                "TRUE".into()
            } else {
                "FALSE".into()
            }
        }
        _ => format_array_fallback(arr, row),
    }
}

fn format_array_fallback(arr: &dyn Array, row: usize) -> String {
    // Use Debug-ish via typed try for common int/float widths
    if let Some(a) = arr.as_any().downcast_ref::<arrow::array::Int32Array>() {
        return a.value(row).to_string();
    }
    if let Some(a) = arr.as_any().downcast_ref::<arrow::array::Float32Array>() {
        return format_number(a.value(row) as f64);
    }
    if let Some(a) = arr.as_any().downcast_ref::<arrow::array::UInt64Array>() {
        return a.value(row).to_string();
    }
    if let Some(a) = arr.as_any().downcast_ref::<arrow::array::UInt32Array>() {
        return a.value(row).to_string();
    }
    String::new()
}

fn parse_cognition_json(bytes: &[u8]) -> Result<Vec<Sheet>, FileError> {
    #[derive(Deserialize)]
    struct Doc {
        title: Option<String>,
        sheets: Option<Vec<Sheet>>,
        /// Alternate: single grid
        data: Option<Vec<Vec<String>>>,
    }
    let doc: Doc = serde_json::from_slice(bytes)
        .map_err(|e| FileError::Other(format!("invalid json workbook: {e}")))?;
    if let Some(sheets) = doc.sheets {
        if !sheets.is_empty() {
            return Ok(sheets);
        }
    }
    if let Some(data) = doc.data {
        let name = doc.title.unwrap_or_else(|| "Sheet1".into());
        return Ok(vec![sheet_from_grid(&name, data)]);
    }
    Ok(vec![sheet_from_grid("Sheet1", vec![vec![String::new()]])])
}

#[allow(dead_code)]
fn is_openable_ext(ext: &str) -> bool {
    OPEN_EXT.contains(&ext)
}

pub fn mime_for_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "csv" => "text/csv; charset=utf-8",
        "tsv" => "text/tab-separated-values; charset=utf-8",
        "xlsx" | "xlsm" => {
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
        "xls" => "application/vnd.ms-excel",
        "parquet" => "application/vnd.apache.parquet",
        "json" | "cog" => "application/json",
        _ => "application/octet-stream",
    }
}

pub fn read_raw_file(root: &Path, rel: &str) -> Result<(Vec<u8>, &'static str), FileError> {
    let path = safe_join(root, rel)?;
    if !path.is_file() {
        return Err(FileError::NotFound);
    }
    let data = fs::read(&path).map_err(FileError::Io)?;
    Ok((data, mime_for_path(&path)))
}
