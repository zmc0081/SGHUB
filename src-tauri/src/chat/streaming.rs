//! Orchestrate one turn of chat:
//!   create-session-if-needed → persist user msg → build context → stream LLM →
//!   persist assistant msg → touch session updated_at → emit terminal event

use serde::{Deserialize, Serialize};

use crate::ai_client::{
    estimate_tokens, get_one as get_model_config, provider_for, upsert_usage_stats, AiError,
};
use crate::keychain;
use crate::AppState;

use super::context::build_messages_for_api;
use super::message::{db_append_message, db_update_message_content};
use super::session::{db_create_session, db_get_session, db_touch_session};

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

#[tauri::command]
pub async fn send_chat_message(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    input: ChatStreamInput,
) -> Result<ChatStreamResult, String> {
    use futures::StreamExt;
    use tauri::Emitter;

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
            // Verify session exists
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
            // Create new session — title derived from first 30 chars of input
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

    // Link attachments to this user message so they survive UI reload and
    // cascade-delete when the message is removed.
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

    // 3. Resolve model config + key
    let model_id = match model_config_id {
        Some(m) if !m.is_empty() => m,
        _ => {
            // Fallback: try the default model
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

    // 4. Build context (history + skill + attachments)
    let pool = state.db_pool.clone();
    let sid_for_ctx = session_id.clone();
    let sk_for_ctx = skill_name.clone();
    let content_for_ctx = content.clone();
    let att_for_ctx = attachments.clone();
    let max_tokens = config.max_tokens as i64;
    let app_handle_for_ctx = app.clone();
    let (messages, tokens_in) = tokio::task::spawn_blocking(move || {
        build_messages_for_api(
            &app_handle_for_ctx,
            &pool,
            &sid_for_ctx,
            sk_for_ctx.as_deref(),
            &content_for_ctx,
            &att_for_ctx,
            max_tokens,
        )
    })
    .await
    .map_err(|e| e.to_string())??;

    // 5. Create empty assistant message — we update its content as tokens arrive
    let pool = state.db_pool.clone();
    let sid_for_asst = session_id.clone();
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

    // 6. Open the stream
    let provider = provider_for(&config.provider, api_key).map_err(|e| e.to_string())?;
    let stream_result = provider
        .chat_stream(messages, &config)
        .await
        .map_err(|e| e.to_string());

    let mut stream = match stream_result {
        Ok(s) => s,
        Err(e) => {
            // Save the error in the assistant message so the UI shows it on reload
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
                    session_id: session_id.clone(),
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

    // 7. Drain + emit + persist
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
                        session_id: session_id.clone(),
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
    }

    // 8. Finalize: write content to DB, emit done, touch session
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
    let sid_for_touch = session_id.clone();
    let _ = tokio::task::spawn_blocking(move || db_touch_session(&pool, &sid_for_touch)).await;

    // 9. Usage stats (best-effort)
    let pool = state.db_pool.clone();
    let mcid = config.id.clone();
    let _ = tokio::task::spawn_blocking(move || {
        upsert_usage_stats(&pool, &mcid, tokens_in, tokens_out)
    })
    .await;

    let _ = app.emit(
        "chat:token",
        ChatTokenPayload {
            session_id: session_id.clone(),
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
        session_id,
        assistant_message_id: assistant_msg.id,
        content: full,
        tokens_in,
        tokens_out,
        model_name,
    })
}
