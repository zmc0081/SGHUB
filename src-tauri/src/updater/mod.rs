//! Auto-updater scheduling + status API (V2.1.0).
//!
//! See `scheduler::init` for the lifecycle, and `commands` for the
//! Tauri-callable surface.

pub mod commands;
pub mod scheduler;

pub use commands::{
    check_update_now, get_updater_status, install_pending_update,
    set_updater_config,
};
pub use scheduler::{build_cron, init};
