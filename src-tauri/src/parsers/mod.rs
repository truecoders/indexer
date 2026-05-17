pub mod docx;
pub mod text;
pub mod xlsx;

use std::path::Path;

pub trait FileParser: Send + Sync {
    fn extensions(&self) -> &[&str];
    fn extract_text(&self, path: &Path) -> Result<String, String>;
}

/// Get the appropriate parser for a file extension
pub fn get_parser(extension: &str) -> Option<Box<dyn FileParser>> {
    let ext = extension.to_lowercase();
    let parsers: Vec<Box<dyn FileParser>> = vec![
        Box::new(docx::DocxParser),
        Box::new(text::TextParser),
        Box::new(xlsx::XlsxParser),
    ];

    for parser in parsers {
        if parser.extensions().contains(&ext.as_str()) {
            return Some(parser);
        }
    }
    None
}

/// Get all supported extensions
pub fn supported_extensions() -> Vec<&'static str> {
    let mut exts = Vec::new();
    exts.extend_from_slice(docx::DocxParser.extensions());
    exts.extend_from_slice(text::TextParser.extensions());
    exts.extend_from_slice(xlsx::XlsxParser.extensions());
    exts
}
