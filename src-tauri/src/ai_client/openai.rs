//! OpenAI-compatible chat completions endpoint.
//! Covers: OpenAI / DeepSeek / LM Studio / Azure (with custom endpoint).

use std::time::Duration;

use async_trait::async_trait;
use futures::StreamExt;

use crate::ai_client::{
    status_to_error, AiError, AiProvider, Message, ModelConfig, TokenStream,
};

const TEST_TIMEOUT: Duration = Duration::from_secs(15);
const STREAM_TIMEOUT: Duration = Duration::from_secs(30);

pub struct OpenAiCompatible {
    api_key: String,
}

impl OpenAiCompatible {
    pub fn new(api_key: String) -> Self {
        Self { api_key }
    }
}

#[async_trait]
impl AiProvider for OpenAiCompatible {
    async fn chat_stream(
        &self,
        messages: Vec<Message>,
        config: &ModelConfig,
    ) -> Result<TokenStream, AiError> {
        let url = format!(
            "{}/chat/completions",
            config.endpoint.trim_end_matches('/')
        );
        let body = serde_json::json!({
            "model": config.model_id,
            "messages": messages,
            "stream": true,
            "max_tokens": config.max_tokens,
        });

        let client = reqwest::Client::builder()
            .timeout(STREAM_TIMEOUT)
            .build()
            .map_err(AiError::from)?;

        let resp = client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
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
        let token_stream = parse_openai_sse(byte_stream);
        Ok(Box::pin(token_stream))
    }
}

