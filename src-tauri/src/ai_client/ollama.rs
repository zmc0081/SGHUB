//! Ollama local API.
//! Connection test just hits `/api/tags` to confirm the daemon is up
//! and reports how many local models are available.

use std::time::Duration;

const TEST_TIMEOUT: Duration = Duration::from_secs(5);

pub async fn test_connection(endpoint: &str) -> Result<String, String> {
    let url = format!("{}/api/tags", endpoint.trim_end_matches('/'));

    let client = reqwest::Client::builder()
        .timeout(TEST_TIMEOUT)
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("request failed (Ollama not running?): {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("parse json: {}", e))?;

    let count = json
        .get("models")
        .and_then(|v| v.as_array())
        .map(|a| a.len())
        .unwrap_or(0);
    Ok(format!("Ollama 在线 — 本地有 {} 个模型", count))
}
