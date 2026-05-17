mod commands;
mod db;
mod indexer;
mod parsers;
mod watcher;

use db::Database;
use watcher::WatcherState;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus existing window when second instance is launched
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Initialize database
            let app_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_dir).ok();
            let db_path = app_dir.join("indexer.db");

            let database = Arc::new(Database::new(db_path).expect("Failed to initialize database"));
            let watcher_state = Arc::new(WatcherState::new());

            // Start watchers for folders with watch_enabled
            if let Ok(folders) = db::list_folders(&database) {
                for folder in folders {
                    if folder.watch_enabled {
                        let _ = watcher_state.start_watching(
                            folder.id,
                            folder.path.clone(),
                            app.handle().clone(),
                            Arc::clone(&database),
                        );
                    }
                }
            }

            app.manage(database);
            app.manage(watcher_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::add_folder,
            commands::remove_folder,
            commands::list_folders,
            commands::reindex,
            commands::search,
            commands::open_file,
            commands::preview_file,
            commands::show_in_folder,
            commands::get_stats,
            commands::toggle_watcher,
            commands::update_exclude_patterns,
            commands::add_search_history,
            commands::list_search_history,
            commands::remove_search_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
