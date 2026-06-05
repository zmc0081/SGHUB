//! Local PDF upload + FTS5-backed search.
//!
//! Commands:
//! - `upload_local_paper`        — single file: copy + extract + insert
//! - `upload_local_papers_batch` — many files with `upload:progress` events
//! - `update_paper_metadata`     — manual edit; FTS5 stays in sync via the
//!   `papers_au` trigger from V001.
//! - `search_local_papers`       — FTS5 MATCH with snippet highlighting.
//!
//! PDFs are copied under `<app_data_dir>/data/pdfs/uploaded/{uuid}.pdf` and
//! the path stored in `papers.pdf_path` is RELATIVE (so the app remains
//! portable across user folders).

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::Emitter;

use crate::library::metadata_extractor::{extract_pdf_metadata, PartialMetadata};
use crate::AppState;

const MAX_PDF_BYTES: u64 = 100 * 1024 * 1024; // 100 MiB

// ============================================================
// Public response types
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadResult {
    pub paper_id: String,
    pub partial_metadata: PartialMetadata,
    pub needs_user_review: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchUploadItem {
    pub file_path: String,
    pub success: bool,
    pub paper_id: Option<String>,
    pub needs_user_review: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadProgressPayload {
    pub current: usize,
    pub total: usize,
    pub current_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaperSearchResult {
    pub id: String,
    pub title: String,
    /// HTML-escaped snippet with `<mark>…</mark>` surrounding hits.
    pub title_highlight: String,
    pub authors: Vec<String>,
    pub source: String,
    #[serde(rename = "abstract")]
    pub abstract_: Option<String>,
    pub doi: Option<String>,
    pub pdf_path: Option<String>,
    /// First folder this paper is filed under (path joined by " / "),
    /// or None when uncategorized.
    pub current_folder_path: Option<String>,
    /// FTS5 rank (smaller = more relevant; raw `bm25()`).
    pub rank: f64,
}

/// Disk usage of the `uploaded/` PDF store.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageUsage {
    pub file_count: usize,
    pub total_bytes: u64,
}

/// Result of removing PDF files no longer referenced by any paper row.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrphanCleanupResult {
    pub removed_count: usize,
    pub freed_bytes: u64,
}

/// One candidate file that is byte-identical to an already-imported PDF.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateInfo {
    /// The candidate path the user is trying to import.
    pub file_path: String,
    pub existing_paper_id: String,
    pub existing_title: String,
}

// ============================================================
// Validation + paths
// ============================================================

fn validate_pdf(path: &Path) -> Result<u64, String> {
    if !path.exists() {
        return Err(format!("文件不存在: {}", path.display()));
    }
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    if ext != "pdf" {
        return Err(format!("仅支持 .pdf 文件 (当前: .{})", ext));
    }
    let size = std::fs::metadata(path)
        .map_err(|e| format!("读取文件大小失败: {}", e))?
        .len();
    if size > MAX_PDF_BYTES {
        return Err(format!(
            "文件过大 ({} MB > {} MB)",
            size / 1024 / 1024,
            MAX_PDF_BYTES / 1024 / 1024
        ));
    }
    Ok(size)
}

fn uploaded_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = crate::config::paths::uploaded_pdfs_dir(app);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

// ============================================================
// DB write
// ============================================================

fn db_insert_local_paper(
    pool: &crate::db::DbPool,
    id: &str,
    title: &str,
    authors_json: &str,
    abstract_: Option<&str>,
    doi: Option<&str>,
    pdf_relative_path: &str,
) -> rusqlite::Result<()> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "INSERT INTO papers \
         (id, title, authors, abstract, doi, source, source_id, pdf_path, \
          read_status, uploaded_at, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, 'local', ?1, ?6, 'unread', \
                 strftime('%Y-%m-%dT%H:%M:%SZ','now'), \
                 strftime('%Y-%m-%dT%H:%M:%SZ','now'), \
                 strftime('%Y-%m-%dT%H:%M:%SZ','now'))",
        params![id, title, authors_json, abstract_, doi, pdf_relative_path],
    )?;
    Ok(())
}