/// Build a token stream from a raw SSE byte stream.
/// SSE format:
///   data: {"choices":[{"delta":{"content":"..."}}]}\n
///   data: [DONE]\n
fn parse_openai_sse<S>(byte_stream: S) -> impl futures::Stream<Item = Result<String, AiError>>
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
                        match parse_openai_line(line.trim()) {
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

impl PartialEq for AiError {
    fn eq(&self, other: &Self) -> bool {
        std::mem::discriminant(self) == std::mem::discriminant(other)
    }
}

fn parse_openai_line(line: &str) -> ParseLineResult {
    let Some(data) = line.strip_prefix("data: ") else {
        return ParseLineResult::Skip;
    };
    if data == "[DONE]" {
        return ParseLineResult::Done;
    }
    match serde_json::from_str::<serde_json::Value>(data) {
        Ok(json) => json
            .pointer("/choices/0/delta/content")
            .and_then(|v| v.as_str())
            .map(|s| ParseLineResult::Token(s.to_string()))
            .unwrap_or(ParseLineResult::Skip),
        Err(e) => ParseLineResult::Err(AiError::Parse(e.to_string())),
    }
}

// ============================================================
// Sync test_connection (kept from earlier — non-streaming probe)
// ============================================================

pub async fn test_connection(
    endpoint: &str,
    model_id: &str,
    api_key: &str,
) -> Result<String, String> {
    let url = format!("{}/chat/completions", endpoint.trim_end_matches('/'));
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

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use bytes::Bytes;

    fn cfg(endpoint: &str) -> ModelConfig {
        ModelConfig {
            id: "test".into(),
            name: "test".into(),
            provider: "openai".into(),
            endpoint: endpoint.into(),
            model_id: "gpt-test".into(),
            max_tokens: 100,
            is_default: false,
            keychain_ref: None,
            created_at: String::new(),
            updated_at: String::new(),
        }
    }

    #[test]
    fn parses_content_line() {
        let line = r#"data: {"choices":[{"delta":{"content":"Hello"}}]}"#;
        assert_eq!(
            parse_openai_line(line),
            ParseLineResult::Token("Hello".into())
        );
    }

    #[test]
    fn done_marker_terminates() {
        assert_eq!(parse_openai_line("data: [DONE]"), ParseLineResult::Done);
    }

    #[test]
    fn empty_or_blank_lines_skip() {
        assert_eq!(parse_openai_line(""), ParseLineResult::Skip);
        assert_eq!(parse_openai_line(": keep-alive"), ParseLineResult::Skip);
    }

    #[test]
    fn no_content_in_delta_skips() {
        let line = r#"data: {"choices":[{"delta":{"role":"assistant"}}]}"#;
        assert_eq!(parse_openai_line(line), ParseLineResult::Skip);
    }

    #[test]
    fn malformed_json_yields_parse_err() {
        let r = parse_openai_line("data: {not json}");
        assert!(matches!(r, ParseLineResult::Err(_)));
    }

    fn make_byte_stream(
        chunks: Vec<&'static str>,
    ) -> impl futures::Stream<Item = Result<Bytes, reqwest::Error>> + Unpin {
        Box::pin(futures::stream::iter(
            chunks.into_iter().map(|s| Ok(Bytes::from_static(s.as_bytes()))),
        ))
    }

    #[tokio::test]
    async fn stream_assembles_tokens_across_chunks() {
        // Split a single SSE event across two byte chunks
        let stream = make_byte_stream(vec![
            "data: {\"choices\":[{\"delta\":{\"content\":\"He\"}}]}\n\n",
            "data: {\"choices\":[{\"delta\":{\"content\":\"llo\"}}]}\n\n",
            "data: [DONE]\n\n",
        ]);
        let tokens: Vec<String> = parse_openai_sse(stream)
            .filter_map(|r| async move { r.ok() })
            .collect()
            .await;
        assert_eq!(tokens, vec!["He", "llo"]);
    }

    #[tokio::test]
    async fn stream_handles_partial_lines_in_chunks() {
        // Line broken in the middle
        let stream = make_byte_stream(vec![
            "data: {\"choices\":[{\"delta\":{\"con",
            "tent\":\"X\"}}]}\n\ndata: [DONE]\n\n",
        ]);
        let tokens: Vec<String> = parse_openai_sse(stream)
            .filter_map(|r| async move { r.ok() })
            .collect()
            .await;
        assert_eq!(tokens, vec!["X"]);
    }

    #[tokio::test]
    async fn http_streaming_round_trip_via_mockito() {
        let mut server = mockito::Server::new_async().await;
        let body = "data: {\"choices\":[{\"delta\":{\"content\":\"Hello\"}}]}\n\
                    \n\
                    data: {\"choices\":[{\"delta\":{\"content\":\" world\"}}]}\n\
                    \n\
                    data: [DONE]\n\n";
        let mock = server
            .mock("POST", "/chat/completions")
            .with_status(200)
            .with_header("content-type", "text/event-stream")
            .with_body(body)
            .create_async()
            .await;

        let provider = OpenAiCompatible::new("test-key".into());
        let mut stream = provider
            .chat_stream(
                vec![Message {
                    role: "user".into(),
                    content: "Hi".into(),
                }],
                &cfg(&server.url()),
            )
            .await
            .expect("chat_stream open");

        let mut acc = String::new();
        while let Some(chunk) = stream.next().await {
            acc.push_str(&chunk.expect("token ok"));
        }
        assert_eq!(acc, "Hello world");
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn http_401_maps_to_unauthorized() {
        let mut server = mockito::Server::new_async().await;
        let _m = server
            .mock("POST", "/chat/completions")
            .with_status(401)
            .with_body(r#"{"error":"invalid api key"}"#)
            .create_async()
            .await;

        let provider = OpenAiCompatible::new("bad-key".into());
        let result = provider
            .chat_stream(vec![], &cfg(&server.url()))
            .await;
        assert!(matches!(result, Err(AiError::Unauthorized)));
    }

    #[tokio::test]
    async fn http_429_maps_to_rate_limited() {
        let mut server = mockito::Server::new_async().await;
        let _m = server
            .mock("POST", "/chat/completions")
            .with_status(429)
            .with_body(r#"{"error":"slow down"}"#)
            .create_async()
            .await;

        let provider = OpenAiCompatible::new("k".into());
        let result = provider
            .chat_stream(vec![], &cfg(&server.url()))
            .await;
        assert!(matches!(result, Err(AiError::RateLimited)));
    }
}
