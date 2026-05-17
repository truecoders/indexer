use crate::db::{self, Database, IndexerFolder, SearchResult, IndexerStats};
use crate::indexer;
use crate::watcher::WatcherState;
use std::sync::Arc;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn add_folder(app: AppHandle, db: State<'_, Arc<Database>>, watcher: State<'_, Arc<WatcherState>>) -> Result<Option<IndexerFolder>, String> {
    // Open folder dialog
    let folder = app.dialog().file()
        .set_title("Выберите папку для индексации")
        .blocking_pick_folder();

    let folder_path = match folder {
        Some(f) => f.to_string(),
        None => return Ok(None),
    };

    // Add to database
    let folder = db::add_folder(&db, &folder_path).map_err(|e| e.to_string())?;
    let folder_id = folder.id;
    let path = folder.path.clone();

    // Start indexing in background
    let db_clone = Arc::clone(&db);
    let app_clone = app.clone();
    tokio::task::spawn_blocking(move || {
        let _ = indexer::index_folder(&app_clone, &db_clone, folder_id, &path);
    });

    // Start watcher if enabled
    if folder.watch_enabled {
        let _ = watcher.start_watching(folder_id, folder.path.clone(), app, Arc::clone(&db));
    }

    Ok(Some(folder))
}

#[tauri::command]
pub async fn remove_folder(db: State<'_, Arc<Database>>, watcher: State<'_, Arc<WatcherState>>, id: i64) -> Result<bool, String> {
    watcher.stop_watching(id);
    db::remove_folder(&db, id).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn list_folders(db: State<'_, Arc<Database>>) -> Result<Vec<IndexerFolder>, String> {
    db::list_folders(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reindex(app: AppHandle, db: State<'_, Arc<Database>>, id: i64) -> Result<bool, String> {
    let folders = db::list_folders(&db).map_err(|e| e.to_string())?;
    let folder = folders.iter().find(|f| f.id == id).ok_or("Folder not found")?;
    let path = folder.path.clone();

    let db_clone = Arc::clone(&db);
    tokio::task::spawn_blocking(move || {
        let _ = indexer::index_folder(&app, &db_clone, id, &path);
    });

    Ok(true)
}

#[tauri::command]
pub async fn search(
    db: State<'_, Arc<Database>>,
    query: String,
    mode: String,
    match_type: String,
    folder_id: Option<i64>,
    file_types: Option<Vec<String>>,
) -> Result<Vec<SearchResult>, String> {
    db::search(&db, &query, &mode, &match_type, folder_id, file_types).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_file(path: String) -> Result<(), String> {
    opener::open(std::path::Path::new(&path)).map_err(|e| format!("Failed to open file: {}", e))
}

#[tauri::command]
pub async fn show_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| format!("Failed to show in folder: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_stats(db: State<'_, Arc<Database>>) -> Result<IndexerStats, String> {
    db::get_stats(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_watcher(
    app: AppHandle,
    db: State<'_, Arc<Database>>,
    watcher: State<'_, Arc<WatcherState>>,
    id: i64,
    enable: bool,
) -> Result<(), String> {
    if enable {
        let folders = db::list_folders(&db).map_err(|e| e.to_string())?;
        let folder = folders.iter().find(|f| f.id == id).ok_or("Folder not found")?;
        watcher.start_watching(id, folder.path.clone(), app, Arc::clone(&db))?;
    } else {
        watcher.stop_watching(id);
    }

    // Update DB
    {
        let conn = db.conn.lock().unwrap();
        conn.execute(
            "UPDATE indexed_folders SET watch_enabled = ?1 WHERE id = ?2",
            rusqlite::params![if enable { 1 } else { 0 }, id],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}
