use std::pin::Pin;
use std::time::Instant;

use async_trait::async_trait;
use futures::Stream;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::keychain;
use crate::AppState;

pub mod anthropic;
pub mod ollama;
pub mod openai;
pub mod usage;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub endpoint: String,
    pub model_id: String,
    pub max_tokens: i32,
    pub is_default: bool,
    pub keychain_ref: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    /// USD per 1,000,000 input tokens. `0.0` = unknown / not priced;
    /// the usage_stats writer still records call_count + tokens.
    #[serde(default)]
    pub input_price_per_1m_tokens: f64,
    /// USD per 1,000,000 output tokens.
    #[serde(default)]
    pub output_price_per_1m_tokens: f64,
}

/// Form-style payload from the frontend. `api_key` is optional: present means
/// "store this in keychain", `None` means "leave the existing key alone"
/// (or "no key needed", e.g. Ollama).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfigInput {
    pub name: String,
    pub provider: String,
    pub endpoint: String,
    pub model_id: String,
    pub max_tokens: i32,
    pub api_key: Option<String>,
    /// Optional — if omitted on add we default to 0.0 (no cost tracking).
    #[serde(default)]
    pub input_price_per_1m_tokens: Option<f64>,
    #[serde(default)]
    pub output_price_per_1m_tokens: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    pub success: bool,
    pub latency_ms: u64,
    pub message: String,
    pub model_response: Option<String>,
}

// ============================================================
// Streaming chat — trait + types + errors
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String, // "system" | "user" | "assistant"
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TokenPayload {
    pub text: String,
    pub done: bool,
}

#[derive(Debug, Error)]
pub enum AiError {
    #[error("API Key 无效或已过期 (401)")]
    Unauthorized,
    #[error("请求过于频繁,稍后再试 (429)")]
    RateLimited,
    #[error("服务器返回 HTTP {status}: {body}")]
    Http { status: u16, body: String },
    #[error("请求超时 (>30min) — 长内容生成请检查网络或换用更快的模型")]
    Timeout,
    #[error("无法连接到服务: {0}")]
    Connection(String),
    #[error("响应解析失败: {0}")]
    Parse(String),
    #[error("API Key 未配置 — 请编辑模型添加 Key")]
    NoApiKey,
    #[error("不支持的 provider: {0}")]
    UnknownProvider(String),
    #[error("流中断: {0}")]
    Stream(String),
}

impl From<reqwest::Error> for AiError {
    fn from(e: reqwest::Error) -> Self {
        if e.is_timeout() {
            AiError::Timeout
        } else if e.is_connect() {
            AiError::Connection(e.to_string())
        } else {
            AiError::Stream(e.to_string())
        }
    }
}

pub type TokenStream = Pin<Box<dyn Stream<Item = Result<String, AiError>> + Send>>;

#[async_trait]
pub trait AiProvider: Send + Sync {
    async fn chat_stream(
        &self,
        messages: Vec<Message>,
        config: &ModelConfig,
    ) -> Result<TokenStream, AiError>;
}

/// Map a `ModelConfig.provider` string to a concrete `AiProvider` impl.
/// "openai" / "custom" → OpenAI-compatible (DeepSeek / LM Studio / Azure all fit here).
pub fn provider_for(
    provider_kind: &str,
    api_key: Option<String>,
) -> Result<Box<dyn AiProvider>, AiError> {
    match provider_kind {
        "openai" | "custom" => Ok(Box::new(openai::OpenAiCompatible::new(
            api_key.unwrap_or_default(),
        ))),
        "anthropic" => Ok(Box::new(anthropic::AnthropicProvider::new(
            api_key.unwrap_or_default(),
        ))),
        "ollama" => Ok(Box::new(ollama::OllamaProvider)),
        other => Err(AiError::UnknownProvider(other.to_string())),
    }
}

