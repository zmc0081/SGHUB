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
    // Absolute paths bypass the data-dir convention (allow user-imported PDFs)
    let candidate = Path::new(pdf_path);
    if candidate.is_absolute() {
        return Ok(candidate.to_path_buf());
    }
    Ok(crate::config::paths::pdfs_dir(app).join(pdf_path))
}

/// Extract plain text from a PDF given a path.
///
/// `pdf_extract` (and its `adobe-cmap-parser` dep) panics on a handful
/// of malformed PDFs ("bad length of hexstring" etc.). A panic here
/// would tear down the tokio worker driving the IPC, leaving the UI
/// stuck on "uploading…". We catch it and surface a normal `Err`.
pub fn extract_text(path: &Path) -> Result<String, PdfError> {
    if !path.exists() {
        return Err(PdfError::NotFound(path.display().to_string()));
    }
    let bytes = std::fs::read(path)?;
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        pdf_extract::extract_text_from_mem(&bytes)
    }));
    match result {
        Ok(Ok(text)) => Ok(text),
        Ok(Err(e)) => Err(PdfError::Parse(e.to_string())),
        Err(_) => Err(PdfError::Parse(
            "PDF 解析过程中发生 panic(可能是损坏或非标准格式)".into(),
        )),
    }
}

/// Resolve the paper's stored relative pdf_path and extract its text.
pub fn extract_paper_text(
    app: &tauri::AppHandle,
    pdf_path: &str,
) -> Result<String, PdfError> {
    let abs = resolve(app, pdf_path)?;
    extract_text(&abs)
}
