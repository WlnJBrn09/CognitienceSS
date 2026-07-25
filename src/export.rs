//! Export spreadsheet to csv / tsv / xlsx (minimal OOXML) / json.

use std::io::{Cursor, Write};

use serde::Deserialize;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use crate::documents::Sheet;

#[derive(Debug, Deserialize)]
pub struct ExportBody {
    pub format: String,
    pub title: Option<String>,
    pub sheets: Vec<Sheet>,
    pub active_sheet: Option<usize>,
}

#[derive(Debug)]
pub struct ExportFile {
    pub filename: String,
    pub content_type: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug)]
pub enum ExportError {
    Unsupported,
    Other(String),
}

impl std::fmt::Display for ExportError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Unsupported => write!(f, "unsupported export format"),
            Self::Other(s) => write!(f, "{s}"),
        }
    }
}

pub fn export_document(body: &ExportBody) -> Result<ExportFile, ExportError> {
    let title = sanitize_filename(body.title.as_deref().unwrap_or("spreadsheet"));
    let idx = body
        .active_sheet
        .unwrap_or(0)
        .min(body.sheets.len().saturating_sub(1));
    let sheet = body
        .sheets
        .get(idx)
        .ok_or_else(|| ExportError::Other("no sheets".into()))?;

    match body.format.to_lowercase().as_str() {
        "csv" => Ok(ExportFile {
            filename: format!("{title}.csv"),
            content_type: "text/csv; charset=utf-8".into(),
            bytes: grid_to_csv(&sheet.data, b',').into_bytes(),
        }),
        "tsv" => Ok(ExportFile {
            filename: format!("{title}.tsv"),
            content_type: "text/tab-separated-values; charset=utf-8".into(),
            bytes: grid_to_csv(&sheet.data, b'\t').into_bytes(),
        }),
        "json" => {
            let json = serde_json::to_vec_pretty(&serde_json::json!({
                "title": body.title,
                "sheets": body.sheets,
                "active_sheet": idx,
            }))
            .map_err(|e| ExportError::Other(e.to_string()))?;
            Ok(ExportFile {
                filename: format!("{title}.json"),
                content_type: "application/json".into(),
                bytes: json,
            })
        }
        "xlsx" => {
            let bytes = build_xlsx(&body.sheets).map_err(ExportError::Other)?;
            Ok(ExportFile {
                filename: format!("{title}.xlsx"),
                content_type:
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".into(),
                bytes,
            })
        }
        _ => Err(ExportError::Unsupported),
    }
}

fn sanitize_filename(s: &str) -> String {
    let t: String = s
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == ' ' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let t = t.trim().trim_matches('.');
    if t.is_empty() {
        "spreadsheet".into()
    } else {
        t.chars().take(80).collect()
    }
}

fn grid_to_csv(data: &[Vec<String>], delim: u8) -> String {
    let d = delim as char;
    let mut out = String::new();
    for row in data {
        // Skip trailing empty-only rows for cleaner export? Keep all for fidelity.
        let mut first = true;
        for cell in row {
            if !first {
                out.push(d);
            }
            first = false;
            out.push_str(&csv_escape(cell, delim));
        }
        out.push('\n');
    }
    out
}

fn csv_escape(s: &str, delim: u8) -> String {
    let d = delim as char;
    let needs = s.contains(d) || s.contains('"') || s.contains('\n') || s.contains('\r');
    if !needs {
        return s.to_string();
    }
    format!("\"{}\"", s.replace('"', "\"\""))
}