fn db_update_metadata(
    pool: &crate::db::DbPool,
    paper_id: &str,
    title: &str,
    authors_json: &str,
    abstract_: Option<&str>,
    doi: Option<&str>,
) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    // The `papers_au` AFTER UPDATE trigger handles the FTS resync.
    conn.execute(
        "UPDATE papers SET title = ?1, authors = ?2, abstract = ?3, doi = ?4, \
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?5",
        params![title, authors_json, abstract_, doi, paper_id],
    )
}

// ============================================================
// FTS5 query building
// ============================================================

/// Sanitize user input → FTS5 query. We:
///   - escape `"` by doubling
///   - wrap each whitespace-separated token in quotes
///   - join with ` AND ` for implicit conjunction
///   - prepend a `NEAR/5` clause when there are 2+ tokens so close hits
///     rank above scattered matches.
fn to_fts_query(input: &str) -> Option<String> {
    let tokens: Vec<String> = input
        .split_whitespace()
        .filter(|t| !t.is_empty())
        .map(|t| {
            let escaped = t.replace('"', "\"\"");
            // FTS5 doesn't allow leading wildcards but does allow trailing.
            // Strip punctuation-only tokens.
            let stripped: String = escaped
                .chars()
                .filter(|c| c.is_alphanumeric() || matches!(c, '-' | '_' | '.' | '\"'))
                .collect();
            stripped
        })
        .filter(|t| !t.is_empty())
        .collect();
    if tokens.is_empty() {
        return None;
    }
    let quoted: Vec<String> = tokens.iter().map(|t| format!("\"{}\"", t)).collect();
    if quoted.len() >= 2 {
        // `NEAR/5(a b c)` matches when all tokens are within 5 token-positions.
        // Combine with the AND form to widen recall.
        Some(format!(
            "({}) OR NEAR({}, 5)",
            quoted.join(" AND "),
            quoted.join(" ")
        ))
    } else {
        Some(quoted.join(" AND "))
    }
}

