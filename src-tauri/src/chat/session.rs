//! Chat session CRUD.

use rusqlite::{params, OptionalExtension, Row};
use serde::{Deserialize, Serialize};

use crate::AppState;

use super::message::{db_list_messages, ChatMessage};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSession {
    pub id: String,
    pub title: String,
    pub model_config_id: Option<String>,
    pub system_prompt: Option<String>,
    pub skill_name: Option<String>,
    pub pinned: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSessionSummary {
    pub id: String,
    pub title: String,
    pub last_message_preview: Option<String>,
    pub message_count: i64,
    pub pinned: bool,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSessionDetail {
    #[serde(flatten)]
    pub session: ChatSession,
    pub messages: Vec<ChatMessage>,
}

const SESSION_COLS: &str =
    "id, title, model_config_id, system_prompt, skill_name, pinned, created_at, updated_at";

pub(crate) fn row_to_session(row: &Row) -> rusqlite::Result<ChatSession> {
    Ok(ChatSession {
        id: row.get(0)?,
        title: row.get(1)?,
        model_config_id: row.get(2)?,
        system_prompt: row.get(3)?,
        skill_name: row.get(4)?,
        pinned: row.get::<_, i64>(5)? == 1,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

fn now_iso() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

// ============================================================
// DB helpers (sync — call via spawn_blocking)
// ============================================================

pub(crate) fn db_create_session(
    pool: &crate::db::DbPool,
    title: &str,
    model_config_id: Option<&str>,
    skill_name: Option<&str>,
    system_prompt: Option<&str>,
) -> rusqlite::Result<ChatSession> {
    let id = uuid::Uuid::now_v7().to_string();
    let now = now_iso();
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "INSERT INTO chat_sessions \
         (id, title, model_config_id, system_prompt, skill_name, pinned, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?6)",
        params![
            id,
            title,
            model_config_id,
            system_prompt,
            skill_name,
            now
        ],
    )?;
    Ok(ChatSession {
        id,
        title: title.into(),
        model_config_id: model_config_id.map(String::from),
        system_prompt: system_prompt.map(String::from),
        skill_name: skill_name.map(String::from),
        pinned: false,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub(crate) fn db_get_session(
    pool: &crate::db::DbPool,
    id: &str,
) -> rusqlite::Result<Option<ChatSession>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.query_row(
        &format!(
            "SELECT {} FROM chat_sessions WHERE id = ?1 AND deleted_at IS NULL",
            SESSION_COLS
        ),
        [id],
        row_to_session,
    )
    .optional()
}

pub(crate) fn db_list_sessions(
    pool: &crate::db::DbPool,
    limit: i64,
) -> rusqlite::Result<Vec<ChatSessionSummary>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let mut stmt = conn.prepare(
        "SELECT s.id, s.title, s.pinned, s.updated_at, \
                (SELECT COUNT(*) FROM chat_messages m WHERE m.session_id = s.id) AS message_count, \
                (SELECT content FROM chat_messages m2 \
                   WHERE m2.session_id = s.id ORDER BY m2.created_at DESC LIMIT 1) AS last_preview \
         FROM chat_sessions s \
         WHERE s.deleted_at IS NULL \
         ORDER BY s.pinned DESC, s.updated_at DESC \
         LIMIT ?1",
    )?;
    let rows: Vec<ChatSessionSummary> = stmt
        .query_map([limit], |row| {
            let preview: Option<String> = row.get(5)?;
            Ok(ChatSessionSummary {
                id: row.get(0)?,
                title: row.get(1)?,
                last_message_preview: preview.map(|s| {
                    let trimmed: String = s.chars().take(80).collect();
                    if s.chars().count() > 80 {
                        format!("{}…", trimmed)
                    } else {
                        trimmed
                    }
                }),
                message_count: row.get(4)?,
                pinned: row.get::<_, i64>(2)? == 1,
                updated_at: row.get(3)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    Ok(rows)
}

pub(crate) fn db_delete_session(
    pool: &crate::db::DbPool,
    id: &str,
) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    // Hard delete — CASCADE handles messages/attachments via FK
    conn.execute("DELETE FROM chat_sessions WHERE id = ?1", [id])
}

pub(crate) fn db_rename_session(
    pool: &crate::db::DbPool,
    id: &str,
    title: &str,
) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "UPDATE chat_sessions SET title = ?1, updated_at = ?2 WHERE id = ?3",
        params![title, now_iso(), id],
    )
}

pub(crate) fn db_pin_session(
    pool: &crate::db::DbPool,
    id: &str,
    pinned: bool,
) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "UPDATE chat_sessions SET pinned = ?1, updated_at = ?2 WHERE id = ?3",
        params![pinned as i64, now_iso(), id],
    )
}

pub(crate) fn db_touch_session(
    pool: &crate::db::DbPool,
    id: &str,
) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "UPDATE chat_sessions SET updated_at = ?1 WHERE id = ?2",
        params![now_iso(), id],
    )
}

pub(crate) fn db_set_session_model(
    pool: &crate::db::DbPool,
    id: &str,
    model_config_id: Option<&str>,
) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "UPDATE chat_sessions SET model_config_id = ?1, updated_at = ?2 WHERE id = ?3",
        params![model_config_id, now_iso(), id],
    )
}

