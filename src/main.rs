#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rust_file_explorer_v1::search::{FileKind, SearchBatch, search_files};
use rust_file_explorer_v1::{Directory, FileError, Location, list_directory, locations};
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicBool, Ordering},
};
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

#[derive(Default)]
struct SearchState(Mutex<(u64, Arc<AtomicBool>)>);

#[tauri::command]
async fn search_system(
    id: u64,
    query: String,
    kind: FileKind,
    include_hidden: bool,
    on_batch: tauri::ipc::Channel<SearchBatch>,
    state: tauri::State<'_, SearchState>,
) -> Result<(), FileError> {
    if query.trim().is_empty() {
        return Err(FileError::internal("Escribe un nombre para buscar.".into()));
    }
    let cancel = {
        let mut current = state
            .inner()
            .0
            .lock()
            .map_err(|e| FileError::internal(e.to_string()))?;
        if id <= current.0 {
            return Ok(());
        }
        current.1.store(true, Ordering::Relaxed);
        let cancel = Arc::new(AtomicBool::new(false));
        *current = (id, cancel.clone());
        cancel
    };
    tauri::async_runtime::spawn_blocking(move || {
        let roots = locations()
            .into_iter()
            .filter(|l| l.kind == "drive")
            .map(|l| l.path.into())
            .collect();
        search_files(roots, &query, kind, include_hidden, &cancel, |batch| {
            on_batch.send(batch).is_ok()
        });
    })
    .await
    .map_err(|e| FileError::internal(e.to_string()))
}

#[tauri::command]
fn cancel_search(id: u64, state: tauri::State<'_, SearchState>) -> Result<(), FileError> {
    let mut current = state
        .inner()
        .0
        .lock()
        .map_err(|e| FileError::internal(e.to_string()))?;
    if id >= current.0 {
        current.1.store(true, Ordering::Relaxed);
        current.0 = id;
    }
    Ok(())
}

#[tauri::command]
async fn read_directory(path: String) -> Result<Directory, FileError> {
    tauri::async_runtime::spawn_blocking(move || list_directory(&path))
        .await
        .map_err(|e| FileError::internal(e.to_string()))?
}

#[tauri::command]
async fn get_locations() -> Result<Vec<Location>, FileError> {
    tauri::async_runtime::spawn_blocking(locations)
        .await
        .map_err(|e| FileError::internal(e.to_string()))
}

#[tauri::command]
async fn open_file(app: tauri::AppHandle, path: String) -> Result<(), FileError> {
    tauri::async_runtime::spawn_blocking(move || {
        let metadata = std::fs::metadata(&path).map_err(|e| FileError::from_io(&path, e))?;
        if !metadata.is_file() {
            return Err(FileError::internal(
                "Selecciona un archivo, no una carpeta.".into(),
            ));
        }
        app.opener()
            .open_path(path, None::<&str>)
            .map_err(|e| FileError::internal(e.to_string()))
    })
    .await
    .map_err(|e| FileError::internal(e.to_string()))?
}

fn main() {
    tauri::Builder::default()
        .manage(SearchState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_directory,
            get_locations,
            open_file,
            search_system,
            cancel_search
        ])
        .build(tauri::generate_context!())
        .expect("No se pudo iniciar el explorador")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit)
                && let Ok(current) = app.state::<SearchState>().inner().0.lock()
            {
                current.1.store(true, Ordering::Relaxed);
            }
        });
}