fn db_search_local(
    pool: &crate::db::DbPool,
    fts_query: &str,
    limit: i64,
) -> rusqlite::Result<Vec<PaperSearchResult>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let sql = "SELECT p.id, p.title, p.authors, p.abstract, p.doi, p.source, \
                      p.pdf_path, \
                      snippet(papers_fts, 0, '<mark>', '</mark>', '…', 12) AS title_hl, \
                      bm25(papers_fts) AS rank, \
                      (SELECT f.name FROM folders f \
                         JOIN folder_papers fp ON fp.folder_id = f.id \
                        WHERE fp.paper_id = p.id LIMIT 1) AS folder_name \
               FROM papers_fts \
               JOIN papers p ON p.rowid = papers_fts.rowid \
               WHERE papers_fts MATCH ?1 \
                 AND p.deleted_at IS NULL \
               ORDER BY rank \
               LIMIT ?2";
    let mut stmt = conn.prepare(sql)?;
    let rows: Vec<PaperSearchResult> = stmt
        .query_map(params![fts_query, limit], |row| {
            let authors_json: String = row.get(2)?;
            let authors: Vec<String> = serde_json::from_str(&authors_json).unwrap_or_default();
            Ok(PaperSearchResult {
                id: row.get(0)?,
                title: row.get(1)?,
                authors,
                abstract_: row.get(3)?,
                doi: row.get(4)?,
                source: row.get(5)?,
                pdf_path: row.get(6)?,
                title_highlight: row.get(7)?,
                rank: row.get(8)?,
                current_folder_path: row.get::<_, Option<String>>(9)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    Ok(rows)
}

// ============================================================
// Single upload
// ============================================================

#[tauri::command]
pub async fn upload_local_paper(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    file_path: String,
) -> Result<UploadResult, String> {
    let src = PathBuf::from(&file_path);
    let _size = validate_pdf(&src)?;

    let id = uuid::Uuid::now_v7().to_string();
    let dir = uploaded_dir(&app)?;
    let dest = dir.join(format!("{}.pdf", id));
    std::fs::copy(&src, &dest).map_err(|e| format!("复制 PDF 失败: {}", e))?;

    // Stored RELATIVE to <app_data_dir>/data/pdfs/ — matches pdf_extract::resolve.
    let relative = format!("uploaded/{}.pdf", id);

    // Run extraction on the destination copy (still on filesystem).
    let dest_for_extract = dest.clone();
    let partial = tokio::task::spawn_blocking(move || extract_pdf_metadata(&dest_for_extract))
        .await
        .map_err(|e| e.to_string())??;

    let authors_json = serde_json::to_string(&partial.authors).unwrap_or("[]".into());
    let title = partial.title.clone();
    let abstract_ = partial.abstract_.clone();
    let doi = partial.doi.clone();
    let id_for_db = id.clone();
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || {
        db_insert_local_paper(
            &pool,
            &id_for_db,
            &title,
            &authors_json,
            abstract_.as_deref(),
            doi.as_deref(),
            &relative,
        )
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    let needs_user_review = partial.needs_review();
    Ok(UploadResult {
        paper_id: id,
        partial_metadata: partial,
        needs_user_review,
    })
}

// ============================================================
// Batch upload
// ============================================================

#[tauri::command]
pub async fn upload_local_papers_batch(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    file_paths: Vec<String>,
) -> Result<Vec<BatchUploadItem>, String> {
    let total = file_paths.len();
    let mut results = Vec::with_capacity(total);

    for (idx, fp) in file_paths.into_iter().enumerate() {
        let file_name = Path::new(&fp)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        if let Err(e) = app.emit(
            "upload:progress",
            UploadProgressPayload {
                current: idx + 1,
                total,
                current_file: file_name.clone(),
            },
        ) {
            log::warn!("emit upload:progress failed: {}", e);
        }
        match upload_local_paper(app.clone(), state.clone(), fp.clone()).await {
            Ok(r) => results.push(BatchUploadItem {
                file_path: fp,
                success: true,
                paper_id: Some(r.paper_id),
                needs_user_review: r.needs_user_review,
                error: None,
            }),
            Err(e) => results.push(BatchUploadItem {
                file_path: fp,
                success: false,
                paper_id: None,
                needs_user_review: false,
                error: Some(e),
            }),
        }
    }
    Ok(results)
}

// ============================================================
// Manual metadata edit
// ============================================================

#[tauri::command]
pub async fn update_paper_metadata(
    state: tauri::State<'_, AppState>,
    paper_id: String,
    title: String,
    authors: Vec<String>,
    abstract_text: Option<String>,
    doi: Option<String>,
) -> Result<(), String> {
    if title.trim().is_empty() {
        return Err("标题不能为空".into());
    }
    let authors_json = serde_json::to_string(&authors).unwrap_or("[]".into());
    let pool = state.db_pool.clone();
    let n = tokio::task::spawn_blocking(move || {
        db_update_metadata(
            &pool,
            &paper_id,
            &title,
            &authors_json,
            abstract_text.as_deref(),
            doi.as_deref(),
        )
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("文献未找到".into());
    }
    Ok(())
}

// ============================================================
// FTS5 search
// ============================================================

#[tauri::command]
pub async fn search_local_papers(
    state: tauri::State<'_, AppState>,
    keyword: String,
    limit: Option<i64>,
) -> Result<Vec<PaperSearchResult>, String> {
    let trimmed = keyword.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }
    let q = match to_fts_query(trimmed) {
        Some(q) => q,
        None => return Ok(Vec::new()),
    };
    let lim = limit.unwrap_or(50).clamp(1, 500);
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_search_local(&pool, &q, lim))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

/// Re-run extraction on an already-uploaded paper (e.g. when the user
/// suspects the old metadata is wrong). Returns fresh PartialMetadata
/// WITHOUT writing it — frontend confirms via `update_paper_metadata`.
#[tauri::command]
pub async fn re_extract_paper_metadata(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    paper_id: String,
) -> Result<PartialMetadata, String> {
    let pool = state.db_pool.clone();
    let pid = paper_id.clone();
    let paper =
        tokio::task::spawn_blocking(move || crate::library::db_get_paper_by_id(&pool, &pid))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("paper `{}` not found", paper_id))?;
    let rel = paper
        .pdf_path
        .ok_or_else(|| "该文献无本地 PDF,无法重新提取".to_string())?;
    let abs = if Path::new(&rel).is_absolute() {
        PathBuf::from(rel)
    } else {
        crate::config::paths::pdfs_dir(&app).join(rel)
    };
    tokio::task::spawn_blocking(move || extract_pdf_metadata(&abs))
        .await
        .map_err(|e| e.to_string())?
}

// ============================================================
// Delete / storage / orphan cleanup / duplicate detection
// (V2.2.2 — Library local-PDF management)
// ============================================================

/// Resolve a stored `pdf_path` (relative to `<data>/pdfs/`) to an absolute path.
fn resolve_pdf_abs(app: &tauri::AppHandle, rel: &str) -> PathBuf {
    if Path::new(rel).is_absolute() {
        PathBuf::from(rel)
    } else {
        crate::config::paths::pdfs_dir(app).join(rel)
    }
}

/// Stream a file through SHA-256 (8 KiB chunks — never loads the whole PDF).
fn sha256_file(path: &Path) -> std::io::Result<String> {
    use std::io::Read;
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 8192];
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn db_get_paper_source_and_path(
    pool: &crate::db::DbPool,
    paper_id: &str,
) -> rusqlite::Result<Option<(String, Option<String>)>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.query_row(
        "SELECT source, pdf_path FROM papers WHERE id = ?1",
        [paper_id],
        |r| Ok((r.get::<_, String>(0)?, r.get::<_, Option<String>>(1)?)),
    )
    .optional()
}

/// Hard-delete a paper. FK CASCADE drops folder_papers / tag_papers /
/// ai_parse_results rows; chat_attachments.paper_id is set NULL by its
/// ON DELETE SET NULL constraint; the `papers_ad` trigger removes the FTS
/// row. `PRAGMA foreign_keys = ON` is set on every pooled connection
/// (see db::init_at), so the cascade fires here too.
fn db_delete_paper(pool: &crate::db::DbPool, paper_id: &str) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute("DELETE FROM papers WHERE id = ?1", [paper_id])
}

/// (id, title, pdf_path) for every live local paper that has a stored PDF.
fn db_list_local_pdf_papers(
    pool: &crate::db::DbPool,
) -> rusqlite::Result<Vec<(String, String, String)>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let mut stmt = conn.prepare(
        "SELECT id, title, pdf_path FROM papers \
         WHERE source = 'local' AND pdf_path IS NOT NULL AND deleted_at IS NULL",
    )?;
    let rows = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
            ))
        })?
        .collect::<rusqlite::Result<_>>()?;
    Ok(rows)
}

