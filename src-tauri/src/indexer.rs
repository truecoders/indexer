use crate::db::{self, Database, IndexProgress};
use crate::parsers;
use rusqlite::params;
use std::path::Path;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

pub fn index_folder(app: &AppHandle, db: &Database, folder_id: i64, folder_path: &str) -> Result<(), String> {
    let supported = parsers::supported_extensions();
    let folder = Path::new(folder_path);

    if !folder.exists() || !folder.is_dir() {
        return Err(format!("Folder does not exist: {}", folder_path));
    }

    // Load exclude patterns for this folder
    let exclude_patterns = db::get_exclude_patterns(db, folder_id).unwrap_or_default();

    // Collect all supported files (respecting exclude patterns)
    let files: Vec<_> = WalkDir::new(folder)
        .follow_links(true)
        .into_iter()
        .filter_entry(|e| !should_exclude(e.path(), &exclude_patterns))
        .filter_map(|e| e.ok())
        .filter(|e| {
            if !e.file_type().is_file() { return false; }
            if let Some(ext) = e.path().extension() {
                supported.contains(&ext.to_str().unwrap_or("").to_lowercase().as_str())
            } else {
                false
            }
        })
        .collect();

    let total = files.len();
    let mut processed = 0;
    let mut batch_count = 0;

    // Get existing documents for incremental indexing
    let existing: std::collections::HashMap<String, String> = {
        let conn = db.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT path, modified_at FROM indexed_documents WHERE folder_id = ?1"
        ).map_err(|e| e.to_string())?;
        let rows: Vec<(String, String)> = stmt.query_map(params![folder_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        }).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
        rows.into_iter().collect()
    };

    // Track which paths still exist
    let mut seen_paths: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Begin transaction
    {
        let conn = db.conn.lock().unwrap();
        conn.execute_batch("BEGIN TRANSACTION").map_err(|e| e.to_string())?;
    }

    for entry in &files {
        let path = entry.path();
        let path_str = path.to_string_lossy().to_string();
        seen_paths.insert(path_str.clone());

        let filename = path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        let extension = path.extension()
            .map(|e| e.to_string_lossy().to_string().to_lowercase())
            .unwrap_or_default();

        let metadata = std::fs::metadata(path).ok();
        let modified_at = metadata.as_ref()
            .and_then(|m| m.modified().ok())
            .map(|t| format_system_time(t))
            .unwrap_or_default();
        let size_bytes = metadata.as_ref().map(|m| m.len() as i64).unwrap_or(0);

        // Skip if file hasn't changed
        if let Some(existing_modified) = existing.get(&path_str) {
            if *existing_modified == modified_at {
                processed += 1;
                continue;
            }
        }

        // Parse file content
        let (content, word_count, status, error_msg) = match parsers::get_parser(&extension) {
            Some(parser) => {
                match parser.extract_text(path) {
                    Ok(text) => {
                        let wc = text.split_whitespace().count() as i64;
                        (text, wc, "ok".to_string(), None)
                    }
                    Err(e) => {
                        (String::new(), 0i64, "error".to_string(), Some(e))
                    }
                }
            }
            None => continue,
        };

        // Upsert document and FTS
        {
            let conn = db.conn.lock().unwrap();

            // Check if document exists
            let existing_id: Option<i64> = conn.query_row(
                "SELECT id FROM indexed_documents WHERE path = ?1",
                params![path_str],
                |row| row.get(0),
            ).ok();

            if let Some(doc_id) = existing_id {
                // Update existing
                conn.execute(
                    "UPDATE indexed_documents SET filename=?1, file_type=?2, size_bytes=?3, modified_at=?4, word_count=?5, status=?6, error_msg=?7, indexed_at=datetime('now','localtime') WHERE id=?8",
                    params![filename, extension, size_bytes, modified_at, word_count, status, error_msg, doc_id],
                ).ok();
                conn.execute("DELETE FROM documents_fts WHERE document_id = ?1", params![doc_id]).ok();
                if status == "ok" {
                    conn.execute(
                        "INSERT INTO documents_fts (document_id, filename, content) VALUES (?1, ?2, ?3)",
                        params![doc_id, filename, content],
                    ).ok();
                }
            } else {
                // Insert new
                conn.execute(
                    "INSERT INTO indexed_documents (folder_id, path, filename, file_type, size_bytes, modified_at, word_count, status, error_msg) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![folder_id, path_str, filename, extension, size_bytes, modified_at, word_count, status, error_msg],
                ).ok();
                let doc_id = conn.last_insert_rowid();
                if status == "ok" {
                    conn.execute(
                        "INSERT INTO documents_fts (document_id, filename, content) VALUES (?1, ?2, ?3)",
                        params![doc_id, filename, content],
                    ).ok();
                }
            }
        }

        processed += 1;
        batch_count += 1;

        // Commit every 200 files
        if batch_count >= 200 {
            let conn = db.conn.lock().unwrap();
            conn.execute_batch("COMMIT; BEGIN TRANSACTION").map_err(|e| e.to_string())?;
            batch_count = 0;
        }

        // Emit progress every 5 files
        if processed % 5 == 0 || processed == total {
            let _ = app.emit("indexer:progress", IndexProgress {
                folder_id,
                folder_path: folder_path.to_string(),
                current: processed,
                total,
                current_file: filename.clone(),
                done: false,
            });
        }
    }

    // Remove deleted files from index
    {
        let conn = db.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, path FROM indexed_documents WHERE folder_id = ?1"
        ).map_err(|e| e.to_string())?;
        let dead_docs: Vec<(i64, String)> = stmt.query_map(params![folder_id], |row| {
            Ok((row.get(0)?, row.get(1)?))
        }).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .filter(|(_, p)| !seen_paths.contains(p))
        .collect();

        for (doc_id, _) in &dead_docs {
            conn.execute("DELETE FROM documents_fts WHERE document_id = ?1", params![doc_id]).ok();
            conn.execute("DELETE FROM indexed_documents WHERE id = ?1", params![doc_id]).ok();
        }
    }

    // Final commit
    {
        let conn = db.conn.lock().unwrap();
        conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
    }

    // Update folder stats
    db::update_folder_stats(db, folder_id).map_err(|e| e.to_string())?;

    // Emit done
    let _ = app.emit("indexer:progress", IndexProgress {
        folder_id,
        folder_path: folder_path.to_string(),
        current: total,
        total,
        current_file: String::new(),
        done: true,
    });

    Ok(())
}

