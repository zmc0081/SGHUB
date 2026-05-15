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

use std::path::{Path, PathBuf};

use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};

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
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("data")
        .join("pdfs")
        .join("uploaded");
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
    let relative = format!(
        "uploaded/{}.pdf",
        id
    );

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
    let paper = tokio::task::spawn_blocking(move || {
        crate::library::db_get_paper_by_id(&pool, &pid)
    })
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
        app.path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("data")
            .join("pdfs")
            .join(rel)
    };
    tokio::task::spawn_blocking(move || extract_pdf_metadata(&abs))
        .await
        .map_err(|e| e.to_string())?
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
}
