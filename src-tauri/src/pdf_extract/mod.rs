//! Thin wrapper over the `pdf-extract` crate.
//!
//! `pdf_path` in the `papers` table is stored relative to
//! `<app_data_dir>/data/pdfs/`. This module resolves the relative path
//! and reads the file via `pdf-extract`.

use std::path::{Path, PathBuf};

use thiserror::Error;

#[derive(Debug, Error)]
pub enum PdfError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("tauri path: {0}")]
    Path(String),
    #[error("pdf parse: {0}")]
    Parse(String),
    #[error("pdf file not found: {0}")]
    NotFound(String),
}

/// Resolve a stored relative pdf_path to an absolute file system path.
fn resolve(app: &tauri::AppHandle, pdf_path: &str) -> Result<PathBuf, PdfError> {
    use tauri::Manager;
    // Absolute paths bypass the data-dir convention (allow user-imported PDFs)
    let candidate = Path::new(pdf_path);
    if candidate.is_absolute() {
        return Ok(candidate.to_path_buf());
    }
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| PdfError::Path(e.to_string()))?
        .join("data")
        .join("pdfs");
    Ok(base.join(pdf_path))
}

/// Extract plain text from a PDF given a path.
pub fn extract_text(path: &Path) -> Result<String, PdfError> {
    if !path.exists() {
        return Err(PdfError::NotFound(path.display().to_string()));
    }
    let bytes = std::fs::read(path)?;
    pdf_extract::extract_text_from_mem(&bytes).map_err(|e| PdfError::Parse(e.to_string()))
}

/// Resolve the paper's stored relative pdf_path and extract its text.
pub fn extract_paper_text(
    app: &tauri::AppHandle,
    pdf_path: &str,
) -> Result<String, PdfError> {
    let abs = resolve(app, pdf_path)?;
    extract_text(&abs)
}