/// Categorize an HTTP response status into our error enum (or success).
pub(crate) fn status_to_error(status: reqwest::StatusCode, body: String) -> AiError {
    match status.as_u16() {
        401 | 403 => AiError::Unauthorized,
        429 => AiError::RateLimited,
        s => AiError::Http { status: s, body },
    }
}

/// Rough estimate (~4 chars per token). Real counts come from provider responses
/// when available — for now we estimate so usage_stats is never empty.
pub(crate) fn estimate_tokens(s: &str) -> i64 {
    // usize::div_ceil is stable (signed div_ceil is not — issue #88581)
    s.chars().count().div_ceil(4) as i64
}

// `upsert_usage_stats` (V2.0.x) replaced by `usage::record_usage`
// (V2.1.0) which also writes the cost estimate. The function below is
// kept (private) only for the legacy chat/skill callers during the
// in-flight refactor — remove once those paths are confirmed migrated.

/// Built-in templates the user can pick from when adding a new model.
/// These are NOT inserted automatically; the frontend uses them to prefill
/// the "add model" form.
#[tauri::command]
pub fn get_model_presets() -> Vec<ModelConfigInput> {
    vec![
        ModelConfigInput {
            name: "Claude Opus 4.7".into(),
            provider: "anthropic".into(),
            endpoint: "https://api.anthropic.com".into(),
            model_id: "claude-opus-4-7".into(),
            max_tokens: 200000,
            api_key: None,
            input_price_per_1m_tokens: Some(15.0),
            output_price_per_1m_tokens: Some(75.0),
        },
        ModelConfigInput {
            name: "GPT-5".into(),
            provider: "openai".into(),
            endpoint: "https://api.openai.com/v1".into(),
            model_id: "gpt-5".into(),
            max_tokens: 128000,
            api_key: None,
            input_price_per_1m_tokens: Some(5.0),
            output_price_per_1m_tokens: Some(15.0),
        },
        ModelConfigInput {
            name: "DeepSeek V3".into(),
            provider: "openai".into(),
            endpoint: "https://api.deepseek.com/v1".into(),
            model_id: "deepseek-chat".into(),
            max_tokens: 64000,
            api_key: None,
            input_price_per_1m_tokens: Some(0.27),
            output_price_per_1m_tokens: Some(1.10),
        },
        ModelConfigInput {
            name: "Ollama Llama 3 (8B,本地)".into(),
            provider: "ollama".into(),
            endpoint: "http://localhost:11434".into(),
            model_id: "llama3:8b".into(),
            max_tokens: 8192,
            api_key: None,
            input_price_per_1m_tokens: Some(0.0),
            output_price_per_1m_tokens: Some(0.0),
        },
    ]
}

// ============================================================
// DB helpers (sync — call from spawn_blocking)
// ============================================================

fn now_iso() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

fn row_to_config(row: &rusqlite::Row) -> rusqlite::Result<ModelConfig> {
    Ok(ModelConfig {
        id: row.get(0)?,
        name: row.get(1)?,
        provider: row.get(2)?,
        endpoint: row.get(3)?,
        model_id: row.get(4)?,
        max_tokens: row.get(5)?,
        is_default: row.get::<_, i64>(6)? == 1,
        keychain_ref: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
        // V004 — pricing fields (NOT NULL DEFAULT 0.0, so always present).
        input_price_per_1m_tokens: row.get(10)?,
        output_price_per_1m_tokens: row.get(11)?,
    })
}

const SELECT_COLS: &str = "id, name, provider, endpoint, model_id, max_tokens, \
                           is_default, keychain_ref, created_at, updated_at, \
                           input_price_per_1m_tokens, output_price_per_1m_tokens";

pub(crate) fn list_all(pool: &crate::db::DbPool) -> rusqlite::Result<Vec<ModelConfig>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM model_configs ORDER BY is_default DESC, created_at ASC",
        SELECT_COLS
    ))?;
    let rows = stmt.query_map([], row_to_config)?;
    rows.collect()
}

