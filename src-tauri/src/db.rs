use rusqlite::{Connection, Result, params};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let conn = Connection::open(&db_path)?;

        // WAL mode for better concurrent performance
        conn.execute_batch("PRAGMA journal_mode=WAL;")?;
        conn.execute_batch("PRAGMA foreign_keys=ON;")?;

        // Create tables
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS indexed_folders (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                path          TEXT NOT NULL UNIQUE,
                created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                last_indexed  TEXT,
                file_count    INTEGER NOT NULL DEFAULT 0,
                total_words   INTEGER NOT NULL DEFAULT 0,
                error_count   INTEGER NOT NULL DEFAULT 0,
                watch_enabled INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS indexed_documents (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                folder_id   INTEGER NOT NULL REFERENCES indexed_folders(id) ON DELETE CASCADE,
                path        TEXT NOT NULL UNIQUE,
                filename    TEXT NOT NULL,
                file_type   TEXT NOT NULL,
                size_bytes  INTEGER NOT NULL DEFAULT 0,
                modified_at TEXT NOT NULL,
                word_count  INTEGER NOT NULL DEFAULT 0,
                status      TEXT NOT NULL DEFAULT 'ok',
                error_msg   TEXT,
                indexed_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
                document_id UNINDEXED,
                filename,
                content,
                tokenize = 'unicode61'
            );"
        )?;

        // Migration: add exclude_patterns column if missing
        let _ = conn.execute(
            "ALTER TABLE indexed_folders ADD COLUMN exclude_patterns TEXT NOT NULL DEFAULT '[]'",
            [],
        );

        Ok(Database {
            conn: Mutex::new(conn),
        })
    }
}

// === Data types ===

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct IndexerFolder {
    pub id: i64,
    pub path: String,
    pub created_at: String,
    pub last_indexed: Option<String>,
    pub file_count: i64,
    pub total_words: i64,
    pub error_count: i64,
    pub watch_enabled: bool,
    pub exclude_patterns: Vec<String>,
}

