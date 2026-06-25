//! Orchestrate one turn of chat.
//!
//! `send_chat_message` persists the user message then delegates to the shared
//! `stream_assistant_turn`, which builds context from history, streams the LLM
//! reply, and persists it. `regenerate_message` and `edit_and_resend` reuse the
//! same turn after truncating the trailing messages. The drain loop honours a
//! per-message cancel flag set by `cancel_chat_stream`.

use std::collections::HashSet;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};

use crate::ai_client::{
    estimate_tokens, get_one as get_model_config, provider_for, usage::record_usage, AiError,
};
use crate::keychain;
use crate::AppState;

use super::context::build_messages_from_history;
use super::message::{
    db_append_message, db_delete_messages_after, db_update_message_content, db_update_user_content,
};
use super::session::{db_create_session, db_get_session, db_touch_session};

// ── Cancellation registry ───────────────────────────────────────────────
// Keyed by assistant_message_id. `cancel_chat_stream` inserts; the drain loop
// polls + removes, stopping early (already-streamed content is kept). OnceLock
// keeps this rust 1.77-compatible (LazyLock needs 1.80), matching pdf_download.

fn cancelled_set() -> &'static Mutex<HashSet<String>> {
    static CELL: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
    CELL.get_or_init(|| Mutex::new(HashSet::new()))
}

fn mark_cancelled(message_id: &str) {
    if let Ok(mut s) = cancelled_set().lock() {
        s.insert(message_id.to_string());
    }
}

/// Returns true (and clears the flag) if this message was asked to cancel.
fn take_cancelled(message_id: &str) -> bool {
    cancelled_set()
        .lock()
        .map(|mut s| s.remove(message_id))
        .unwrap_or(false)
}

