//! OpenAI-compatible chat completions endpoint.
//! Covers: OpenAI / DeepSeek / LM Studio / Azure (with custom endpoint).

use std::time::Duration;

const TEST_TIMEOUT: Duration = Duration::from_secs(15);

pub async fn test_connection(
    endpoint: &str,
    model_id: &str,
    api_key: &str,
) -> Result<String, String> {
    let url = format!(
        "{}/chat/completions",
        endpoint.trim_end_matches('/')
    );
    let body = serde_json::json!({
        "model": model_id,
        "messages": [{"role": "user", "content": "Hi"}],
        "max_tokens": 5,
    });

    let client = reqwest::Client::builder()
        .timeout(TEST_TIMEOUT)
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
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

    let content = json
        .pointer("/choices/0/message/content")
        .and_then(|v| v.as_str())
        .unwrap_or("(empty response)")
        .trim()
        .to_string();
    Ok(content)
}