fn parse_exclude_patterns(json: &str) -> Vec<String> {
    serde_json::from_str(json).unwrap_or_default()
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct SearchResult {
    pub id: i64,
    pub folder_id: i64,
    pub path: String,
    pub filename: String,
    pub file_type: String,
    pub size_bytes: i64,
    pub modified_at: String,
    pub word_count: i64,
    pub filename_snippet: String,
    pub content_snippet: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct IndexerStats {
    pub folder_count: i64,
    pub file_count: i64,
    pub total_words: i64,
    pub error_count: i64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct IndexProgress {
    pub folder_id: i64,
    pub folder_path: String,
    pub current: usize,
    pub total: usize,
    pub current_file: String,
    pub done: bool,
}

// === DB Operations ===

pub fn add_folder(db: &Database, path: &str) -> Result<IndexerFolder> {
    let conn = db.conn.lock().unwrap();
    conn.execute(
        "INSERT OR IGNORE INTO indexed_folders (path) VALUES (?1)",
        params![path],
    )?;
    let mut stmt = conn.prepare(
        "SELECT id, path, created_at, last_indexed, file_count, total_words, error_count, watch_enabled, exclude_patterns
         FROM indexed_folders WHERE path = ?1"
    )?;
    let folder = stmt.query_row(params![path], |row| {
        let ep: String = row.get(8)?;
        Ok(IndexerFolder {
            id: row.get(0)?,
            path: row.get(1)?,
            created_at: row.get(2)?,
            last_indexed: row.get(3)?,
            file_count: row.get(4)?,
            total_words: row.get(5)?,
            error_count: row.get(6)?,
            watch_enabled: row.get::<_, i64>(7)? != 0,
            exclude_patterns: parse_exclude_patterns(&ep),
        })
    })?;
    Ok(folder)
}

pub fn remove_folder(db: &Database, id: i64) -> Result<()> {
    let conn = db.conn.lock().unwrap();
    // Delete FTS entries for documents in this folder
    conn.execute(
        "DELETE FROM documents_fts WHERE document_id IN (SELECT id FROM indexed_documents WHERE folder_id = ?1)",
        params![id],
    )?;
    // Cascade will delete documents
    conn.execute("DELETE FROM indexed_folders WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn list_folders(db: &Database) -> Result<Vec<IndexerFolder>> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, path, created_at, last_indexed, file_count, total_words, error_count, watch_enabled, exclude_patterns
         FROM indexed_folders ORDER BY created_at DESC"
    )?;
    let folders = stmt.query_map([], |row| {
        let ep: String = row.get(8)?;
        Ok(IndexerFolder {
            id: row.get(0)?,
            path: row.get(1)?,
            created_at: row.get(2)?,
            last_indexed: row.get(3)?,
            file_count: row.get(4)?,
            total_words: row.get(5)?,
            error_count: row.get(6)?,
            watch_enabled: row.get::<_, i64>(7)? != 0,
            exclude_patterns: parse_exclude_patterns(&ep),
        })
    })?.filter_map(|r| r.ok()).collect();
    Ok(folders)
}

pub fn get_stats(db: &Database) -> Result<IndexerStats> {
    let conn = db.conn.lock().unwrap();
    let folder_count: i64 = conn.query_row("SELECT COUNT(*) FROM indexed_folders", [], |r| r.get(0))?;
    let file_count: i64 = conn.query_row("SELECT COALESCE(SUM(file_count), 0) FROM indexed_folders", [], |r| r.get(0))?;
    let total_words: i64 = conn.query_row("SELECT COALESCE(SUM(total_words), 0) FROM indexed_folders", [], |r| r.get(0))?;
    let error_count: i64 = conn.query_row("SELECT COALESCE(SUM(error_count), 0) FROM indexed_folders", [], |r| r.get(0))?;
    Ok(IndexerStats { folder_count, file_count, total_words, error_count })
}

pub fn search(
    db: &Database,
    query: &str,
    mode: &str,
    match_type: &str,
    folder_id: Option<i64>,
    file_types: Option<Vec<String>>,
    sort_by: &str,
    sort_dir: &str,
) -> Result<Vec<SearchResult>> {
    let conn = db.conn.lock().unwrap();

    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    // Build FTS query based on match_type
    let fts_query = if match_type == "exact" {
        format!("\"{}\"", query.replace('"', ""))
    } else {
        // Partial: add prefix search to each word
        query
            .split_whitespace()
            .map(|w| format!("{}*", w.replace('"', "")))
            .collect::<Vec<_>>()
            .join(" ")
    };

    // Build WHERE clauses for mode
    let fts_match = match mode {
        "filename" => {
            if match_type == "exact" {
                format!("filename : {}", fts_query)
            } else {
                format!("filename : ({})", fts_query)
            }
        }
        "content" => {
            if match_type == "exact" {
                format!("content : {}", fts_query)
            } else {
                format!("content : ({})", fts_query)
            }
        }
        _ => fts_query.clone(), // "all" — search everywhere
    };

    // Build folder filter
    let mut conditions = vec![];
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(fid) = folder_id {
        conditions.push("d.folder_id = ?".to_string());
        param_values.push(Box::new(fid));
    }

    if let Some(ref types) = file_types {
        if !types.is_empty() {
            let placeholders: Vec<String> = types.iter().enumerate().map(|_| "?".to_string()).collect();
            conditions.push(format!("d.file_type IN ({})", placeholders.join(",")));
            for t in types {
                param_values.push(Box::new(t.clone()));
            }
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("AND {}", conditions.join(" AND "))
    };

    let order_clause = match sort_by {
        "date" => format!("d.modified_at {}", if sort_dir == "asc" { "ASC" } else { "DESC" }),
        "size" => format!("d.size_bytes {}", if sort_dir == "asc" { "ASC" } else { "DESC" }),
        "name" => format!("d.filename COLLATE NOCASE {}", if sort_dir == "asc" { "ASC" } else { "DESC" }),
        _ => "rank".to_string(),
    };

    let sql = format!(
        "SELECT d.id, d.folder_id, d.path, d.filename, d.file_type, d.size_bytes, d.modified_at, d.word_count,
                snippet(documents_fts, 1, '<mark>', '</mark>', '...', 10) as filename_snippet,
                snippet(documents_fts, 2, '<mark>', '</mark>', '...', 30) as content_snippet
         FROM documents_fts fts
         JOIN indexed_documents d ON d.id = fts.document_id
         WHERE documents_fts MATCH ?1
         {}
         ORDER BY {}
         LIMIT 100",
        where_clause, order_clause
    );

    let mut all_params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(fts_match)];
    all_params.extend(param_values);

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = all_params.iter().map(|p| p.as_ref()).collect();

    let mut stmt = conn.prepare(&sql)?;
    let results = stmt.query_map(params_refs.as_slice(), |row| {
        Ok(SearchResult {
            id: row.get(0)?,
            folder_id: row.get(1)?,
            path: row.get(2)?,
            filename: row.get(3)?,
            file_type: row.get(4)?,
            size_bytes: row.get(5)?,
            modified_at: row.get(6)?,
            word_count: row.get(7)?,
            filename_snippet: row.get(8)?,
            content_snippet: row.get(9)?,
        })
    })?.filter_map(|r| r.ok()).collect();

    Ok(results)
}

/// Update folder stats after indexing
pub fn update_folder_stats(db: &Database, folder_id: i64) -> Result<()> {
    let conn = db.conn.lock().unwrap();
    conn.execute(
        "UPDATE indexed_folders SET
            file_count = (SELECT COUNT(*) FROM indexed_documents WHERE folder_id = ?1 AND status = 'ok'),
            total_words = (SELECT COALESCE(SUM(word_count), 0) FROM indexed_documents WHERE folder_id = ?1 AND status = 'ok'),
            error_count = (SELECT COUNT(*) FROM indexed_documents WHERE folder_id = ?1 AND status = 'error'),
            last_indexed = datetime('now','localtime')
         WHERE id = ?1",
        params![folder_id],
    )?;
    Ok(())
}

/// Update exclude patterns for a folder
pub fn update_exclude_patterns(db: &Database, folder_id: i64, patterns: &[String]) -> Result<()> {
    let conn = db.conn.lock().unwrap();
    let json = serde_json::to_string(patterns).unwrap_or_else(|_| "[]".to_string());
    conn.execute(
        "UPDATE indexed_folders SET exclude_patterns = ?1 WHERE id = ?2",
        params![json, folder_id],
    )?;
    Ok(())
}

/// Get exclude patterns for a folder
pub fn get_exclude_patterns(db: &Database, folder_id: i64) -> Result<Vec<String>> {
    let conn = db.conn.lock().unwrap();
    let json: String = conn.query_row(
        "SELECT exclude_patterns FROM indexed_folders WHERE id = ?1",
        params![folder_id],
        |row| row.get(0),
    )?;
    Ok(parse_exclude_patterns(&json))
}
