//! Chat attachment handling — upload local files OR reference an existing paper.
//!
//! v1 supported formats:
//! - .pdf  → pdf_extract::extract_text
//! - .md/.txt → fs::read_to_string
//! - .docx → not yet (returns clear error; suggest converting to PDF)
//! - .png/.jpg → stored, extracted_text=None (for future vision support)

use std::path::PathBuf;

use rusqlite::{params, Row};
use serde::{Deserialize, Serialize};

use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatAttachment {
    pub id: String,
    pub session_id: String,
    pub message_id: Option<String>,
    /// "pdf" | "docx" | "md" | "txt" | "image" | "paper_ref" | "url"
    #[serde(rename = "type")]
    pub kind: String,
    pub file_name: String,
    pub file_path: Option<String>,
    pub file_size: Option<i64>,
    pub extracted_text: Option<String>,
    pub paper_id: Option<String>,
    pub created_at: String,
}

fn now_iso() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

fn row_to_attachment(row: &Row) -> rusqlite::Result<ChatAttachment> {
    Ok(ChatAttachment {
        id: row.get(0)?,
        session_id: row.get(1)?,
        message_id: row.get(2)?,
        kind: row.get(3)?,
        file_name: row.get(4)?,
        file_path: row.get(5)?,
        file_size: row.get(6)?,
        extracted_text: row.get(7)?,
        paper_id: row.get(8)?,
        created_at: row.get(9)?,
    })
}

const ATT_COLS: &str =
    "id, session_id, message_id, type, file_name, file_path, file_size, extracted_text, paper_id, created_at";

pub(crate) fn db_insert_attachment(
    pool: &crate::db::DbPool,
    att: &ChatAttachment,
) -> rusqlite::Result<()> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        &format!("INSERT INTO chat_attachments ({}) \
                  VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)", ATT_COLS),
        params![
            att.id,
            att.session_id,
            att.message_id,
            att.kind,
            att.file_name,
            att.file_path,
            att.file_size,
            att.extracted_text,
            att.paper_id,
            att.created_at,
        ],
    )?;
    Ok(())
}

pub(crate) fn db_get_attachments(
    pool: &crate::db::DbPool,
    ids: &[String],
) -> rusqlite::Result<Vec<ChatAttachment>> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let placeholders: Vec<&str> = (0..ids.len()).map(|_| "?").collect();
    let sql = format!(
        "SELECT {} FROM chat_attachments WHERE id IN ({}) ORDER BY created_at ASC",
        ATT_COLS,
        placeholders.join(",")
    );
    let mut stmt = conn.prepare(&sql)?;
    let params: Vec<&dyn rusqlite::ToSql> =
        ids.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
    let rows: Vec<ChatAttachment> = stmt
        .query_map(rusqlite::params_from_iter(params.iter()), row_to_attachment)?
        .collect::<rusqlite::Result<_>>()?;
    Ok(rows)
}

// ============================================================
// File extraction by extension
// ============================================================

fn classify_extension(ext: &str) -> (&'static str, bool) {
    // (kind, can_extract_text)
    match ext.to_lowercase().as_str() {
        "pdf" => ("pdf", true),
        "md" | "markdown" => ("md", true),
        "txt" => ("txt", true),
        "docx" => ("docx", false), // v1 not supported
        "png" | "jpg" | "jpeg" | "gif" | "webp" => ("image", false),
        _ => ("file", false),
    }
}

fn extract_text(path: &std::path::Path, kind: &str) -> Result<Option<String>, String> {
    match kind {
        "pdf" => crate::pdf_extract::extract_text(path)
            .map(Some)
            .map_err(|e| e.to_string()),
        "md" | "txt" => std::fs::read_to_string(path)
            .map(Some)
            .map_err(|e| e.to_string()),
        "docx" => Err("v1 暂不支持 .docx — 请先在 Word 中另存为 PDF 再上传".into()),
        _ => Ok(None),
    }
}

// ============================================================
// Tauri commands
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadAttachmentInput {
    pub session_id: String,
    /// Absolute path from the Tauri native file dialog
    pub file_path: String,
}

