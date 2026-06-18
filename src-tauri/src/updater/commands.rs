//! Tauri commands surfaced to the React layer.

use serde::{Deserialize, Serialize};

use crate::updater::scheduler::{self, PendingUpdate};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdaterStatus {
    pub current_version: String,
    pub last_check_at: Option<String>,
    pub has_pending_update: bool,
    pub pending: Option<PendingUpdate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResult {
    pub had_update: bool,
    pub pending: Option<PendingUpdate>,
    pub last_check_at: String,
}

/// Compose a snapshot of the updater state for the Settings page.
#[tauri::command]
pub async fn get_updater_status(app: tauri::AppHandle) -> Result<UpdaterStatus, String> {
    let st = scheduler::state().read().await;
    let current_version = app.package_info().version.to_string();
    Ok(UpdaterStatus {
        current_version,
        last_check_at: st.last_check_at.clone(),
        has_pending_update: st.pending.is_some(),
        pending: st.pending.clone(),
    })
}

/// Trigger an update check immediately (updates `last_check_at`).
#[tauri::command]
pub async fn check_update_now(app: tauri::AppHandle) -> Result<CheckResult, String> {
    scheduler::perform_check(app).await;
    let st = scheduler::state().read().await;
    Ok(CheckResult {
        had_update: st.pending.is_some(),
        pending: st.pending.clone(),
        last_check_at: st.last_check_at.clone().unwrap_or_default(),
    })
}

/// Re-check (we don't keep the `Update` handle live between IPC calls
/// because it isn't `Send`-friendly across tasks) then install if found.
#[tauri::command]
pub async fn install_pending_update(app: tauri::AppHandle) -> Result<(), String> {
    // Same gate as `perform_check` — the plugin is only registered for
    // release builds so we can't actually install in dev.
    #[cfg(all(desktop, not(debug_assertions)))]
    {
        use tauri_plugin_updater::UpdaterExt;
        let updater = app
            .updater()
            .map_err(|e| format!("updater unavailable: {}", e))?;
        let update = updater
            .check()
            .await
            .map_err(|e| format!("check failed: {}", e))?
            .ok_or_else(|| "no update available".to_string())?;
        update
            .download_and_install(|_chunk, _total| {}, || {})
            .await
            .map_err(|e| format!("install failed: {}", e))?;
        // Clear pending; the app is about to restart anyway.
        scheduler::state().write().await.pending = None;
        Ok(())
    }
    #[cfg(not(all(desktop, not(debug_assertions))))]
    {
        let _ = app;
        Err("updater is only available in release builds".into())
    }
}
