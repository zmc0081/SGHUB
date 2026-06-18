//! Updater background check (V2.2.5 — simplified).
//!
//! The V2.1.0 design had a full cron scheduler with user-configurable
//! frequency / time / action + a master toggle. V2.2.5 drops all of that
//! to cut cognitive load: there is exactly one fixed policy — **check
//! once shortly after launch** — plus the manual "check now" button. When
//! an update is found we always emit `updater:available` so the frontend
//! can notify and let the user decide.
//!
//! Live state (last check timestamp + pending update) is kept in-memory
//! in `UPDATER_STATE`; it's re-derived on each launch.

use std::sync::OnceLock;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tokio::sync::RwLock;

/// Delay after launch before the one-shot check, so we don't compete with
/// cold-start work.
const STARTUP_CHECK_DELAY: Duration = Duration::from_secs(30);

// ============================================================
// Live state
// ============================================================

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PendingUpdate {
    pub version: String,
    pub notes: Option<String>,
    pub detected_at: String,
}

#[derive(Default)]
pub struct UpdaterState {
    pub last_check_at: Option<String>,
    pub pending: Option<PendingUpdate>,
}

pub static UPDATER_STATE: OnceLock<RwLock<UpdaterState>> = OnceLock::new();

pub fn state() -> &'static RwLock<UpdaterState> {
    UPDATER_STATE.get_or_init(|| RwLock::new(UpdaterState::default()))
}

// ============================================================
// Public entry
// ============================================================

/// Spawn the one-shot startup check. Called once from
/// `tauri::Builder::setup`. Never fails — kept `async` + `Result` for a
/// uniform call site in `lib.rs`.
pub async fn init(app: AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(STARTUP_CHECK_DELAY).await;
        log::info!("updater: running startup check");
        perform_check(app).await;
    });
    Ok(())
}

/// Invoke the Tauri updater plugin and record the outcome in
/// `UPDATER_STATE`. On a found update, emit `updater:available` so the UI
/// notifies the user (the only behaviour now — no silent-download /
/// check-only modes). Failure to reach the update server is logged and
/// swallowed.
pub async fn perform_check(app: AppHandle) {
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    {
        let mut st = state().write().await;
        st.last_check_at = Some(now.clone());
    }

    // The plugin is only registered for release builds (see lib.rs);
    // calling `app.updater()` without registration panics inside Tauri.
    // Gate this branch so dev builds keep the last_check_at refresh + UI
    // flow but skip the real plugin call.
    #[cfg(all(desktop, not(debug_assertions)))]
    {
        use tauri::Emitter;
        use tauri_plugin_updater::UpdaterExt;
        let updater = match app.updater() {
            Ok(u) => u,
            Err(e) => {
                log::warn!("updater: unavailable ({}). Skipping check.", e);
                return;
            }
        };
        match updater.check().await {
            Ok(Some(update)) => {
                let pending = PendingUpdate {
                    version: update.version.clone(),
                    notes: update.body.clone(),
                    detected_at: now,
                };
                log::info!("updater: update available v{}", pending.version);
                {
                    let mut st = state().write().await;
                    st.pending = Some(pending.clone());
                }
                let _ = app.emit("updater:available", &update.version);
            }
            Ok(None) => {
                log::info!("updater: no update available");
                let mut st = state().write().await;
                st.pending = None;
            }
            Err(e) => {
                log::warn!("updater: check failed: {}", e);
            }
        }
    }

    #[cfg(not(all(desktop, not(debug_assertions))))]
    {
        let _ = app;
        log::info!("updater: skipped (debug build / plugin not registered)");
    }
}
