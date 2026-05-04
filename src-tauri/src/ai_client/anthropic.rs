//! Anthropic Messages API.
//! Streaming SSE format with named events:
//!   event: content_block_delta
//!   data: {"type":"content_block_delta", "index":0, "delta":{"type":"text_delta","text":"..."}}
//!
//! We just look for any `data: ...` line whose JSON has type=content_block_delta
//! and extract `delta.text` — no need to track event-name lines explicitly.

use std::time::Duration;

use async_trait::async_trait;
use futures::StreamExt;

use crate::ai_client::{
    status_to_error, AiError, AiProvider, Message, ModelConfig, TokenStream,
};

const TEST_TIMEOUT: Duration = Duration::from_secs(15);
const STREAM_TIMEOUT: Duration = Duration::from_secs(30);
const ANTHROPIC_VERSION: &str = "2023-06-01";

pub struct AnthropicProvider {
    api_key: String,
}

impl AnthropicProvider {
    pub fn new(api_key: String) -> Self {
        Self { api_key }
    }
}

#[async_trait]
impl AiProvider for AnthropicProvider {
    async fn chat_stream(
        &self,
        messages: Vec<Message>,
        config: &ModelConfig,
    ) -> Result<TokenStream, AiError> {
        let url = format!("{}/v1/messages", config.endpoint.trim_end_matches('/'));

        // Anthropic separates `system` from `messages`
        let (system, msgs): (Vec<_>, Vec<_>) =
            messages.into_iter().partition(|m| m.role == "system");
        let system_str: String = system
            .into_iter()
            .map(|m| m.content)
            .collect::<Vec<_>>()
            .join("\n\n");

        let mut body = serde_json::json!({
            "model": config.model_id,
            "max_tokens": config.max_tokens,
            "stream": true,
            "messages": msgs,
        });
        if !system_str.is_empty() {
            body["system"] = serde_json::Value::String(system_str);
        }

        let client = reqwest::Client::builder()
            .timeout(STREAM_TIMEOUT)
            .build()
            .map_err(AiError::from)?;

        let resp = client
            .post(&url)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(AiError::from)?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(status_to_error(status, body));
        }

        let byte_stream = resp.bytes_stream();
        Ok(Box::pin(parse_anthropic_sse(byte_stream)))
    }
}

fn parse_anthropic_sse<S>(
    byte_stream: S,
) -> impl futures::Stream<Item = Result<String, AiError>>
where
    S: futures::Stream<Item = Result<bytes::Bytes, reqwest::Error>> + Send + 'static + Unpin,
{
    async_stream::stream! {
        let mut byte_stream = byte_stream;
        let mut buffer = String::new();
        loop {
            match byte_stream.next().await {
                Some(Ok(chunk)) => {
                    buffer.push_str(&String::from_utf8_lossy(&chunk));
                    while let Some(nl) = buffer.find('\n') {
                        let line: String = buffer.drain(..=nl).collect();
                        match parse_anthropic_line(line.trim()) {
                            ParseLineResult::Token(t) => yield Ok(t),
                            ParseLineResult::Done => return,
                            ParseLineResult::Skip => {}
                            ParseLineResult::Err(e) => yield Err(e),
                        }
                    }
                }
                Some(Err(e)) => {
                    yield Err(AiError::from(e));
                    return;
                }
                None => return,
            }
        }
    }
}

#[derive(Debug, PartialEq)]
enum ParseLineResult {
    Token(String),
    Done,
    Skip,
    Err(AiError),
}

fn parse_anthropic_line(line: &str) -> ParseLineResult {
    let Some(data) = line.strip_prefix("data: ") else {
        return ParseLineResult::Skip;
    };
    let json: serde_json::Value = match serde_json::from_str(data) {
        Ok(v) => v,
        Err(e) => return ParseLineResult::Err(AiError::Parse(e.to_string())),
    };
    let event_type = json.get("type").and_then(|v| v.as_str()).unwrap_or("");
    match event_type {
        "content_block_delta" => json
            .pointer("/delta/text")
            .and_then(|v| v.as_str())
            .map(|s| ParseLineResult::Token(s.to_string()))
            .unwrap_or(ParseLineResult::Skip),
        "message_stop" => ParseLineResult::Done,
        _ => ParseLineResult::Skip,
    }
}