/// Basenames of every PDF still referenced by ANY paper row (including
/// soft-deleted ones — conservative, so we never delete a file a row still
/// points at). Used to detect orphan files in the `uploaded/` directory.
fn db_referenced_pdf_basenames(pool: &crate::db::DbPool) -> rusqlite::Result<HashSet<String>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let mut stmt = conn.prepare("SELECT pdf_path FROM papers WHERE pdf_path IS NOT NULL")?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
    let mut set = HashSet::new();
    for r in rows {
        let p = r?;
        if let Some(name) = Path::new(&p).file_name().and_then(|n| n.to_str()) {
            set.insert(name.to_string());
        }
    }
    Ok(set)
}

/// Sum file count + bytes of regular files directly under `dir`. Missing
/// directory → zeros (the store is created lazily on first upload).
fn dir_usage(dir: &Path) -> StorageUsage {
    let mut file_count = 0usize;
    let mut total_bytes = 0u64;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for e in entries.flatten() {
            if let Ok(meta) = e.metadata() {
                if meta.is_file() {
                    file_count += 1;
                    total_bytes += meta.len();
                }
            }
        }
    }
    StorageUsage {
        file_count,
        total_bytes,
    }
}

/// Delete every regular file in `dir` whose basename is NOT in `referenced`.
fn cleanup_orphans_in(dir: &Path, referenced: &HashSet<String>) -> OrphanCleanupResult {
    let mut removed_count = 0usize;
    let mut freed_bytes = 0u64;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for e in entries.flatten() {
            let path = e.path();
            if !path.is_file() {
                continue;
            }
            let name = match path.file_name().and_then(|n| n.to_str()) {
                Some(n) => n.to_string(),
                None => continue,
            };
            if referenced.contains(&name) {
                continue;
            }
            let size = e.metadata().map(|m| m.len()).unwrap_or(0);
            if std::fs::remove_file(&path).is_ok() {
                removed_count += 1;
                freed_bytes += size;
            }
        }
    }
    OrphanCleanupResult {
        removed_count,
        freed_bytes,
    }
}