pub(crate) fn get_one(
    pool: &crate::db::DbPool,
    id: &str,
) -> rusqlite::Result<Option<ModelConfig>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.query_row(
        &format!("SELECT {} FROM model_configs WHERE id = ?1", SELECT_COLS),
        [id],
        row_to_config,
    )
    .optional()
}

fn insert(pool: &crate::db::DbPool, cfg: &ModelConfig) -> rusqlite::Result<()> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "INSERT INTO model_configs \
         (id, name, provider, endpoint, model_id, max_tokens, is_default, keychain_ref, \
          created_at, updated_at, input_price_per_1m_tokens, output_price_per_1m_tokens) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            cfg.id,
            cfg.name,
            cfg.provider,
            cfg.endpoint,
            cfg.model_id,
            cfg.max_tokens,
            cfg.is_default as i64,
            cfg.keychain_ref,
            cfg.created_at,
            cfg.updated_at,
            cfg.input_price_per_1m_tokens,
            cfg.output_price_per_1m_tokens,
        ],
    )?;
    Ok(())
}

fn update(pool: &crate::db::DbPool, id: &str, input: &ModelConfigInput) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    // Build a single UPDATE that always touches name/provider/endpoint
    // /model_id/max_tokens/updated_at and only sets the price fields
    // when the form sent them (None = "leave whatever was there").
    let (in_price_sql, out_price_sql) = (
        if input.input_price_per_1m_tokens.is_some() {
            ", input_price_per_1m_tokens = ?7"
        } else {
            ""
        },
        if input.output_price_per_1m_tokens.is_some() {
            if input.input_price_per_1m_tokens.is_some() {
                ", output_price_per_1m_tokens = ?8"
            } else {
                ", output_price_per_1m_tokens = ?7"
            }
        } else {
            ""
        },
    );
    let sql = format!(
        "UPDATE model_configs \
         SET name = ?1, provider = ?2, endpoint = ?3, model_id = ?4, \
             max_tokens = ?5, updated_at = ?6{in_price_sql}{out_price_sql} \
         WHERE id = ?{where_idx}",
        where_idx = 7
            + (input.input_price_per_1m_tokens.is_some() as usize)
            + (input.output_price_per_1m_tokens.is_some() as usize)
    );
    let now = now_iso();
    let mut p: Vec<&dyn rusqlite::ToSql> = vec![
        &input.name,
        &input.provider,
        &input.endpoint,
        &input.model_id,
        &input.max_tokens,
        &now,
    ];
    if let Some(v) = &input.input_price_per_1m_tokens {
        p.push(v);
    }
    if let Some(v) = &input.output_price_per_1m_tokens {
        p.push(v);
    }
    p.push(&id);
    conn.execute(&sql, rusqlite::params_from_iter(p))
}

fn delete(pool: &crate::db::DbPool, id: &str) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute("DELETE FROM model_configs WHERE id = ?1", [id])
}

fn set_default(pool: &crate::db::DbPool, id: &str) -> rusqlite::Result<()> {
    let mut conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let tx = conn.transaction()?;
    tx.execute(
        "UPDATE model_configs SET is_default = 0 WHERE is_default = 1",
        [],
    )?;
    let n = tx.execute(
        "UPDATE model_configs SET is_default = 1, updated_at = ?1 WHERE id = ?2",
        params![now_iso(), id],
    )?;
    if n == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    tx.commit()?;
    Ok(())
}

// ============================================================
// Tauri commands
// ============================================================

