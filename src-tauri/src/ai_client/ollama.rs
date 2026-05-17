//! Ollama local API.
//! Streaming uses NDJSON (newline-delimited JSON):
//!   {"model":"...", "message":{"role":"assistant","content":"Hello"}, "done":false}
//!   {"model":"...", "message":{"role":"assistant","content":""}, "done":true, "eval_count":...}

use std::time::Duration;

use async_trait::async_trait;
use futures::StreamExt;

use crate::ai_client::{
    status_to_error, AiError, AiProvider, Message, ModelConfig, TokenStream,
};

const TEST_TIMEOUT: Duration = Duration::from_secs(5);
const STREAM_TIMEOUT: Duration = Duration::from_secs(1800); // 30 min
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);

pub struct OllamaProvider;

#[async_trait]
impl AiProvider for OllamaProvider {
    async fn chat_stream(
        &self,
        messages: Vec<Message>,
        config: &ModelConfig,
    ) -> Result<TokenStream, AiError> {
        let url = format!("{}/api/chat", config.endpoint.trim_end_matches('/'));
        let body = serde_json::json!({
            "model": config.model_id,
            "messages": messages,
            "stream": true,
        });

        let client = reqwest::Client::builder()
            .timeout(STREAM_TIMEOUT)
            .connect_timeout(CONNECT_TIMEOUT)
            .build()
            .map_err(AiError::from)?;

        let resp = client
            .post(&url)
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
        Ok(Box::pin(parse_ollama_ndjson(byte_stream)))
    }
}

fn parse_ollama_ndjson<S>(
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
                        match parse_ollama_line(line.trim()) {
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

fn parse_ollama_line(line: &str) -> ParseLineResult {
    if line.is_empty() {
        return ParseLineResult::Skip;
    }
    let json: serde_json::Value = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(e) => return ParseLineResult::Err(AiError::Parse(e.to_string())),
    };
    let done = json.get("done").and_then(|v| v.as_bool()).unwrap_or(false);
    let text = json
        .pointer("/message/content")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if !text.is_empty() {
        if done {
            // Final chunk may carry a trailing token + done=true.
            // Yield the token first, then the next iteration sees no more lines and ends.
            // (We don't explicitly emit Done after Token; the stream will simply close.)
            return ParseLineResult::Token(text.to_string());
        }
        ParseLineResult::Token(text.to_string())
    } else if done {
        ParseLineResult::Done
    } else {
        ParseLineResult::Skip
    }
}

// ============================================================
// Sync test_connection
// ============================================================

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
            provider: "ollama".into(),
            endpoint: endpoint.into(),
            model_id: "llama3:8b".into(),
            max_tokens: 100,
            is_default: false,
            keychain_ref: None,
            created_at: String::new(),
            updated_at: String::new(),
            input_price_per_1m_tokens: 0.0,
            output_price_per_1m_tokens: 0.0,
        }
    }

    #[test]
    fn parses_chunk_with_content() {
        let line = r#"{"model":"x","message":{"role":"assistant","content":"Hello"},"done":false}"#;
        assert_eq!(
            parse_ollama_line(line),
            ParseLineResult::Token("Hello".into())
        );
    }

    #[test]
    fn final_done_with_no_content_terminates() {
        let line = r#"{"done":true,"eval_count":50}"#;
        assert_eq!(parse_ollama_line(line), ParseLineResult::Done);
    }

    #[test]
    fn empty_line_skips() {
        assert_eq!(parse_ollama_line(""), ParseLineResult::Skip);
    }

    #[test]
    fn malformed_json_yields_parse_err() {
        let r = parse_ollama_line("{not valid");
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
    async fn stream_assembles_tokens_until_done() {
        let stream = make_byte_stream(vec![
            r#"{"message":{"content":"He"},"done":false}"#,
            "\n",
            r#"{"message":{"content":"llo"},"done":false}"#,
            "\n",
            r#"{"done":true}"#,
            "\n",
        ]);
        let tokens: Vec<String> = parse_ollama_ndjson(stream)
            .filter_map(|r| async move { r.ok() })
            .collect()
            .await;
        assert_eq!(tokens, vec!["He", "llo"]);
    }

    #[tokio::test]
    async fn http_streaming_round_trip_via_mockito() {
        let mut server = mockito::Server::new_async().await;
        let body = "{\"model\":\"x\",\"message\":{\"role\":\"assistant\",\"content\":\"Hello\"},\"done\":false}\n\
                    {\"model\":\"x\",\"message\":{\"role\":\"assistant\",\"content\":\" world\"},\"done\":false}\n\
                    {\"model\":\"x\",\"done\":true,\"eval_count\":2}\n";
        let mock = server
            .mock("POST", "/api/chat")
            .with_status(200)
            .with_header("content-type", "application/x-ndjson")
            .with_body(body)
            .create_async()
            .await;
        let provider = OllamaProvider;
        let mut stream = provider
            .chat_stream(
                vec![Message {
                    role: "user".into(),
                    content: "Hi".into(),
                }],
                &cfg(&server.url()),
            )
            .await
            .unwrap();
        let mut acc = String::new();
        while let Some(c) = stream.next().await {
            acc.push_str(&c.unwrap());
        }
        assert_eq!(acc, "Hello world");
        mock.assert_async().await;
    }
}
