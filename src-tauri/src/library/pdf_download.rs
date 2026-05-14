//! PDF download + external-URL handling for the unified PaperActions row.
//!
//! - `resolve_paper_url`     : DOI/source_url/arxiv/pubmed fallback chain
//! - `open_external_url`     : OS-default browser via the `opener` crate
//! - `download_paper_pdf`    : stream-to-disk with progress emission
//! - `cancel_download`       : cooperative cancellation signal
//!
//! Cancellation is implemented via a shared `HashSet<paper_id>` guarded by
//! a tokio Mutex — calling `cancel_download` inserts the paper id, the
//! download loop polls it on each chunk and aborts cleanly. The set is
//! cleared once a download finishes (success, error, or cancel).

use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::OnceLock;

use futures::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};
use tokio::sync::Mutex;

use crate::AppState;

// ============================================================
// Cancellation registry — keyed by paper_id, populated by
// cancel_download, polled by the download loop. `OnceLock` keeps
// this rust-version: 1.77 compatible (LazyLock needs 1.80).
// ============================================================

fn cancelled_set() -> &'static Mutex<HashSet<String>> {
    static CELL: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
    CELL.get_or_init(|| Mutex::new(HashSet::new()))
}

async fn mark_cancelled(paper_id: &str) {
    cancelled_set().lock().await.insert(paper_id.to_string());
}

async fn was_cancelled(paper_id: &str) -> bool {
    cancelled_set().lock().await.contains(paper_id)
}

async fn clear_cancelled(paper_id: &str) {
    cancelled_set().lock().await.remove(paper_id);
}

// ============================================================
// Event payload — progress 0..=100 percent, or -1 when sized is
// unknown (some sources stream without Content-Length).
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgressPayload {
    pub paper_id: String,
    pub percent: i32,
    /// Bytes received so far. Always present, even when total is unknown.
    pub received: u64,
    /// Total bytes if Content-Length was provided.
    pub total: Option<u64>,
    /// "downloading" | "done" | "error" | "cancelled"
    pub status: String,
    pub error: Option<String>,
    /// On `done`, absolute path to the saved PDF.
    pub path: Option<String>,
}

fn emit_progress(app: &tauri::AppHandle, payload: &DownloadProgressPayload) {
    if let Err(e) = app.emit("download:progress", payload) {
        log::warn!("emit download:progress failed: {}", e);
    }
}

// ============================================================
// URL resolution
// ============================================================

/// Walk the priority chain DOI → source_url → arxiv abs → pubmed detail.
/// Returns `None` when nothing is usable (no DOI / no source_id).
fn resolve_from_paper(paper: &crate::search::Paper) -> Option<String> {
    if let Some(doi) = paper.doi.as_deref().filter(|s| !s.is_empty()) {
        // doi.org redirect resolves to the publisher landing page
        return Some(format!("https://doi.org/{}", doi.trim_start_matches("doi:")));
    }
    if let Some(url) = paper.source_url.as_deref().filter(|s| !s.is_empty()) {
        return Some(url.to_string());
    }
    if paper.source == "arxiv" {
        if let Some(id) = paper.source_id.as_deref().filter(|s| !s.is_empty()) {
            return Some(format!("https://arxiv.org/abs/{}", id));
        }
    }
    if paper.source == "pubmed" {
        if let Some(id) = paper.source_id.as_deref().filter(|s| !s.is_empty()) {
            return Some(format!("https://pubmed.ncbi.nlm.nih.gov/{}/", id));
        }
    }
    None
}

/// Best-effort PDF URL construction for open-access sources. Returns None
/// when the source doesn't expose a predictable PDF endpoint — the caller
/// then surfaces "non-OA" to the user instead of downloading the landing
/// page HTML.
fn pdf_url_for(paper: &crate::search::Paper) -> Option<String> {
    if paper.source == "arxiv" {
        return paper
            .source_id
            .as_deref()
            .filter(|s| !s.is_empty())
            .map(|id| format!("https://arxiv.org/pdf/{}", id));
    }
    // OpenAlex sometimes has a direct PDF URL in source_url for OA works,
    // but we conservatively trust the explicit `.pdf` suffix only.
    if let Some(url) = paper.source_url.as_deref() {
        let lower = url.to_lowercase();
        if lower.ends_with(".pdf") {
            return Some(url.to_string());
        }
    }
    None
}

#[tauri::command]
pub async fn resolve_paper_url(
    state: tauri::State<'_, AppState>,
    paper_id: String,
) -> Result<Option<String>, String> {
    let pool = state.db_pool.clone();
    let paper = tokio::task::spawn_blocking(move || {
        crate::library::db_get_paper_by_id(&pool, &paper_id)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;
    Ok(paper.as_ref().and_then(resolve_from_paper))
}

#[tauri::command]
pub async fn open_external_url(url: String) -> Result<(), String> {
    // Basic safety: only accept http(s) — never let an injected payload
    // hand us `file://` or `javascript:` and shell out.
    let lower = url.to_lowercase();
    if !(lower.starts_with("http://") || lower.starts_with("https://")) {
        return Err(format!("拒绝打开非 HTTP 链接: {}", url));
    }
    tokio::task::spawn_blocking(move || opener::open(&url).map_err(|e| e.to_string()))
        .await
        .map_err(|e| e.to_string())?
}

// ============================================================
// Download
// ============================================================

fn pdfs_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("data")
        .join("pdfs");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Persist `pdf_path` on the paper row so subsequent loads of the UI
/// know the file is local.
fn db_set_pdf_path(
    pool: &crate::db::DbPool,
    paper_id: &str,
    path: &str,
) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "UPDATE papers SET pdf_path = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') \
         WHERE id = ?2",
        rusqlite::params![path, paper_id],
    )
}

