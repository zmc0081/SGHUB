use serde::{Deserialize, Serialize};

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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    pub success: bool,
    pub latency_ms: u64,
    pub message: String,
    pub model_response: Option<String>,
}

fn mock_model_configs() -> Vec<ModelConfig> {
    vec![
        ModelConfig {
            id: "model-claude-opus-4-7".into(),
            name: "Claude Opus 4.7".into(),
            provider: "anthropic".into(),
            endpoint: "https://api.anthropic.com".into(),
            model_id: "claude-opus-4-7-20260301".into(),
            max_tokens: 200000,
            is_default: true,
            keychain_ref: Some("sghub.anthropic.opus47".into()),
            created_at: "2026-04-28T09:00:00Z".into(),
            updated_at: "2026-04-28T09:00:00Z".into(),
        },
        ModelConfig {
            id: "model-gpt-4o".into(),
            name: "GPT-4o".into(),
            provider: "openai".into(),
            endpoint: "https://api.openai.com/v1".into(),
            model_id: "gpt-4o".into(),
            max_tokens: 128000,
            is_default: false,
            keychain_ref: Some("sghub.openai.gpt4o".into()),
            created_at: "2026-04-28T09:05:00Z".into(),
            updated_at: "2026-04-28T09:05:00Z".into(),
        },
        ModelConfig {
            id: "model-deepseek-v3".into(),
            name: "DeepSeek V3".into(),
            provider: "openai".into(),
            endpoint: "https://api.deepseek.com/v1".into(),
            model_id: "deepseek-chat".into(),
            max_tokens: 64000,
            is_default: false,
            keychain_ref: Some("sghub.deepseek.v3".into()),
            created_at: "2026-04-28T09:10:00Z".into(),
            updated_at: "2026-04-28T09:10:00Z".into(),
        },
        ModelConfig {
            id: "model-ollama-llama3-8b".into(),
            name: "Ollama Llama 3 (8B, 本地)".into(),
            provider: "ollama".into(),
            endpoint: "http://localhost:11434".into(),
            model_id: "llama3:8b".into(),
            max_tokens: 8192,
            is_default: false,
            keychain_ref: None,
            created_at: "2026-04-29T13:30:00Z".into(),
            updated_at: "2026-04-29T13:30:00Z".into(),
        },
    ]
}

#[tauri::command]
pub async fn get_model_configs() -> Result<Vec<ModelConfig>, String> {
    Ok(mock_model_configs())
}

#[tauri::command]
pub async fn test_model_connection(model_id: String) -> Result<TestResult, String> {
    let config = mock_model_configs()
        .into_iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| format!("model `{}` not found", model_id))?;

    let (success, latency, response) = match config.provider.as_str() {
        "anthropic" => (true, 318, "Hello! I'm Claude, ready to help."),
        "openai" => (true, 142, "Hi! How can I assist you today?"),
        "ollama" => (false, 0, ""),
        _ => (true, 250, "ok"),
    };

    let message = if success {
        format!("连接成功 — {} ({}ms)", config.name, latency)
    } else {
        "连接失败 — 本地 Ollama 未运行 (mock)".into()
    };

    Ok(TestResult {
        success,
        latency_ms: latency,
        message,
        model_response: if response.is_empty() {
            None
        } else {
            Some(response.into())
        },
    })
}
