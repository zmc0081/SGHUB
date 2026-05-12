//! Chat message persistence.

use rusqlite::{params, OptionalExtension, Row};
use serde::{Deserialize, Serialize};

use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub session_id: String,
    /// "user" | "assistant" | "system"
    pub role: String,
    pub content: String,
    /// JSON array of attachment IDs (or null)
    pub attachments_json: Option<String>,
    pub tokens_in: i64,
    pub tokens_out: i64,
    pub model_name: Option<String>,
    pub created_at: String,
    /// Hydrated from `attachments_json` — empty when no attachments.
    /// Populated by `db_list_messages` for display in the chat UI.
    #[serde(default)]
    pub attachments: Vec<super::attachment::ChatAttachment>,
}

fn now_iso() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

fn row_to_message(row: &Row) -> rusqlite::Result<ChatMessage> {
    Ok(ChatMessage {
        id: row.get(0)?,
        session_id: row.get(1)?,
        role: row.get(2)?,
        content: row.get(3)?,
        attachments_json: row.get(4)?,
        tokens_in: row.get(5)?,
        tokens_out: row.get(6)?,
        model_name: row.get(7)?,
        created_at: row.get(8)?,
        attachments: Vec::new(), // hydrated below in db_list_messages
    })
}

fn hydrate_attachments(
    pool: &crate::db::DbPool,
    messages: &mut [ChatMessage],
) -> rusqlite::Result<()> {
    use super::attachment::db_get_attachments;
    for m in messages.iter_mut() {
        let Some(json) = &m.attachments_json else {
            continue;
        };
        let ids: Vec<String> = serde_json::from_str(json).unwrap_or_default();
        if ids.is_empty() {
            continue;
        }
        m.attachments = db_get_attachments(pool, &ids)?;
    }
    Ok(())
}

const MSG_COLS: &str =
    "id, session_id, role, content, attachments_json, tokens_in, tokens_out, model_name, created_at";

// ============================================================
// DB helpers
// ============================================================

#[allow(clippy::too_many_arguments)]
pub(crate) fn db_append_message(
    pool: &crate::db::DbPool,
    session_id: &str,
    role: &str,
    content: &str,
    attachments_json: Option<&str>,
    tokens_in: i64,
    tokens_out: i64,
    model_name: Option<&str>,
) -> rusqlite::Result<ChatMessage> {
    let id = uuid::Uuid::now_v7().to_string();
    let now = now_iso();
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "INSERT INTO chat_messages \
         (id, session_id, role, content, attachments_json, tokens_in, tokens_out, model_name, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            id,
            session_id,
            role,
            content,
            attachments_json,
            tokens_in,
            tokens_out,
            model_name,
            now
        ],
    )?;
    Ok(ChatMessage {
        id,
        session_id: session_id.into(),
        role: role.into(),
        content: content.into(),
        attachments_json: attachments_json.map(String::from),
        tokens_in,
        tokens_out,
        model_name: model_name.map(String::from),
        created_at: now,
        attachments: Vec::new(),
    })
}

pub(crate) fn db_list_messages(
    pool: &crate::db::DbPool,
    session_id: &str,
    limit: i64,
    before_id: Option<&str>,
) -> rusqlite::Result<Vec<ChatMessage>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    // If `before_id` provided, only return messages created BEFORE that one.
    // Used for cursor pagination when loading older messages.
    let mut rows = if let Some(before) = before_id {
        let before_created: Option<String> = conn
            .query_row(
                "SELECT created_at FROM chat_messages WHERE id = ?1",
                [before],
                |r| r.get(0),
            )
            .optional()?;
        let Some(before_created) = before_created else {
            return Ok(Vec::new());
        };
        let mut stmt = conn.prepare(&format!(
            "SELECT {} FROM chat_messages WHERE session_id = ?1 AND created_at < ?2 \
             ORDER BY created_at ASC LIMIT ?3",
            MSG_COLS
        ))?;
        let collected: Vec<ChatMessage> = stmt
            .query_map(params![session_id, before_created, limit], row_to_message)?
            .collect::<rusqlite::Result<_>>()?;
        collected
    } else {
        let mut stmt = conn.prepare(&format!(
            "SELECT {} FROM chat_messages WHERE session_id = ?1 \
             ORDER BY created_at ASC LIMIT ?2",
            MSG_COLS
        ))?;
        let collected: Vec<ChatMessage> = stmt
            .query_map(params![session_id, limit], row_to_message)?
            .collect::<rusqlite::Result<_>>()?;
        collected
    };
    hydrate_attachments(pool, &mut rows)?;
    Ok(rows)
}

pub(crate) fn db_update_message_content(
    pool: &crate::db::DbPool,
    message_id: &str,
    content: &str,
    tokens_out: i64,
    model_name: Option<&str>,
) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "UPDATE chat_messages SET content = ?1, tokens_out = ?2, model_name = COALESCE(?3, model_name) \
         WHERE id = ?4",
        params![content, tokens_out, model_name, message_id],
    )
}

// ============================================================
// Tauri commands
// ============================================================

#[tauri::command]
pub async fn get_messages_by_session(
    state: tauri::State<'_, AppState>,
    session_id: String,
    limit: Option<i64>,
    before_id: Option<String>,
) -> Result<Vec<ChatMessage>, String> {
    let pool = state.db_pool.clone();
    let l = limit.unwrap_or(500);
    tokio::task::spawn_blocking(move || {
        db_list_messages(&pool, &session_id, l, before_id.as_deref())
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
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

    fn fresh() -> (TempDir, crate::db::DbPool, String) {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();
        let s = db_create_session(&pool, "Test", None, None, None).unwrap();
        (tmp, pool, s.id)
    }

    #[test]
    fn append_then_list_in_order() {
        let (_t, pool, sid) = fresh();
        db_append_message(&pool, &sid, "user", "hello", None, 0, 0, None).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(10));
        db_append_message(&pool, &sid, "assistant", "hi", None, 5, 3, Some("gpt-5")).unwrap();
        let msgs = db_list_messages(&pool, &sid, 10, None).unwrap();
        assert_eq!(msgs.len(), 2);
        assert_eq!(msgs[0].content, "hello");
        assert_eq!(msgs[0].role, "user");
        assert_eq!(msgs[1].content, "hi");
        assert_eq!(msgs[1].model_name.as_deref(), Some("gpt-5"));
    }

    #[test]
    fn update_content_changes_message() {
        let (_t, pool, sid) = fresh();
        let m = db_append_message(&pool, &sid, "assistant", "", None, 0, 0, None).unwrap();
        db_update_message_content(&pool, &m.id, "filled in", 42, Some("claude-opus")).unwrap();
        let msgs = db_list_messages(&pool, &sid, 10, None).unwrap();
        assert_eq!(msgs[0].content, "filled in");
        assert_eq!(msgs[0].tokens_out, 42);
        assert_eq!(msgs[0].model_name.as_deref(), Some("claude-opus"));
    }

    #[test]
    fn deleting_session_cascades_messages() {
        let (_t, pool, sid) = fresh();
        db_append_message(&pool, &sid, "user", "a", None, 0, 0, None).unwrap();
        crate::chat::session::db_delete_session(&pool, &sid).unwrap();
        let msgs = db_list_messages(&pool, &sid, 10, None).unwrap();
        assert_eq!(msgs.len(), 0);
    }
}
