use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;

use tauri::{AppHandle, Manager};

use crate::net::local_lan_ip;

const SYNC_SERVER_PORT: u16 = 4122;

struct SyncServerProcess {
    child: Mutex<Option<Child>>,
}

fn find_sync_server_script(app: &AppHandle) -> Option<PathBuf> {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let resource_path = resource_dir.join("pc-sync-server.cjs");
        if resource_path.exists() {
            return Some(resource_path);
        }
    }

    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|parent| parent.to_path_buf()));

    if let Some(dir) = &exe_dir {
        let path = dir.join("pc-sync-server.cjs");
        if path.exists() {
            return Some(path);
        }
    }

    let dev_paths = [
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .and_then(|player| player.parent())
            .map(|root| root.join("pc-sync-server.cjs")),
    ];

    for maybe_path in dev_paths.into_iter().flatten() {
        if maybe_path.exists() {
            return Some(maybe_path);
        }
    }

    None
}

pub fn init_sync_server(app: &AppHandle) {
    let script_path = match find_sync_server_script(app) {
        Some(path) => path,
        None => {
            log::warn!("[SyncServer] pc-sync-server.cjs not found; sync server will not start");
            return;
        }
    };

    log::info!(
        "[SyncServer] Starting sync server from: {}",
        script_path.display()
    );

    match Command::new("node")
        .arg(&script_path)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
    {
        Ok(child) => {
            log::info!(
                "[SyncServer] Sync server started (PID {})",
                child.id()
            );
            app.manage(SyncServerProcess {
                child: Mutex::new(Some(child)),
            });
        }
        Err(err) => {
            log::error!("[SyncServer] Failed to start sync server: {err}");
        }
    }
}

pub fn stop_sync_server(app: &AppHandle) {
    if let Some(state) = app.try_state::<SyncServerProcess>() {
        if let Ok(mut guard) = state.child.lock() {
            if let Some(mut child) = guard.take() {
                log::info!("[SyncServer] Stopping sync server (PID {})", child.id());
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

#[tauri::command]
#[specta::specta]
pub fn sync_server_info() -> SyncServerInfo {
    let local_ip = local_lan_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|| "127.0.0.1".to_string());

    SyncServerInfo {
        ip: local_ip,
        port: SYNC_SERVER_PORT,
    }
}

#[derive(serde::Serialize, specta::Type)]
pub struct SyncServerInfo {
    pub ip: String,
    pub port: u16,
}