fn format_system_time(time: std::time::SystemTime) -> String {
    let duration = time.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    let secs = duration.as_secs();
    // Simple ISO-like formatting without chrono
    let days = secs / 86400;
    let remaining = secs % 86400;
    let hours = remaining / 3600;
    let minutes = (remaining % 3600) / 60;
    let seconds = remaining % 60;

    // Approximate date calculation
    let mut year = 1970i64;
    let mut remaining_days = days as i64;

    loop {
        let days_in_year = if is_leap_year(year) { 366 } else { 365 };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        year += 1;
    }

    let months_days = if is_leap_year(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut month = 1;
    for &md in &months_days {
        if remaining_days < md {
            break;
        }
        remaining_days -= md;
        month += 1;
    }
    let day = remaining_days + 1;

    format!("{:04}-{:02}-{:02} {:02}:{:02}:{:02}", year, month, day, hours, minutes, seconds)
}

fn is_leap_year(year: i64) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

/// Check if a path should be excluded based on patterns
fn should_exclude(path: &Path, patterns: &[String]) -> bool {
    if patterns.is_empty() {
        return false;
    }

    let file_name = path.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let file_name_lower = file_name.to_lowercase();

    for pattern in patterns {
        let pat = pattern.trim().to_lowercase();
        if pat.is_empty() { continue; }

        // *.ext → match file extension
        if pat.starts_with("*.") {
            let ext = &pat[2..];
            if let Some(file_ext) = path.extension() {
                if file_ext.to_string_lossy().to_lowercase() == ext {
                    return true;
                }
            }
            continue;
        }

        // pattern* → prefix match on filename (e.g. ~$*)
        if pat.ends_with('*') {
            let prefix = &pat[..pat.len()-1];
            if file_name_lower.starts_with(prefix) {
                return true;
            }
            continue;
        }

        // Exact match on any path component (directory or file name)
        for component in path.components() {
            if let std::path::Component::Normal(c) = component {
                if c.to_string_lossy().to_lowercase() == pat {
                    return true;
                }
            }
        }
    }
    false
}