fn build_xlsx(sheets: &[Sheet]) -> Result<Vec<u8>, String> {
    let mut buf = Cursor::new(Vec::new());
    {
        let mut zip = ZipWriter::new(&mut buf);
        let opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);

        // [Content_Types].xml
        let mut ctypes = String::from(
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
"#,
        );
        for i in 0..sheets.len() {
            ctypes.push_str(&format!(
                r#"  <Override PartName="/xl/worksheets/sheet{}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
"#,
                i + 1
            ));
        }
        ctypes.push_str("</Types>");
        zip.start_file("[Content_Types].xml", opts)
            .map_err(|e| e.to_string())?;
        zip.write_all(ctypes.as_bytes()).map_err(|e| e.to_string())?;

        // _rels/.rels
        zip.start_file("_rels/.rels", opts)
            .map_err(|e| e.to_string())?;
        zip.write_all(
            br#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"#,
        )
        .map_err(|e| e.to_string())?;

        // xl/workbook.xml
        let mut wb = String::from(
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
"#,
        );
        for (i, s) in sheets.iter().enumerate() {
            wb.push_str(&format!(
                r#"    <sheet name="{}" sheetId="{}" r:id="rId{}"/>
"#,
                xml_escape(&s.name),
                i + 1,
                i + 1
            ));
        }
        wb.push_str("  </sheets>\n</workbook>");
        zip.start_file("xl/workbook.xml", opts)
            .map_err(|e| e.to_string())?;
        zip.write_all(wb.as_bytes()).map_err(|e| e.to_string())?;

        // xl/_rels/workbook.xml.rels
        let mut rels = String::from(
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
"#,
        );
        for i in 0..sheets.len() {
            rels.push_str(&format!(
                r#"  <Relationship Id="rId{}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{}.xml"/>
"#,
                i + 1,
                i + 1
            ));
        }
        rels.push_str("</Relationships>");
        zip.start_file("xl/_rels/workbook.xml.rels", opts)
            .map_err(|e| e.to_string())?;
        zip.write_all(rels.as_bytes()).map_err(|e| e.to_string())?;

        // worksheets
        for (i, sheet) in sheets.iter().enumerate() {
            let xml = sheet_to_xml(sheet);
            zip.start_file(format!("xl/worksheets/sheet{}.xml", i + 1), opts)
                .map_err(|e| e.to_string())?;
            zip.write_all(xml.as_bytes()).map_err(|e| e.to_string())?;
        }

        zip.finish().map_err(|e| e.to_string())?;
    }
    Ok(buf.into_inner())
}

fn sheet_to_xml(sheet: &Sheet) -> String {
    let mut body = String::from(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
"#,
    );
    for (ri, row) in sheet.data.iter().enumerate() {
        let row_num = ri + 1;
        // Skip fully empty rows
        if row.iter().all(|c| c.is_empty()) {
            continue;
        }
        body.push_str(&format!("    <row r=\"{row_num}\">\n"));
        for (ci, cell) in row.iter().enumerate() {
            if cell.is_empty() {
                continue;
            }
            let ref_ = cell_ref(ci, ri);
            if let Ok(n) = cell.parse::<f64>() {
                if cell.chars().all(|c| c.is_ascii_digit() || c == '.' || c == '-' || c == '+')
                    || cell.contains('e')
                    || cell.contains('E')
                {
                    body.push_str(&format!(
                        "      <c r=\"{ref_}\"><v>{}</v></c>\n",
                        xml_escape(&n.to_string())
                    ));
                    continue;
                }
            }
            // inline string
            body.push_str(&format!(
                "      <c r=\"{ref_}\" t=\"inlineStr\"><is><t>{}</t></is></c>\n",
                xml_escape(cell)
            ));
        }
        body.push_str("    </row>\n");
    }
    body.push_str("  </sheetData>\n</worksheet>");
    body
}

fn cell_ref(col: usize, row: usize) -> String {
    format!("{}{}", col_letters(col), row + 1)
}

fn col_letters(mut col: usize) -> String {
    let mut s = String::new();
    loop {
        let rem = col % 26;
        s.insert(0, (b'A' + rem as u8) as char);
        if col < 26 {
            break;
        }
        col = col / 26 - 1;
    }
    s
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn col_a() {
        assert_eq!(col_letters(0), "A");
        assert_eq!(col_letters(25), "Z");
        assert_eq!(col_letters(26), "AA");
    }

    #[test]
    fn csv_basic() {
        let g = vec![vec!["a".into(), "b".into()], vec!["1".into(), "2".into()]];
        let s = grid_to_csv(&g, b',');
        assert!(s.contains("a,b"));
    }
}
