//! Anthropic Messages API.

use std::time::Duration;

const TEST_TIMEOUT: Duration = Duration::from_secs(15);
const ANTHROPIC_VERSION: &str = "2023-06-01";

pub async fn test_connection(
    endpoint: &str,
    model_id: &str,
    api_key: &str,
) -> Result<String, String> {
    let url = format!("{}/v1/messages", endpoint.trim_end_matches('/'));
    let body = serde_json::json!({
        "model": model_id,
        "max_tokens": 5,
        "messages": [{"role": "user", "content": "Hi"}],
    });

    let client = reqwest::Client::builder()
        .timeout(TEST_TIMEOUT)
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .post(&url)
        .header("x-api-key", api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        let snippet: String = body.chars().take(200).collect();
        return Err(format!("HTTP {} — {}", status, snippet));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("parse json: {}", e))?;

    // Anthropic response: { "content": [{ "type": "text", "text": "..." }] }
    let content = json
        .pointer("/content/0/text")
        .and_then(|v| v.as_str())
        .unwrap_or("(empty response)")
        .trim()
        .to_string();
    Ok(content)
}