/// Match candidate files against already-imported PDFs by content hash.
/// Optimization: only hash files whose on-disk size matches a candidate's,
/// and cache existing-file hashes so duplicate candidates don't re-hash.
fn detect_duplicates(
    candidates: &[String],
    existing: &[(String, String, String)], // (id, title, rel_path)
    pdfs_dir: &Path,
) -> Vec<DuplicateInfo> {
    // Bucket existing files by size so we only hash plausible collisions.
    let mut by_size: HashMap<u64, Vec<(&str, &str, PathBuf)>> = HashMap::new();
    for (id, title, rel) in existing {
        let abs = if Path::new(rel).is_absolute() {
            PathBuf::from(rel)
        } else {
            pdfs_dir.join(rel)
        };
        if let Ok(meta) = std::fs::metadata(&abs) {
            by_size
                .entry(meta.len())
                .or_default()
                .push((id.as_str(), title.as_str(), abs));
        }
    }

    let mut hash_cache: HashMap<PathBuf, String> = HashMap::new();
    let mut out = Vec::new();
    for cand in candidates {
        let cand_path = Path::new(cand);
        let size = match std::fs::metadata(cand_path) {
            Ok(m) => m.len(),
            Err(_) => continue,
        };
        let bucket = match by_size.get(&size) {
            Some(b) => b,
            None => continue,
        };
        let cand_hash = match sha256_file(cand_path) {
            Ok(h) => h,
            Err(_) => continue,
        };
        for (id, title, abs) in bucket {
            let existing_hash = match hash_cache.get(abs) {
                Some(h) => h.clone(),
                None => match sha256_file(abs) {
                    Ok(h) => {
                        hash_cache.insert(abs.clone(), h.clone());
                        h
                    }
                    Err(_) => continue,
                },
            };
            if existing_hash == cand_hash {
                out.push(DuplicateInfo {
                    file_path: cand.clone(),
                    existing_paper_id: id.to_string(),
                    existing_title: title.to_string(),
                });
                break; // one match per candidate is enough
            }
        }
    }
    out
}