#[tauri::command]
pub async fn get_model_configs(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<ModelConfig>, String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || list_all(&pool))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_model_config(
    state: tauri::State<'_, AppState>,
    input: ModelConfigInput,
) -> Result<ModelConfig, String> {
    let id = uuid::Uuid::now_v7().to_string();
    let now = now_iso();
    let has_key = input.api_key.is_some();
    let cfg = ModelConfig {
        id: id.clone(),
        name: input.name.clone(),
        provider: input.provider.clone(),
        endpoint: input.endpoint.clone(),
        model_id: input.model_id.clone(),
        max_tokens: input.max_tokens,
        is_default: false,
        keychain_ref: if has_key { Some(id.clone()) } else { None },
        created_at: now.clone(),
        updated_at: now,
        input_price_per_1m_tokens: input.input_price_per_1m_tokens.unwrap_or(0.0),
        output_price_per_1m_tokens: input.output_price_per_1m_tokens.unwrap_or(0.0),
    };

    let pool = state.db_pool.clone();
    let cfg_for_insert = cfg.clone();
    tokio::task::spawn_blocking(move || insert(&pool, &cfg_for_insert))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;

    if let Some(key) = input.api_key {
        if !key.is_empty() {
            keychain::set_api_key(&id, &key).map_err(|e| e.to_string())?;
        }
    }

    log::info!(
        "added model {} ({}/{}) {}",
        cfg.id,
        cfg.provider,
        cfg.model_id,
        if has_key { "with key" } else { "no key" }
    );
    Ok(cfg)
}

#[tauri::command]
pub async fn update_model_config(
    state: tauri::State<'_, AppState>,
    id: String,
    input: ModelConfigInput,
) -> Result<ModelConfig, String> {
    let pool = state.db_pool.clone();
    let id_for_update = id.clone();
    let input_for_update = input.clone();
    let n = tokio::task::spawn_blocking(move || update(&pool, &id_for_update, &input_for_update))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err(format!("model `{}` not found", id));
    }

    if let Some(key) = input.api_key {
        if key.is_empty() {
            // explicit empty string → clear the key
            let _ = keychain::delete_api_key(&id);
        } else {
            keychain::set_api_key(&id, &key).map_err(|e| e.to_string())?;
        }
    }

    let pool = state.db_pool.clone();
    let id_for_get = id.clone();
    let cfg = tokio::task::spawn_blocking(move || get_one(&pool, &id_for_get))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("model `{}` disappeared after update", id))?;
    Ok(cfg)
}

#[tauri::command]
pub async fn delete_model_config(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    let id_for_delete = id.clone();
    let n = tokio::task::spawn_blocking(move || delete(&pool, &id_for_delete))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err(format!("model `{}` not found", id));
    }
    // Best-effort keychain cleanup
    if let Err(e) = keychain::delete_api_key(&id) {
        log::warn!("failed to delete keychain entry for {}: {}", id, e);
    }
    Ok(())
}

#[tauri::command]
pub async fn set_default_model(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    let id_for_set = id.clone();
    tokio::task::spawn_blocking(move || set_default(&pool, &id_for_set))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => format!("model `{}` not found", id),
            other => other.to_string(),
        })
}

#[tauri::command]
pub async fn test_model_connection(
    state: tauri::State<'_, AppState>,
    model_id: String,
) -> Result<TestResult, String> {
    // 1. Look up the config row
    let pool = state.db_pool.clone();
    let mid = model_id.clone();
    let config = tokio::task::spawn_blocking(move || get_one(&pool, &mid))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("model `{}` not found", model_id))?;

    // 2. Pull API key from keychain if needed
    let api_key = if config.provider == "ollama" {
        None
    } else {
        match keychain::get_api_key(&model_id) {
            Ok(Some(k)) => Some(k),
            Ok(None) => {
                return Ok(TestResult {
                    success: false,
                    latency_ms: 0,
                    message: "API Key 未配置 — 请编辑模型添加 Key".into(),
                    model_response: None,
                });
            }
            Err(e) => {
                return Ok(TestResult {
                    success: false,
                    latency_ms: 0,
                    message: format!("Keychain 读取失败: {}", e),
                    model_response: None,
                });
            }
        }
    };

    // 3. Dispatch to provider-specific test
    let started = Instant::now();
    let result: Result<String, String> = match config.provider.as_str() {
        "anthropic" => {
            anthropic::test_connection(
                &config.endpoint,
                &config.model_id,
                api_key.as_deref().unwrap_or(""),
            )
            .await
        }
        "openai" => {
            openai::test_connection(
                &config.endpoint,
                &config.model_id,
                api_key.as_deref().unwrap_or(""),
            )
            .await
        }
        "ollama" => ollama::test_connection(&config.endpoint).await,
        other => Err(format!("unsupported provider `{}`", other)),
    };
    let latency = started.elapsed().as_millis() as u64;

    Ok(match result {
        Ok(response) => TestResult {
            success: true,
            latency_ms: latency,
            message: format!("连接成功 ({} ms)", latency),
            model_response: Some(response),
        },
        Err(e) => TestResult {
            success: false,
            latency_ms: latency,
            message: format!("连接失败: {}", e),
            model_response: None,
        },
    })
}