/// Stop an in-flight assistant stream. Already-generated content is preserved.
#[tauri::command]
pub async fn cancel_chat_stream(message_id: String) -> Result<(), String> {
    mark_cancelled(&message_id);
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatStreamInput {
    /// If empty/null, a new session is created on the fly.
    pub session_id: Option<String>,
    pub content: String,
    /// chat_attachments.id values, in display order
    #[serde(default)]
    pub attachments: Vec<String>,
    pub skill_name: Option<String>,
    pub model_config_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatStreamResult {
    pub session_id: String,
    pub assistant_message_id: String,
    pub content: String,
    pub tokens_in: i64,
    pub tokens_out: i64,
    pub model_name: String,
}

#[derive(Debug, Clone, Serialize)]
struct ChatTokenPayload {
    session_id: String,
    message_id: String,
    text: String,
    done: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    tokens_in: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tokens_out: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    model_name: Option<String>,
}

// ── Shared: stream one assistant turn from the session's history ─────────
//
// Caller must have already persisted whatever user turn should drive the
// reply (history ends with a user message). Resolves the model, builds context
// from history, creates an empty assistant row, streams it, persists, and emits
// the terminal `chat:token` event.
async fn stream_assistant_turn(
    app: &tauri::AppHandle,
    state: &AppState,
    session_id: &str,
    model_config_id: Option<String>,
    skill_name: Option<String>,
) -> Result<ChatStreamResult, String> {
    use futures::StreamExt;
    use tauri::Emitter;

    // 1. Resolve model config + key (explicit id → session/default fallback)
    let model_id = match model_config_id {
        Some(m) if !m.is_empty() => m,
        _ => {
            let pool = state.db_pool.clone();
            let all = tokio::task::spawn_blocking(move || crate::ai_client::list_all(&pool))
                .await
                .map_err(|e| e.to_string())?
                .map_err(|e| e.to_string())?;
            all.iter()
                .find(|m| m.is_default)
                .or_else(|| all.first())
                .map(|m| m.id.clone())
                .ok_or_else(|| "请先在「模型配置」添加至少一个模型".to_string())?
        }
    };
    let pool = state.db_pool.clone();
    let mid_clone = model_id.clone();
    let config = tokio::task::spawn_blocking(move || get_model_config(&pool, &mid_clone))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("model `{}` not found", model_id))?;

    let api_key: Option<String> = if config.provider == "ollama" {
        None
    } else {
        match keychain::get_api_key(&model_id) {
            Ok(Some(k)) => Some(k),
            Ok(None) => return Err(AiError::NoApiKey.to_string()),
            Err(e) => return Err(format!("Keychain 错误: {}", e)),
        }
    };

    // 2. Build context from history (latest user turn already persisted)
    let pool = state.db_pool.clone();
    let sid_for_ctx = session_id.to_string();
    let sk_for_ctx = skill_name.clone();
    let max_tokens = config.max_tokens as i64;
    let app_for_ctx = app.clone();
    let (messages, tokens_in) = tokio::task::spawn_blocking(move || {
        build_messages_from_history(
            &app_for_ctx,
            &pool,
            &sid_for_ctx,
            sk_for_ctx.as_deref(),
            max_tokens,
        )
    })
    .await
    .map_err(|e| e.to_string())??;

    // 3. Create empty assistant message — content patched as tokens arrive
    let pool = state.db_pool.clone();
    let sid_for_asst = session_id.to_string();
    let model_name = config.name.clone();
    let model_name_for_asst = model_name.clone();
    let assistant_msg = tokio::task::spawn_blocking(move || {
        db_append_message(
            &pool,
            &sid_for_asst,
            "assistant",
            "",
            None,
            tokens_in,
            0,
            Some(&model_name_for_asst),
        )
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;
    // Drop any stale cancel flag for this id before we begin.
    let _ = take_cancelled(&assistant_msg.id);

    // 4. SG AI Store balance pre-flight (V2.2.1 Session 29)
    crate::ai_client::pre_flight_balance_check(&config).map_err(|e| e.to_string())?;

    // 5. Open the stream
    let provider = provider_for(&config.provider, api_key)
        .map_err(|e| format!("model `{}`: {}", config.name, e))?;
    log::info!(
        "chat_stream: session={} provider={} endpoint={} model_id={} name={}",
        session_id,
        config.provider,
        config.endpoint,
        config.model_id,
        config.name,
    );
    let stream_result = provider.chat_stream(messages, &config).await.map_err(|e| {
        log::error!(
            "chat_stream failed before first token (model={}, provider={}): {}",
            config.name,
            config.provider,
            e
        );
        format!("model `{}` ({}): {}", config.name, config.provider, e)
    });

    let mut stream = match stream_result {
        Ok(s) => s,
        Err(e) => {
            let pool = state.db_pool.clone();
            let mid_for_err = assistant_msg.id.clone();
            let err_text = format!("[请求失败: {}]", e);
            let err_text_for_blocking = err_text.clone();
            let model_name_for_err = model_name.clone();
            let _ = tokio::task::spawn_blocking(move || {
                db_update_message_content(
                    &pool,
                    &mid_for_err,
                    &err_text_for_blocking,
                    0,
                    Some(&model_name_for_err),
                )
            })
            .await;
            let _ = app.emit(
                "chat:token",
                ChatTokenPayload {
                    session_id: session_id.to_string(),
                    message_id: assistant_msg.id.clone(),
                    text: err_text,
                    done: true,
                    tokens_in: Some(tokens_in),
                    tokens_out: Some(0),
                    model_name: Some(model_name.clone()),
                },
            );
            return Err(e);
        }
    };

    // 6. Drain + emit + persist, honouring the cancel flag
    let mut full = String::new();
    let mut tokens_out: i64 = 0;
    while let Some(chunk) = stream.next().await {
        match chunk {
            Ok(text) => {
                tokens_out += estimate_tokens(&text);
                full.push_str(&text);
                let _ = app.emit(
                    "chat:token",
                    ChatTokenPayload {
                        session_id: session_id.to_string(),
                        message_id: assistant_msg.id.clone(),
                        text,
                        done: false,
                        tokens_in: None,
                        tokens_out: None,
                        model_name: None,
                    },
                );
            }
            Err(e) => {
                full.push_str(&format!("\n[stream error: {}]", e));
                break;
            }
        }
        if take_cancelled(&assistant_msg.id) {
            log::info!("chat_stream cancelled by user: message={}", assistant_msg.id);
            break;
        }
    }

    // 7. Finalize: write content, touch session, usage, emit done
    let pool = state.db_pool.clone();
    let mid_for_final = assistant_msg.id.clone();
    let full_for_final = full.clone();
    let model_name_for_final = model_name.clone();
    let _ = tokio::task::spawn_blocking(move || {
        db_update_message_content(
            &pool,
            &mid_for_final,
            &full_for_final,
            tokens_out,
            Some(&model_name_for_final),
        )
    })
    .await
    .map(|r| r.map_err(|e| log::warn!("update assistant msg failed: {}", e)));

    let pool = state.db_pool.clone();
    let sid_for_touch = session_id.to_string();
    let _ = tokio::task::spawn_blocking(move || db_touch_session(&pool, &sid_for_touch)).await;

    let pool = state.db_pool.clone();
    let cfg_for_usage = config.clone();
    let _ = tokio::task::spawn_blocking(move || {
        record_usage(&pool, &cfg_for_usage, tokens_in, tokens_out)
    })
    .await;

    let _ = app.emit(
        "chat:token",
        ChatTokenPayload {
            session_id: session_id.to_string(),
            message_id: assistant_msg.id.clone(),
            text: String::new(),
            done: true,
            tokens_in: Some(tokens_in),
            tokens_out: Some(tokens_out),
            model_name: Some(model_name.clone()),
        },
    );

    log::info!(
        "chat turn done: session={} model={} in≈{} out≈{} len={}",
        session_id,
        model_name,
        tokens_in,
        tokens_out,
        full.len()
    );

    Ok(ChatStreamResult {
        session_id: session_id.to_string(),
        assistant_message_id: assistant_msg.id,
        content: full,
        tokens_in,
        tokens_out,
        model_name,
    })
}

#[tauri::command]
pub async fn send_chat_message(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    input: ChatStreamInput,
) -> Result<ChatStreamResult, String> {
    let ChatStreamInput {
        session_id,
        content,
        attachments,
        skill_name,
        model_config_id,
    } = input;

    // 1. Ensure session
    let pool = state.db_pool.clone();
    let session_id = match session_id.filter(|s| !s.is_empty()) {
        Some(id) => {
            let id_clone = id.clone();
            let exists = tokio::task::spawn_blocking(move || db_get_session(&pool, &id_clone))
                .await
                .map_err(|e| e.to_string())?
                .map_err(|e| e.to_string())?
                .is_some();
            if !exists {
                return Err(format!("session `{}` not found", id));
            }
            id
        }
        None => {
            let title: String = content.chars().take(30).collect();
            let title = if title.is_empty() {
                "新对话".into()
            } else {
                title
            };
            let pool = state.db_pool.clone();
            let mid = model_config_id.clone();
            let sk = skill_name.clone();
            let sess = tokio::task::spawn_blocking(move || {
                db_create_session(&pool, &title, mid.as_deref(), sk.as_deref(), None)
            })
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string())?;
            sess.id
        }
    };

    // 2. Persist user message
    let attachments_json = if attachments.is_empty() {
        None
    } else {
        Some(serde_json::to_string(&attachments).unwrap_or_else(|_| "[]".into()))
    };
    let pool = state.db_pool.clone();
    let sid_for_user = session_id.clone();
    let content_for_user = content.clone();
    let aj_for_user = attachments_json.clone();
    let user_msg = tokio::task::spawn_blocking(move || {
        db_append_message(
            &pool,
            &sid_for_user,
            "user",
            &content_for_user,
            aj_for_user.as_deref(),
            0,
            0,
            None,
        )
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    // Link attachments to this user message (survive reload + cascade-delete).
    if !attachments.is_empty() {
        let pool = state.db_pool.clone();
        let att_ids = attachments.clone();
        let msg_id = user_msg.id.clone();
        let _ = tokio::task::spawn_blocking(move || {
            let conn = pool
                .get()
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
            for aid in &att_ids {
                conn.execute(
                    "UPDATE chat_attachments SET message_id = ?1 WHERE id = ?2",
                    rusqlite::params![msg_id, aid],
                )?;
            }
            Ok::<_, rusqlite::Error>(())
        })
        .await;
    }

    // 3. Stream the assistant reply from the (now updated) history.
    stream_assistant_turn(&app, &state, &session_id, model_config_id, skill_name).await
}

/// Regenerate an assistant reply: drop it (and anything after) and re-run the
/// turn from the preceding user message. `model_config_id` overrides the model
/// for a "regenerate with a different model".
#[tauri::command]
pub async fn regenerate_message(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    session_id: String,
    assistant_message_id: String,
    model_config_id: Option<String>,
) -> Result<ChatStreamResult, String> {
    let pool = state.db_pool.clone();
    let sid = session_id.clone();
    let session = tokio::task::spawn_blocking(move || db_get_session(&pool, &sid))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("session `{}` not found", session_id))?;

    let pool = state.db_pool.clone();
    let sid = session_id.clone();
    let aid = assistant_message_id.clone();
    tokio::task::spawn_blocking(move || db_delete_messages_after(&pool, &sid, &aid, true))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;

    let model = model_config_id.or(session.model_config_id);
    stream_assistant_turn(&app, &state, &session_id, model, session.skill_name).await
}

/// Edit a user message and resend: overwrite its content, drop everything after
/// it, and re-run the turn.
#[tauri::command]
pub async fn edit_and_resend(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    session_id: String,
    user_message_id: String,
    new_content: String,
    model_config_id: Option<String>,
) -> Result<ChatStreamResult, String> {
    let pool = state.db_pool.clone();
    let sid = session_id.clone();
    let session = tokio::task::spawn_blocking(move || db_get_session(&pool, &sid))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("session `{}` not found", session_id))?;

    let pool = state.db_pool.clone();
    let uid = user_message_id.clone();
    let nc = new_content.clone();
    tokio::task::spawn_blocking(move || db_update_user_content(&pool, &uid, &nc))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;

    let pool = state.db_pool.clone();
    let sid = session_id.clone();
    let uid = user_message_id.clone();
    tokio::task::spawn_blocking(move || db_delete_messages_after(&pool, &sid, &uid, false))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;

    let model = model_config_id.or(session.model_config_id);
    stream_assistant_turn(&app, &state, &session_id, model, session.skill_name).await
}