/// Delete a paper (DB row). When `delete_file` is true AND the paper is a
/// local upload we own, the copied PDF under `uploaded/` is removed too.
#[tauri::command]
pub async fn delete_paper(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    paper_id: String,
    delete_file: bool,
) -> Result<(), String> {
    // Read source + path BEFORE the row vanishes (so we can delete the file).
    let pool = state.db_pool.clone();
    let pid = paper_id.clone();
    let info = tokio::task::spawn_blocking(move || db_get_paper_source_and_path(&pool, &pid))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "文献未找到".to_string())?;

    let pool = state.db_pool.clone();
    let pid = paper_id.clone();
    let n = tokio::task::spawn_blocking(move || db_delete_paper(&pool, &pid))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("文献未找到".into());
    }

    if delete_file {
        let (source, pdf_path) = info;
        if source == "local" {
            if let Some(rel) = pdf_path {
                let abs = resolve_pdf_abs(&app, &rel);
                if let Err(e) = std::fs::remove_file(&abs) {
                    // Non-fatal: the row is already gone — just log.
                    log::warn!("delete_paper: remove file {} failed: {}", abs.display(), e);
                }
            }
        }
    }
    Ok(())
}

/// Delete many papers. Returns the count successfully removed. Per-item
/// failures are logged and skipped so one bad row doesn't abort the batch.
#[tauri::command]
pub async fn delete_papers_batch(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    paper_ids: Vec<String>,
    delete_files: bool,
) -> Result<usize, String> {
    let mut deleted = 0usize;
    for pid in paper_ids {
        match delete_paper(app.clone(), state.clone(), pid, delete_files).await {
            Ok(()) => deleted += 1,
            Err(e) => log::warn!("delete_papers_batch: {}", e),
        }
    }
    Ok(deleted)
}

/// Total disk usage of the uploaded-PDF store.
#[tauri::command]
pub async fn get_uploaded_pdfs_size(app: tauri::AppHandle) -> Result<StorageUsage, String> {
    let dir = crate::config::paths::uploaded_pdfs_dir(&app);
    tokio::task::spawn_blocking(move || dir_usage(&dir))
        .await
        .map_err(|e| e.to_string())
}