#[tauri::command]
pub async fn upload_chat_attachment(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    input: UploadAttachmentInput,
) -> Result<ChatAttachment, String> {
    use tauri::Manager;

    let UploadAttachmentInput {
        session_id,
        file_path,
    } = input;

    let src_path = std::path::Path::new(&file_path);
    let file_name = src_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file")
        .to_string();
    let ext = src_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_string();
    let (kind, _) = classify_extension(&ext);

    // Read the source file
    let content = std::fs::read(src_path)
        .map_err(|e| format!("读取文件失败 {}: {}", src_path.display(), e))?;

    // Copy to our managed location:
    // {app_data_dir}/data/chat_attachments/{session_id}/{uuid}.{ext}
    let id = uuid::Uuid::now_v7().to_string();
    let dir: PathBuf = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("data")
        .join("chat_attachments")
        .join(&session_id);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let safe_ext = if ext.is_empty() {
        "bin".into()
    } else {
        ext.clone()
    };
    let dest = dir.join(format!("{}.{}", id, safe_ext));
    let file_size = content.len() as i64;
    std::fs::write(&dest, &content).map_err(|e| e.to_string())?;

    // Extract text (best-effort — .docx and unsupported return None gracefully)
    let extracted = match extract_text(&dest, kind) {
        Ok(opt) => opt,
        Err(msg) if kind == "docx" => {
            // Hard error for docx — surface to user
            return Err(msg);
        }
        Err(e) => {
            log::warn!(
                "extract_text({}) failed: {} — storing without text",
                dest.display(),
                e
            );
            None
        }
    };

    let att = ChatAttachment {
        id,
        session_id,
        message_id: None,
        kind: kind.into(),
        file_name,
        file_path: Some(dest.to_string_lossy().into_owned()),
        file_size: Some(file_size),
        extracted_text: extracted,
        paper_id: None,
        created_at: now_iso(),
    };
    let pool = state.db_pool.clone();
    let att_for_insert = att.clone();
    tokio::task::spawn_blocking(move || db_insert_attachment(&pool, &att_for_insert))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    Ok(att)
}

#[tauri::command]
pub async fn reference_paper_as_attachment(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    session_id: String,
    paper_id: String,
) -> Result<ChatAttachment, String> {
    let pool = state.db_pool.clone();
    let pid = paper_id.clone();
    let paper = tokio::task::spawn_blocking(move || crate::library::db_get_paper_by_id(&pool, &pid))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("paper `{}` not found", paper_id))?;

    // Best-effort full-text extraction from local PDF; else fall back to abstract
    let extracted = match &paper.pdf_path {
        Some(p) => crate::pdf_extract::extract_paper_text(&app, p)
            .ok()
            .or_else(|| paper.abstract_.clone()),
        None => paper.abstract_.clone(),
    };
    let preview = extracted.as_deref().unwrap_or("");
    let composed = format!(
        "[收藏文献引用]\n\n标题: {}\n作者: {}\n来源: {}\n\n{}",
        paper.title,
        paper.authors.join(", "),
        paper.source,
        preview
    );

    let att = ChatAttachment {
        id: uuid::Uuid::now_v7().to_string(),
        session_id: session_id.clone(),
        message_id: None,
        kind: "paper_ref".into(),
        file_name: format!("{}.paper", paper.title.chars().take(50).collect::<String>()),
        file_path: None,
        file_size: None,
        extracted_text: Some(composed),
        paper_id: Some(paper.id.clone()),
        created_at: now_iso(),
    };
    let pool = state.db_pool.clone();
    let att_for_insert = att.clone();
    tokio::task::spawn_blocking(move || db_insert_attachment(&pool, &att_for_insert))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    Ok(att)
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::chat::session::db_create_session;
    use crate::db::init_at;
    use tempfile::TempDir;

    #[test]
    fn insert_and_get_attachment() {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();
        let s = db_create_session(&pool, "T", None, None, None).unwrap();
        let att = ChatAttachment {
            id: "a1".into(),
            session_id: s.id.clone(),
            message_id: None,
            kind: "md".into(),
            file_name: "notes.md".into(),
            file_path: Some("/tmp/notes.md".into()),
            file_size: Some(123),
            extracted_text: Some("# Hello".into()),
            paper_id: None,
            created_at: now_iso(),
        };
        db_insert_attachment(&pool, &att).unwrap();
        let got = db_get_attachments(&pool, &["a1".into()]).unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].file_name, "notes.md");
        assert_eq!(got[0].extracted_text.as_deref(), Some("# Hello"));
    }

    #[test]
    fn classify_extension_examples() {
        assert_eq!(classify_extension("pdf").0, "pdf");
        assert_eq!(classify_extension("MD").0, "md");
        assert_eq!(classify_extension("txt").0, "txt");
        assert_eq!(classify_extension("docx").0, "docx");
        assert_eq!(classify_extension("PNG").0, "image");
        assert_eq!(classify_extension("xyz").0, "file");
    }
}