// ============================================================
// Tauri commands
// ============================================================

#[tauri::command]
pub async fn create_chat_session(
    state: tauri::State<'_, AppState>,
    title: Option<String>,
    model_config_id: Option<String>,
) -> Result<ChatSession, String> {
    let pool = state.db_pool.clone();
    let t = title.unwrap_or_else(|| "新对话".into());
    let mid = model_config_id.clone();
    tokio::task::spawn_blocking(move || {
        db_create_session(&pool, &t, mid.as_deref(), None, None)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_chat_sessions(
    state: tauri::State<'_, AppState>,
    limit: Option<i64>,
) -> Result<Vec<ChatSessionSummary>, String> {
    let pool = state.db_pool.clone();
    let l = limit.unwrap_or(100);
    tokio::task::spawn_blocking(move || db_list_sessions(&pool, l))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_chat_session(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_delete_session(&pool, &id))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn rename_chat_session(
    state: tauri::State<'_, AppState>,
    id: String,
    title: String,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    let n = tokio::task::spawn_blocking(move || db_rename_session(&pool, &id, &title))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("session not found".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn pin_chat_session(
    state: tauri::State<'_, AppState>,
    id: String,
    pinned: bool,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_pin_session(&pool, &id, pinned))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_session_detail(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<ChatSessionDetail>, String> {
    let pool = state.db_pool.clone();
    let id_for_session = id.clone();
    let session_opt = tokio::task::spawn_blocking(move || db_get_session(&pool, &id_for_session))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    let session = match session_opt {
        Some(s) => s,
        None => return Ok(None),
    };
    let pool = state.db_pool.clone();
    let id_for_msgs = id.clone();
    let messages = tokio::task::spawn_blocking(move || db_list_messages(&pool, &id_for_msgs, 500, None))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    Ok(Some(ChatSessionDetail { session, messages }))
}

#[tauri::command]
pub async fn set_chat_session_model(
    state: tauri::State<'_, AppState>,
    id: String,
    model_config_id: Option<String>,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    let mid = model_config_id.clone();
    tokio::task::spawn_blocking(move || db_set_session_model(&pool, &id, mid.as_deref()))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_at;
    use tempfile::TempDir;

    fn fresh() -> (TempDir, crate::db::DbPool) {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();
        (tmp, pool)
    }

    #[test]
    fn create_then_get_returns_session() {
        let (_t, pool) = fresh();
        let s = db_create_session(&pool, "Test", None, None, None).unwrap();
        let got = db_get_session(&pool, &s.id).unwrap().unwrap();
        assert_eq!(got.id, s.id);
        assert_eq!(got.title, "Test");
        assert!(!got.pinned);
    }

    #[test]
    fn rename_and_pin_persist() {
        let (_t, pool) = fresh();
        let s = db_create_session(&pool, "A", None, None, None).unwrap();
        db_rename_session(&pool, &s.id, "B").unwrap();
        db_pin_session(&pool, &s.id, true).unwrap();
        let got = db_get_session(&pool, &s.id).unwrap().unwrap();
        assert_eq!(got.title, "B");
        assert!(got.pinned);
    }

    #[test]
    fn list_sorts_pinned_first_then_recent() {
        let (_t, pool) = fresh();
        let a = db_create_session(&pool, "A", None, None, None).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        let b = db_create_session(&pool, "B", None, None, None).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        let c = db_create_session(&pool, "C", None, None, None).unwrap();
        // Pin A, so order should be A (pinned), then C, B by updated_at desc
        db_pin_session(&pool, &a.id, true).unwrap();
        let all = db_list_sessions(&pool, 10).unwrap();
        assert_eq!(all.len(), 3);
        assert_eq!(all[0].id, a.id, "pinned first");
        // remaining two: C newer than B
        assert_eq!(all[1].id, c.id);
        assert_eq!(all[2].id, b.id);
    }

    #[test]
    fn delete_removes_session() {
        let (_t, pool) = fresh();
        let s = db_create_session(&pool, "X", None, None, None).unwrap();
        assert_eq!(db_delete_session(&pool, &s.id).unwrap(), 1);
        assert!(db_get_session(&pool, &s.id).unwrap().is_none());
    }
}
