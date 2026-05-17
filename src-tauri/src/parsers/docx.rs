use super::FileParser;
use std::io::Read;
use std::path::Path;

pub struct DocxParser;

impl FileParser for DocxParser {
    fn extensions(&self) -> &[&str] {
        &["docx"]
    }

    fn extract_text(&self, path: &Path) -> Result<String, String> {
        let file = std::fs::File::open(path).map_err(|e| format!("Cannot open file: {}", e))?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Invalid docx (zip): {}", e))?;

        let mut text = String::new();

        // docx stores content in word/document.xml
        if let Ok(mut doc_xml) = archive.by_name("word/document.xml") {
            let mut xml_content = String::new();
            doc_xml.read_to_string(&mut xml_content).map_err(|e| format!("Read error: {}", e))?;
            text.push_str(&extract_text_from_xml(&xml_content));
        }

        Ok(text)
    }
}

/// Simple XML text extractor — pulls text between <w:t> tags
fn extract_text_from_xml(xml: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;
    let mut in_wt = false;
    let mut tag_name = String::new();
    let mut depth = 0;

    let chars: Vec<char> = xml.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        let ch = chars[i];

        if ch == '<' {
            in_tag = true;
            tag_name.clear();
            i += 1;
            continue;
        }

        if in_tag {
            if ch == '>' {
                in_tag = false;
                let trimmed = tag_name.trim().to_string();

                // Check for <w:t> or <w:t ...>
                if trimmed.starts_with("w:t") && !trimmed.starts_with("w:t/") && !trimmed.starts_with("w:tab") && !trimmed.starts_with("w:tbl") && !trimmed.starts_with("w:tc") && !trimmed.starts_with("w:tr") {
                    in_wt = true;
                    depth += 1;
                } else if trimmed == "/w:t" {
                    in_wt = false;
                    if depth > 0 { depth -= 1; }
                }

                // Add space/newline for paragraph breaks
                if trimmed == "/w:p" || trimmed.starts_with("/w:p ") {
                    result.push('\n');
                }

                i += 1;
                continue;
            }
            tag_name.push(ch);
            i += 1;
            continue;
        }

        if in_wt {
            result.push(ch);
        }

        i += 1;
    }

    result
}
