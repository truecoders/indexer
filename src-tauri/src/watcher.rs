use crate::db::Database;
use notify::{RecommendedWatcher, RecursiveMode, Watcher, Event};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::AppHandle;

pub struct WatcherState {
    pub watchers: Mutex<HashMap<i64, RecommendedWatcher>>,
}

impl WatcherState {
    pub fn new() -> Self {
        WatcherState {
            watchers: Mutex::new(HashMap::new()),
        }
    }

    pub fn start_watching(
        &self,
        folder_id: i64,
        folder_path: String,
        app: AppHandle,
        db: Arc<Database>,
    ) -> Result<(), String> {
        let mut watchers = self.watchers.lock().unwrap();

        // Stop existing watcher if any
        watchers.remove(&folder_id);

        let app_clone = app.clone();
        let db_clone = db.clone();
        let path_clone = folder_path.clone();
        let fid = folder_id;

        let mut watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(_event) = res {
                    // Debounce by just re-indexing on any change
                    // A proper debouncer would batch events
                    let _ = std::thread::spawn({
                        let app = app_clone.clone();
                        let db = db_clone.clone();
                        let path = path_clone.clone();
                        move || {
                            // Small delay to debounce rapid changes
                            std::thread::sleep(Duration::from_secs(2));
                            let _ = crate::indexer::index_folder(&app, &db, fid, &path);
                        }
                    });
                }
            },
            notify::Config::default(),
        ).map_err(|e| format!("Failed to create watcher: {}", e))?;

        watcher.watch(
            std::path::Path::new(&folder_path),
            RecursiveMode::Recursive,
        ).map_err(|e| format!("Failed to watch folder: {}", e))?;

        watchers.insert(folder_id, watcher);
        log::info!("Started watching folder {}: {}", folder_id, folder_path);
        Ok(())
    }

    pub fn stop_watching(&self, folder_id: i64) {
        let mut watchers = self.watchers.lock().unwrap();
        if watchers.remove(&folder_id).is_some() {
            log::info!("Stopped watching folder {}", folder_id);
        }
    }

    #[allow(dead_code)]
    pub fn is_watching(&self, folder_id: i64) -> bool {
        let watchers = self.watchers.lock().unwrap();
        watchers.contains_key(&folder_id)
    }
}