#[tauri::command]
pub async fn download_paper_pdf(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    paper_id: String,
) -> Result<String, String> {
    // STEP 1: Load paper metadata.
    let pool = state.db_pool.clone();
    let pid_for_load = paper_id.clone();
    let paper = tokio::task::spawn_blocking(move || {
        crate::library::db_get_paper_by_id(&pool, &pid_for_load)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("paper `{}` not found", paper_id))?;

    // STEP 2: Already downloaded → return the existing path immediately.
    if let Some(existing) = paper.pdf_path.as_deref().filter(|s| !s.is_empty()) {
        if std::path::Path::new(existing).exists() {
            emit_progress(
                &app,
                &DownloadProgressPayload {
                    paper_id: paper_id.clone(),
                    percent: 100,
                    received: 0,
                    total: None,
                    status: "done".into(),
                    error: None,
                    path: Some(existing.to_string()),
                },
            );
            return Ok(existing.to_string());
        }
    }

    // STEP 3: Refuse if non-OA (no predictable PDF URL).
    let url = match pdf_url_for(&paper) {
        Some(u) => u,
        None => {
            let msg = "该文献不是开放获取,无法下载".to_string();
            emit_progress(
                &app,
                &DownloadProgressPayload {
                    paper_id: paper_id.clone(),
                    percent: 0,
                    received: 0,
                    total: None,
                    status: "error".into(),
                    error: Some(msg.clone()),
                    path: None,
                },
            );
            return Err(msg);
        }
    };

    // STEP 4: Clear any stale cancel flag before we start.
    clear_cancelled(&paper_id).await;

    let dir = pdfs_dir(&app)?;
    let dest = dir.join(format!("{}.pdf", paper_id));
    let tmp = dest.with_extension("pdf.part");

    // STEP 5: Stream the response into the .part file with progress events.
    let client = reqwest::Client::builder()
        .user_agent("sghub/2.0.1 (research literature client)")
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let msg = format!("下载失败 (HTTP {})", resp.status());
        emit_progress(
            &app,
            &DownloadProgressPayload {
                paper_id: paper_id.clone(),
                percent: 0,
                received: 0,
                total: None,
                status: "error".into(),
                error: Some(msg.clone()),
                path: None,
            },
        );
        return Err(msg);
    }
    let total = resp.content_length();

    let mut file = tokio::fs::File::create(&tmp).await.map_err(|e| e.to_string())?;
    let mut received: u64 = 0;
    let mut last_percent: i32 = -1;
    let mut stream = resp.bytes_stream();

    use tokio::io::AsyncWriteExt;
    while let Some(chunk) = stream.next().await {
        if was_cancelled(&paper_id).await {
            let _ = tokio::fs::remove_file(&tmp).await;
            clear_cancelled(&paper_id).await;
            emit_progress(
                &app,
                &DownloadProgressPayload {
                    paper_id: paper_id.clone(),
                    percent: 0,
                    received,
                    total,
                    status: "cancelled".into(),
                    error: None,
                    path: None,
                },
            );
            return Err("已取消".into());
        }

        let bytes = chunk.map_err(|e| e.to_string())?;
        received += bytes.len() as u64;
        file.write_all(&bytes).await.map_err(|e| e.to_string())?;

        let pct = match total {
            Some(t) if t > 0 => ((received as f64 / t as f64) * 100.0) as i32,
            _ => -1,
        };
        // Throttle: only emit on integer percent change (or every chunk
        // when total is unknown so the UI still shows movement).
        if pct != last_percent {
            last_percent = pct;
            emit_progress(
                &app,
                &DownloadProgressPayload {
                    paper_id: paper_id.clone(),
                    percent: pct,
                    received,
                    total,
                    status: "downloading".into(),
                    error: None,
                    path: None,
                },
            );
        }
    }

    file.flush().await.map_err(|e| e.to_string())?;
    drop(file);
    tokio::fs::rename(&tmp, &dest)
        .await
        .map_err(|e| e.to_string())?;

    // STEP 6: Persist pdf_path in DB so reopening the app shows it as local.
    let dest_str = dest.to_string_lossy().into_owned();
    let pool2 = state.db_pool.clone();
    let pid_for_update = paper_id.clone();
    let dest_for_update = dest_str.clone();
    tokio::task::spawn_blocking(move || {
        db_set_pdf_path(&pool2, &pid_for_update, &dest_for_update)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    clear_cancelled(&paper_id).await;
    emit_progress(
        &app,
        &DownloadProgressPayload {
            paper_id,
            percent: 100,
            received,
            total,
            status: "done".into(),
            error: None,
            path: Some(dest_str.clone()),
        },
    );
    Ok(dest_str)
}

#[tauri::command]
pub async fn cancel_download(paper_id: String) -> Result<(), String> {
    mark_cancelled(&paper_id).await;
    Ok(())
}

/// Open a local PDF in the OS-default viewer. Used after `download_paper_pdf`
/// finishes (or when `paper.pdf_path` was already set).
#[tauri::command]
pub async fn open_local_pdf(path: String) -> Result<(), String> {
    if !std::path::Path::new(&path).exists() {
        return Err(format!("文件不存在: {}", path));
    }
    tokio::task::spawn_blocking(move || opener::open(&path).map_err(|e| e.to_string()))
        .await
        .map_err(|e| e.to_string())?
}
