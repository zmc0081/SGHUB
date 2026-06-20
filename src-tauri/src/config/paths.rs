//! Centralised path derivation (V2.1.0).
//!
//! Every module that previously called `app.path().app_data_dir()`
//! now goes through one of these helpers so that the
//! "custom data directory" feature has a single switching point.
//!
//! Layout under the effective data directory:
//!
//! ```text
//! <effective_data_dir>/
//! ├── data/
//! │   ├── sghub.db
//! │   ├── pdfs/
//! │   │   └── uploaded/{uuid}.pdf
//! │   ├── chat_attachments/<session_id>/{uuid}.{ext}
//! │   ├── exports/
//! │   └── cache/
//! ├── skills/         user-uploaded YAML/skill files
//! ├── pdfs/_temp/     download-in-progress holding area
//! └── logs/
//! ```

use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager, Runtime};

use crate::config::bootstrap;

/// Resolve the **effective** data directory.
///
/// Priority:
/// 1. `bootstrap.data_dir` from the OS-config-dir bootstrap.toml IF
///    the directory currently exists and is a directory.
/// 2. Tauri's default `app.path().app_data_dir()`.
/// 3. Last-resort tmp fallback (only hit on stripped-down platforms
///    where neither lookup works — better than panicking at boot).
pub fn effective_data_dir<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    if let Some(custom) = bootstrap::load().data_dir {
        if custom.is_dir() {
            return custom;
        } else {
            log::warn!(
                "bootstrap data_dir `{}` is missing — falling back to app_data_dir",
                custom.display()
            );
        }
    }
    app.path().app_data_dir().unwrap_or_else(|e| {
        log::warn!("app_data_dir lookup failed: {} — using temp", e);
        std::env::temp_dir().join("sghub-fallback")
    })
}

/// `<effective>/data/` — the SQLite + PDF + chat attachments root.
pub fn data_root<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    effective_data_dir(app).join("data")
}

/// `<effective>/data/sghub.db`
pub fn db_file<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    data_root(app).join("sghub.db")
}

/// `<effective>/data/pdfs/`
pub fn pdfs_dir<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    data_root(app).join("pdfs")
}

/// `<effective>/data/pdfs/uploaded/`
pub fn uploaded_pdfs_dir<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    pdfs_dir(app).join("uploaded")
}

/// Resolve a stored `papers.pdf_path` to an absolute filesystem path.
///
/// Storage is mixed by design: uploaded papers store a path RELATIVE to
/// `<data>/pdfs/` (e.g. `uploaded/{uuid}.pdf`) so the data directory stays
/// portable, while downloaded OA papers store an absolute path. Absolute
/// inputs pass through unchanged; relative inputs are joined onto
/// `pdfs_dir`. This is the single resolver every PDF consumer must use.
pub fn resolve_pdf_path<R: Runtime>(app: &AppHandle<R>, pdf_path: &str) -> PathBuf {
    let p = Path::new(pdf_path);
    if p.is_absolute() {
        p.to_path_buf()
    } else {
        pdfs_dir(app).join(pdf_path)
    }
}

/// `<effective>/data/chat_attachments/<session_id>/`
pub fn chat_attachments_dir<R: Runtime>(app: &AppHandle<R>, session_id: &str) -> PathBuf {
    data_root(app).join("chat_attachments").join(session_id)
}

/// `<effective>/data/exports/`
pub fn exports_dir<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    data_root(app).join("exports")
}

/// `<effective>/skills/` — user-uploaded YAML/.skill files (built-in
/// skills live inside the bundle and don't use this path).
pub fn skills_dir<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    effective_data_dir(app).join("skills")
}

/// `<effective>/logs/`
#[allow(dead_code)]
pub fn logs_dir<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    effective_data_dir(app).join("logs")
}