#[tauri::command]
pub async fn ai_chat_stream(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    model_id: String,
    messages: Vec<Message>,
) -> Result<String, String> {
    use futures::StreamExt;
    use tauri::Emitter;

    // 1. Look up the config
    let pool = state.db_pool.clone();
    let mid = model_id.clone();
    let config = tokio::task::spawn_blocking(move || get_one(&pool, &mid))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("model `{}` not found", model_id))?;

    // 2. Pull API key (released as soon as provider holds it)
    let api_key = if config.provider == "ollama" {
        None
    } else {
        match keychain::get_api_key(&model_id) {
            Ok(Some(k)) => Some(k),
            Ok(None) => return Err(AiError::NoApiKey.to_string()),
            Err(e) => return Err(format!("Keychain 读取失败: {}", e)),
        }
    };

    // 3. Dispatch
    let provider = provider_for(&config.provider, api_key).map_err(|e| e.to_string())?;

    // 4. Estimate input tokens
    let tokens_in: i64 = messages.iter().map(|m| estimate_tokens(&m.content)).sum();

    // 5. Start the stream
    let mut stream = provider
        .chat_stream(messages, &config)
        .await
        .map_err(|e| e.to_string())?;

    // 6. Drain + emit
    let mut full_text = String::new();
    let mut tokens_out: i64 = 0;
    while let Some(chunk) = stream.next().await {
        match chunk {
            Ok(text) => {
                tokens_out += estimate_tokens(&text);
                full_text.push_str(&text);
                let _ = app.emit(
                    "ai:token",
                    TokenPayload {
                        text,
                        done: false,
                    },
                );
            }
            Err(e) => {
                let _ = app.emit(
                    "ai:token",
                    TokenPayload {
                        text: format!("\n[ERROR: {}]\n", e),
                        done: true,
                    },
                );
                return Err(e.to_string());
            }
        }
    }

    // 7. Emit terminal `done`
    let _ = app.emit(
        "ai:token",
        TokenPayload {
            text: String::new(),
            done: true,
        },
    );

    // 8. Best-effort usage stats (don't fail the request if write fails).
    //    V2.1.0 — record_usage is cost-aware (writes cost_est_total).
    let pool = state.db_pool.clone();
    let cfg_for_usage = config.clone();
    let _ = tokio::task::spawn_blocking(move || {
        usage::record_usage(&pool, &cfg_for_usage, tokens_in, tokens_out)
    })
    .await
    .map(|r| r.map_err(|e| log::warn!("usage_stats write failed: {}", e)));

    log::info!(
        "ai_chat_stream done: model={} in≈{} out≈{} totalLen={}",
        config.id,
        tokens_in,
        tokens_out,
        full_text.len()
    );
    Ok(full_text)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_at;
    use tempfile::TempDir;

    fn input(name: &str, provider: &str) -> ModelConfigInput {
        ModelConfigInput {
            name: name.into(),
            provider: provider.into(),
            endpoint: "https://api.example.com".into(),
            model_id: "test-model".into(),
            max_tokens: 1024,
            api_key: None,
            input_price_per_1m_tokens: None,
            output_price_per_1m_tokens: None,
        }
    }

    fn fresh() -> (TempDir, crate::db::DbPool) {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();
        (tmp, pool)
    }

    fn build_cfg(id: &str, input: &ModelConfigInput) -> ModelConfig {
        ModelConfig {
            id: id.into(),
            name: input.name.clone(),
            provider: input.provider.clone(),
            endpoint: input.endpoint.clone(),
            model_id: input.model_id.clone(),
            max_tokens: input.max_tokens,
            is_default: false,
            keychain_ref: None,
            created_at: now_iso(),
            updated_at: now_iso(),
            input_price_per_1m_tokens: input.input_price_per_1m_tokens.unwrap_or(0.0),
            output_price_per_1m_tokens: input.output_price_per_1m_tokens.unwrap_or(0.0),
        }
    }

    #[test]
    fn insert_then_list() {
        let (_tmp, pool) = fresh();
        let cfg = build_cfg("m1", &input("Claude", "anthropic"));
        insert(&pool, &cfg).unwrap();

        let all = list_all(&pool).unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].name, "Claude");
    }

    #[test]
    fn update_changes_fields() {
        let (_tmp, pool) = fresh();
        let cfg = build_cfg("m2", &input("Old name", "openai"));
        insert(&pool, &cfg).unwrap();

        let mut new_input = input("New name", "openai");
        new_input.endpoint = "https://other.com".into();
        let n = update(&pool, "m2", &new_input).unwrap();
        assert_eq!(n, 1);

        let got = get_one(&pool, "m2").unwrap().unwrap();
        assert_eq!(got.name, "New name");
        assert_eq!(got.endpoint, "https://other.com");
    }

    #[test]
    fn delete_removes_row() {
        let (_tmp, pool) = fresh();
        insert(&pool, &build_cfg("m3", &input("X", "openai"))).unwrap();
        assert_eq!(delete(&pool, "m3").unwrap(), 1);
        assert!(get_one(&pool, "m3").unwrap().is_none());
        assert_eq!(delete(&pool, "m3").unwrap(), 0); // missing → 0
    }

    #[test]
    fn set_default_enforces_single_default() {
        let (_tmp, pool) = fresh();
        insert(&pool, &build_cfg("m4", &input("A", "openai"))).unwrap();
        insert(&pool, &build_cfg("m5", &input("B", "openai"))).unwrap();

        set_default(&pool, "m4").unwrap();
        let after_first = list_all(&pool).unwrap();
        let defaults: Vec<_> = after_first.iter().filter(|c| c.is_default).collect();
        assert_eq!(defaults.len(), 1);
        assert_eq!(defaults[0].id, "m4");

        // switch — old default should be cleared (UNIQUE INDEX would otherwise fail)
        set_default(&pool, "m5").unwrap();
        let after_switch = list_all(&pool).unwrap();
        let defaults: Vec<_> = after_switch.iter().filter(|c| c.is_default).collect();
        assert_eq!(defaults.len(), 1);
        assert_eq!(defaults[0].id, "m5");
    }

    #[test]
    fn set_default_missing_id_errors() {
        let (_tmp, pool) = fresh();
        let result = set_default(&pool, "missing");
        assert!(matches!(
            result,
            Err(rusqlite::Error::QueryReturnedNoRows)
        ));
    }

    #[test]
    fn presets_are_four_with_distinct_providers() {
        let p = get_model_presets();
        assert_eq!(p.len(), 4);
        let providers: std::collections::HashSet<_> =
            p.iter().map(|x| x.provider.clone()).collect();
        // anthropic + openai (twice for GPT-5 and DeepSeek) + ollama = 3 unique
        assert!(providers.contains("anthropic"));
        assert!(providers.contains("openai"));
        assert!(providers.contains("ollama"));
    }
}