/// Remove uploaded PDFs not referenced by any paper row (e.g. left behind
/// when a row was deleted without its file, or after a failed import).
#[tauri::command]
pub async fn cleanup_orphan_pdfs(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<OrphanCleanupResult, String> {
    let pool = state.db_pool.clone();
    let referenced = tokio::task::spawn_blocking(move || db_referenced_pdf_basenames(&pool))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    let dir = crate::config::paths::uploaded_pdfs_dir(&app);
    tokio::task::spawn_blocking(move || cleanup_orphans_in(&dir, &referenced))
        .await
        .map_err(|e| e.to_string())
}

/// Check a list of candidate files against existing local PDFs by content
/// hash. Returns one entry per candidate that duplicates an imported paper.
#[tauri::command]
pub async fn check_duplicate_pdfs(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    file_paths: Vec<String>,
) -> Result<Vec<DuplicateInfo>, String> {
    let pool = state.db_pool.clone();
    let existing = tokio::task::spawn_blocking(move || db_list_local_pdf_papers(&pool))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    let pdfs_dir = crate::config::paths::pdfs_dir(&app);
    tokio::task::spawn_blocking(move || detect_duplicates(&file_paths, &existing, &pdfs_dir))
        .await
        .map_err(|e| e.to_string())
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_at;
    use tempfile::TempDir;

    fn insert_paper(
        pool: &crate::db::DbPool,
        id: &str,
        title: &str,
        authors_json: &str,
        abstract_: Option<&str>,
        source: &str,
    ) {
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO papers (id, title, authors, abstract, source, read_status) \
             VALUES (?1, ?2, ?3, ?4, ?5, 'unread')",
            params![id, title, authors_json, abstract_, source],
        )
        .unwrap();
    }

    #[test]
    fn to_fts_query_single_token() {
        assert_eq!(to_fts_query("transformer").unwrap(), "\"transformer\"");
    }

    #[test]
    fn to_fts_query_multi_token_uses_near_and_and() {
        let q = to_fts_query("attention transformer").unwrap();
        assert!(q.contains("\"attention\" AND \"transformer\""));
        assert!(q.contains("NEAR("));
    }

    #[test]
    fn to_fts_query_empty_returns_none() {
        assert!(to_fts_query("   ").is_none());
        assert!(to_fts_query("").is_none());
    }

    #[test]
    fn to_fts_query_strips_punctuation_tokens() {
        // pure punctuation tokens should drop out entirely
        let q = to_fts_query("!! transformer ??").unwrap();
        assert_eq!(q, "\"transformer\"");
    }

    #[test]
    fn fts_search_finds_match_by_title() {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();
        insert_paper(
            &pool,
            "p1",
            "Attention Is All You Need",
            "[\"Vaswani\"]",
            Some("Transformer architecture"),
            "local",
        );
        insert_paper(
            &pool,
            "p2",
            "Unrelated Bio Paper",
            "[\"Curie\"]",
            None,
            "arxiv",
        );

        let q = to_fts_query("attention transformer").unwrap();
        let results = db_search_local(&pool, &q, 10).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "p1");
        assert!(results[0].title_highlight.contains("<mark>"));
    }

    #[test]
    fn fts_search_respects_limit() {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();
        for i in 0..5 {
            insert_paper(
                &pool,
                &format!("p{}", i),
                "Quantum entanglement experimental verification",
                "[]",
                None,
                "local",
            );
        }
        let q = to_fts_query("quantum").unwrap();
        let results = db_search_local(&pool, &q, 3).unwrap();
        assert_eq!(results.len(), 3);
    }

    #[test]
    fn fts_search_excludes_soft_deleted() {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();
        insert_paper(&pool, "p1", "Special Marker Title", "[]", None, "local");
        // Soft delete via raw SQL
        pool.get()
            .unwrap()
            .execute(
                "UPDATE papers SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id='p1'",
                [],
            )
            .unwrap();
        let q = to_fts_query("special marker").unwrap();
        let results = db_search_local(&pool, &q, 10).unwrap();
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn update_metadata_keeps_fts_in_sync() {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();
        insert_paper(&pool, "p1", "Old Title", "[]", None, "local");

        // Before rename — search for "old" hits
        let q_old = to_fts_query("Old Title").unwrap();
        assert_eq!(db_search_local(&pool, &q_old, 10).unwrap().len(), 1);

        // Update — the AFTER UPDATE trigger should rewrite FTS rows
        db_update_metadata(&pool, "p1", "Brand New Heading", "[\"X\"]", None, None).unwrap();

        let q_new = to_fts_query("Brand New").unwrap();
        let r_new = db_search_local(&pool, &q_new, 10).unwrap();
        assert_eq!(r_new.len(), 1);
        assert_eq!(r_new[0].title, "Brand New Heading");

        // Old query should now find nothing.
        assert_eq!(db_search_local(&pool, &q_old, 10).unwrap().len(), 0);
    }

    #[test]
    fn validate_pdf_rejects_wrong_extension() {
        let tmp = TempDir::new().unwrap();
        let f = tmp.path().join("note.txt");
        std::fs::write(&f, b"hi").unwrap();
        let r = validate_pdf(&f);
        assert!(r.is_err());
        assert!(r.unwrap_err().contains(".pdf"));
    }

    #[test]
    fn validate_pdf_rejects_missing_file() {
        let r = validate_pdf(Path::new("/definitely/nope.pdf"));
        assert!(r.is_err());
    }

    #[test]
    fn delete_paper_removes_row_and_fts() {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();
        insert_paper(&pool, "p1", "Deletable Marker Paper", "[]", None, "local");

        let q = to_fts_query("deletable marker").unwrap();
        assert_eq!(db_search_local(&pool, &q, 10).unwrap().len(), 1);

        assert_eq!(db_delete_paper(&pool, "p1").unwrap(), 1);

        // Gone from both papers and the FTS index (papers_ad trigger).
        assert_eq!(db_search_local(&pool, &q, 10).unwrap().len(), 0);
        let conn = pool.get().unwrap();
        let cnt: i64 = conn
            .query_row("SELECT COUNT(*) FROM papers WHERE id = 'p1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(cnt, 0);
    }

    #[test]
    fn delete_paper_cascades_folder_membership() {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();
        insert_paper(&pool, "p1", "X", "[]", None, "local");
        {
            let conn = pool.get().unwrap();
            conn.execute(
                "INSERT INTO folder_papers (folder_id, paper_id) \
                 VALUES ('00000000-0000-0000-0000-000000000001', 'p1')",
                [],
            )
            .unwrap();
        }
        db_delete_paper(&pool, "p1").unwrap();
        let conn = pool.get().unwrap();
        let cnt: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM folder_papers WHERE paper_id = 'p1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(cnt, 0, "FK CASCADE should drop folder membership");
    }

    #[test]
    fn detect_duplicates_matches_identical_content() {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();

        let uploaded = tmp.path().join("pdfs").join("uploaded");
        std::fs::create_dir_all(&uploaded).unwrap();
        std::fs::write(uploaded.join("aaa.pdf"), b"%PDF-1.4 identical bytes").unwrap();
        {
            let conn = pool.get().unwrap();
            conn.execute(
                "INSERT INTO papers (id, title, authors, source, read_status, pdf_path) \
                 VALUES ('p1', 'Existing Paper', '[]', 'local', 'unread', 'uploaded/aaa.pdf')",
                [],
            )
            .unwrap();
        }

        let cand_dup = tmp.path().join("incoming_copy.pdf");
        std::fs::write(&cand_dup, b"%PDF-1.4 identical bytes").unwrap();
        let cand_diff = tmp.path().join("different.pdf");
        std::fs::write(&cand_diff, b"%PDF-1.4 totally different content here").unwrap();

        let existing = db_list_local_pdf_papers(&pool).unwrap();
        let dups = detect_duplicates(
            &[
                cand_dup.to_string_lossy().into_owned(),
                cand_diff.to_string_lossy().into_owned(),
            ],
            &existing,
            &tmp.path().join("pdfs"),
        );
        assert_eq!(dups.len(), 1);
        assert_eq!(dups[0].existing_paper_id, "p1");
        assert_eq!(dups[0].file_path, cand_dup.to_string_lossy());
    }

    #[test]
    fn cleanup_orphans_removes_unreferenced_only() {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();

        let uploaded = tmp.path().join("pdfs").join("uploaded");
        std::fs::create_dir_all(&uploaded).unwrap();
        let keep = uploaded.join("keep.pdf");
        let orphan = uploaded.join("orphan.pdf");
        std::fs::write(&keep, b"keep").unwrap();
        std::fs::write(&orphan, b"orphan bytes").unwrap();
        {
            let conn = pool.get().unwrap();
            conn.execute(
                "INSERT INTO papers (id, title, authors, source, read_status, pdf_path) \
                 VALUES ('p1', 'Kept', '[]', 'local', 'unread', 'uploaded/keep.pdf')",
                [],
            )
            .unwrap();
        }

        let referenced = db_referenced_pdf_basenames(&pool).unwrap();
        let res = cleanup_orphans_in(&uploaded, &referenced);
        assert_eq!(res.removed_count, 1);
        assert!(keep.exists());
        assert!(!orphan.exists());
    }

    #[test]
    fn dir_usage_counts_files() {
        let tmp = TempDir::new().unwrap();
        let dir = tmp.path().join("uploaded");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("a.pdf"), b"12345").unwrap();
        std::fs::write(dir.join("b.pdf"), b"678").unwrap();
        let u = dir_usage(&dir);
        assert_eq!(u.file_count, 2);
        assert_eq!(u.total_bytes, 8);
        // Missing directory → zeros.
        let z = dir_usage(&tmp.path().join("nope"));
        assert_eq!(z.file_count, 0);
        assert_eq!(z.total_bytes, 0);
    }
}
