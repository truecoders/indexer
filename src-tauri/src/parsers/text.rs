use super::FileParser;
use std::path::Path;

pub struct TextParser;

impl FileParser for TextParser {
    fn extensions(&self) -> &[&str] {
        &["txt", "md", "csv", "log", "xml", "json", "ini", "cfg", "conf"]
    }

    fn extract_text(&self, path: &Path) -> Result<String, String> {
        // Try reading as UTF-8 first
        match std::fs::read_to_string(path) {
            Ok(content) => Ok(content),
            Err(_) => {
                // If UTF-8 fails, try detecting encoding
                let bytes = std::fs::read(path).map_err(|e| format!("Cannot read file: {}", e))?;

                // Try Windows-1251 (common for Russian text files)
                let (decoded, _, had_errors) = encoding_rs::WINDOWS_1251.decode(&bytes);
                if !had_errors {
                    return Ok(decoded.to_string());
                }

                // Try ISO-8859-1 as fallback
                let (decoded, _, _) = encoding_rs::WINDOWS_1252.decode(&bytes);
                Ok(decoded.to_string())
            }
        }
    }
}