// ============================================================
// Sync test_connection
// ============================================================

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
    let content = json
        .pointer("/content/0/text")
        .and_then(|v| v.as_str())
        .unwrap_or("(empty response)")
        .trim()
        .to_string();
    Ok(content)
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn cfg(endpoint: &str) -> ModelConfig {
        ModelConfig {
            id: "test".into(),
            name: "test".into(),
            provider: "anthropic".into(),
            endpoint: endpoint.into(),
            model_id: "claude-test".into(),
            max_tokens: 100,
            is_default: false,
            keychain_ref: None,
            created_at: String::new(),
            updated_at: String::new(),
        }
    }

    #[test]
    fn parses_content_block_delta() {
        let line = r#"data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}"#;
        assert_eq!(
            parse_anthropic_line(line),
            ParseLineResult::Token("Hello".into())
        );
    }

    #[test]
    fn ignores_non_content_events() {
        let line = r#"data: {"type":"message_start","message":{"id":"m1"}}"#;
        assert_eq!(parse_anthropic_line(line), ParseLineResult::Skip);
    }

    #[test]
    fn ignores_event_name_line() {
        assert_eq!(
            parse_anthropic_line("event: content_block_delta"),
            ParseLineResult::Skip
        );
    }

    #[test]
    fn message_stop_terminates() {
        let line = r#"data: {"type":"message_stop"}"#;
        assert_eq!(parse_anthropic_line(line), ParseLineResult::Done);
    }

    #[tokio::test]
    async fn http_streaming_round_trip_via_mockito() {
        let mut server = mockito::Server::new_async().await;
        let body = concat!(
            "event: message_start\n",
            "data: {\"type\":\"message_start\",\"message\":{\"id\":\"m\"}}\n\n",
            "event: content_block_start\n",
            "data: {\"type\":\"content_block_start\",\"index\":0}\n\n",
            "event: content_block_delta\n",
            "data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"Hello\"}}\n\n",
            "event: content_block_delta\n",
            "data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\" world\"}}\n\n",
            "event: message_stop\n",
            "data: {\"type\":\"message_stop\"}\n\n"
        );
        let mock = server
            .mock("POST", "/v1/messages")
            .match_header("x-api-key", "test-key")
            .match_header("anthropic-version", ANTHROPIC_VERSION)
            .with_status(200)
            .with_header("content-type", "text/event-stream")
            .with_body(body)
            .create_async()
            .await;

        let provider = AnthropicProvider::new("test-key".into());
        let mut stream = provider
            .chat_stream(
                vec![Message {
                    role: "user".into(),
                    content: "Hi".into(),
                }],
                &cfg(&server.url()),
            )
            .await
            .expect("open stream");
        let mut acc = String::new();
        while let Some(c) = stream.next().await {
            acc.push_str(&c.unwrap());
        }
        assert_eq!(acc, "Hello world");
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn http_401_maps_to_unauthorized() {
        let mut server = mockito::Server::new_async().await;
        let _m = server
            .mock("POST", "/v1/messages")
            .with_status(401)
            .with_body("{}")
            .create_async()
            .await;
        let provider = AnthropicProvider::new("bad".into());
        let r = provider.chat_stream(vec![], &cfg(&server.url())).await;
        assert!(matches!(r, Err(AiError::Unauthorized)));
    }

    #[tokio::test]
    async fn system_message_is_separated_from_user_messages() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/v1/messages")
            .match_body(mockito::Matcher::JsonString(
                r#"{
                  "model": "claude-test",
                  "max_tokens": 100,
                  "stream": true,
                  "messages": [{"role":"user","content":"Hi"}],
                  "system": "You are helpful."
                }"#
                .into(),
            ))
            .with_status(200)
            .with_body("data: {\"type\":\"message_stop\"}\n\n")
            .create_async()
            .await;

        let provider = AnthropicProvider::new("k".into());
        let mut stream = provider
            .chat_stream(
                vec![
                    Message {
                        role: "system".into(),
                        content: "You are helpful.".into(),
                    },
                    Message {
                        role: "user".into(),
                        content: "Hi".into(),
                    },
                ],
                &cfg(&server.url()),
            )
            .await
            .unwrap();
        while stream.next().await.is_some() {}
        mock.assert_async().await;
    }
}
