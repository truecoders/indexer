use super::FileParser;
use std::path::Path;
use calamine::{Reader, open_workbook_auto};

pub struct XlsxParser;

impl FileParser for XlsxParser {
    fn extensions(&self) -> &[&str] {
        &["xlsx", "xls"]
    }

    fn extract_text(&self, path: &Path) -> Result<String, String> {
        let mut workbook = open_workbook_auto(path).map_err(|e| format!("Cannot open spreadsheet: {}", e))?;
        let mut text = String::new();

        for sheet_name in workbook.sheet_names().to_vec() {
            if let Ok(range) = workbook.worksheet_range(&sheet_name) {
                for row in range.rows() {
                    let row_text: Vec<String> = row.iter().map(|cell| {
                        match cell {
                            calamine::Data::Empty => String::new(),
                            calamine::Data::String(s) => s.clone(),
                            calamine::Data::Float(f) => f.to_string(),
                            calamine::Data::Int(i) => i.to_string(),
                            calamine::Data::Bool(b) => b.to_string(),
                            calamine::Data::DateTime(dt) => dt.to_string(),
                            calamine::Data::Error(e) => format!("{:?}", e),
                            _ => String::new(),
                        }
                    }).collect();

                    let line = row_text.join(" ");
                    if !line.trim().is_empty() {
                        text.push_str(line.trim());
                        text.push('\n');
                    }
                }
            }
        }

        Ok(text)
    }
}
