//! V2.2.1 — regression baseline for "AI parse fails on non-default models".
//!
//! The Session 25 bug report: "AI 解析只在使用默认模型时成功,切换到非默认模型
//! (GPT-5/DeepSeek/Ollama)时解析失败或无输出。"
//!
//! Code audit (Session 25, Phase 1) found no obvious bug in the routing /
//! SSE / NDJSON parsing paths — see the existing in-file `#[cfg(test)] mod
//! tests` in openai.rs / anthropic.rs / ollama.rs for parser-level coverage.
//!
//! These tests pin the **integration contract** at the `provider_for` →
//! `chat_stream` boundary for ALL THREE provider kinds, so any future
//! regression that breaks one provider (but not the others) will fail
//! loudly and a `cargo test` matrix will pinpoint which.
//!
//! What we test:
//!  1. `provider_for("anthropic" | "openai" | "custom" | "ollama" | unknown)`
//!     returns the right concrete impl, and "unknown" surfaces `UnknownProvider`.
//!  2. Each impl, against a mocked endpoint, streams tokens end-to-end and
//!     concatenates to the expected payload.
//!  3. HTTP error mapping (401 → Unauthorized, 429 → RateLimited) is
//!     consistent across openai / anthropic.
//!  4. The dispatch reads `config.provider` — not `config.is_default` — so
//!     a non-default model still goes through its own provider impl.
//!
//! What we do NOT test:
//!  - Tauri command surface (`start_parse` / `ai_chat_stream` /
//!    `skill_test_run`): those wrap the same boundary tested here.
//!  - Real network roundtrip: covered by manual QA per `SESSION_TASKS.md`
//!    Session 25 §1 test matrix.

use app_lib::ai_client::{provider_for, AiError, Message, ModelConfig};
use futures::StreamExt;

fn cfg(provider: &str, endpoint: &str, model_id: &str, is_default: bool) -> ModelConfig {
    ModelConfig {
        id: format!("test-{}", provider),
        name: format!("Test {}", provider),
        provider: provider.into(),
        endpoint: endpoint.into(),
        model_id: model_id.into(),
        max_tokens: 128,
        is_default,
        keychain_ref: None,
        created_at: String::new(),
        updated_at: String::new(),
        input_price_per_1m_tokens: 0.0,
        output_price_per_1m_tokens: 0.0,
        // V006 (Session 29) — defaults for non-SG-AI-Store providers.
        is_sg_ai_store: false,
        balance_cny: None,
        remaining_tokens: None,
        subscription_expires_at: None,
        balance_synced_at: None,
    }
}

fn one_user(msg: &str) -> Vec<Message> {
    vec![Message {
        role: "user".into(),
        content: msg.into(),
    }]
}

// --------------------------------------------------------------------------
// 1. provider_for dispatch — covers anthropic / openai / custom / ollama / unknown
// --------------------------------------------------------------------------

#[test]
fn provider_for_dispatch_matrix() {
    assert!(provider_for("anthropic", Some("k".into())).is_ok());
    assert!(provider_for("openai", Some("k".into())).is_ok());
    assert!(provider_for("custom", Some("k".into())).is_ok());
    assert!(provider_for("ollama", None).is_ok());

    // Unknown providers must surface explicitly, not silently fall back.
    match provider_for("nonesuch", None) {
        Err(AiError::UnknownProvider(s)) => assert_eq!(s, "nonesuch"),
        Err(other) => panic!("expected UnknownProvider, got Err({:?})", other),
        Ok(_) => panic!("expected UnknownProvider, got Ok(_)"),
    }
}

#[test]
fn provider_for_ignores_is_default_field() {
    // Pure smoke: provider_for takes a `&str` (the provider field), not
    // the full ModelConfig — so dispatch CAN'T short-circuit on
    // `is_default`. This guards against any future refactor that starts
    // switching on `is_default` (the Session 25 bug hypothesis).
    //
    // The test passes if both calls succeed and produce a usable provider.
    // (We can't compare trait-object identity at the Box<dyn …> layer
    //  because the concrete type is erased.)
    assert!(provider_for("openai", Some("k".into())).is_ok());
    assert!(provider_for("openai", None).is_ok()); // No key is also fine at dispatch time;
                                                    // the provider will fail later with NoApiKey.
    assert!(provider_for("anthropic", Some("k".into())).is_ok());
}

// --------------------------------------------------------------------------
// 2. Stream roundtrip per provider (mocked endpoint)
// --------------------------------------------------------------------------

#[tokio::test]
async fn openai_stream_roundtrip_non_default_model() {
    let mut server = mockito::Server::new_async().await;
    let body = "data: {\"choices\":[{\"delta\":{\"content\":\"Hello\"}}]}\n\n\
                data: {\"choices\":[{\"delta\":{\"content\":\" GPT\"}}]}\n\n\
                data: [DONE]\n\n";
    let mock = server
        .mock("POST", "/chat/completions")
        .with_status(200)
        .with_header("content-type", "text/event-stream")
        .with_body(body)
        .create_async()
        .await;

    // is_default=false — this is the exact case the user reported failing.
    let config = cfg("openai", &server.url(), "gpt-5", false);
    let provider = provider_for(&config.provider, Some("test-key".into())).unwrap();
    let mut stream = provider.chat_stream(one_user("Hi"), &config).await.unwrap();

    let mut acc = String::new();
    while let Some(c) = stream.next().await {
        acc.push_str(&c.expect("token ok"));
    }
    assert_eq!(acc, "Hello GPT");
    mock.assert_async().await;
}

#[tokio::test]
async fn anthropic_stream_roundtrip_default_model() {
    let mut server = mockito::Server::new_async().await;
    let body = "data: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\"Hi\"}}\n\n\
                data: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\" Claude\"}}\n\n\
                data: {\"type\":\"message_stop\"}\n\n";
    let mock = server
        .mock("POST", "/v1/messages")
        .with_status(200)
        .with_header("content-type", "text/event-stream")
        .with_body(body)
        .create_async()
        .await;

    // is_default=true — control case from the user's bug report.
    let config = cfg("anthropic", &server.url(), "claude-opus-4-7", true);
    let provider = provider_for(&config.provider, Some("test-key".into())).unwrap();
    let mut stream = provider.chat_stream(one_user("Hi"), &config).await.unwrap();

    let mut acc = String::new();
    while let Some(c) = stream.next().await {
        acc.push_str(&c.expect("token ok"));
    }
    assert_eq!(acc, "Hi Claude");
    mock.assert_async().await;
}

#[tokio::test]
async fn ollama_stream_roundtrip_non_default_model() {
    let mut server = mockito::Server::new_async().await;
    let body = "{\"model\":\"llama3:8b\",\"message\":{\"role\":\"assistant\",\"content\":\"Hello\"},\"done\":false}\n\
                {\"model\":\"llama3:8b\",\"message\":{\"role\":\"assistant\",\"content\":\" local\"},\"done\":false}\n\
                {\"model\":\"llama3:8b\",\"done\":true,\"eval_count\":2}\n";
    let mock = server
        .mock("POST", "/api/chat")
        .with_status(200)
        .with_header("content-type", "application/x-ndjson")
        .with_body(body)
        .create_async()
        .await;

    let config = cfg("ollama", &server.url(), "llama3:8b", false);
    let provider = provider_for(&config.provider, None).unwrap();
    let mut stream = provider.chat_stream(one_user("Hi"), &config).await.unwrap();

    let mut acc = String::new();
    while let Some(c) = stream.next().await {
        acc.push_str(&c.expect("token ok"));
    }
    assert_eq!(acc, "Hello local");
    mock.assert_async().await;
}

// --------------------------------------------------------------------------
// 3. Provider-agnostic HTTP error mapping
// --------------------------------------------------------------------------

#[tokio::test]
async fn openai_401_maps_to_unauthorized() {
    let mut server = mockito::Server::new_async().await;
    let _m = server
        .mock("POST", "/chat/completions")
        .with_status(401)
        .with_body(r#"{"error":"bad key"}"#)
        .create_async()
        .await;

    let config = cfg("openai", &server.url(), "gpt-5", false);
    let provider = provider_for(&config.provider, Some("bad".into())).unwrap();
    match provider.chat_stream(one_user("hi"), &config).await {
        Err(AiError::Unauthorized) => {}
        Err(other) => panic!("expected Unauthorized, got Err({:?})", other),
        Ok(_) => panic!("expected Unauthorized, got Ok(stream)"),
    }
}

#[tokio::test]
async fn anthropic_429_maps_to_rate_limited() {
    let mut server = mockito::Server::new_async().await;
    let _m = server
        .mock("POST", "/v1/messages")
        .with_status(429)
        .with_body(r#"{"error":"slow"}"#)
        .create_async()
        .await;

    let config = cfg("anthropic", &server.url(), "claude-opus-4-7", true);
    let provider = provider_for(&config.provider, Some("k".into())).unwrap();
    match provider.chat_stream(one_user("hi"), &config).await {
        Err(AiError::RateLimited) => {}
        Err(other) => panic!("expected RateLimited, got Err({:?})", other),
        Ok(_) => panic!("expected RateLimited, got Ok(stream)"),
    }
}

// --------------------------------------------------------------------------
// 4. Matrix style — same 3-message conversation against all 3 providers
//    to surface any provider that silently drops the request.
// --------------------------------------------------------------------------

#[tokio::test]
async fn three_provider_matrix_all_yield_tokens() {
    // openai
    let mut openai_srv = mockito::Server::new_async().await;
    openai_srv
        .mock("POST", "/chat/completions")
        .with_status(200)
        .with_body("data: {\"choices\":[{\"delta\":{\"content\":\"OK\"}}]}\n\ndata: [DONE]\n\n")
        .create_async()
        .await;

    // anthropic
    let mut anthr_srv = mockito::Server::new_async().await;
    anthr_srv
        .mock("POST", "/v1/messages")
        .with_status(200)
        .with_body(
            "data: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\"OK\"}}\n\n\
             data: {\"type\":\"message_stop\"}\n\n",
        )
        .create_async()
        .await;

    // ollama
    let mut ollama_srv = mockito::Server::new_async().await;
    ollama_srv
        .mock("POST", "/api/chat")
        .with_status(200)
        .with_body(
            "{\"message\":{\"content\":\"OK\"},\"done\":false}\n\
             {\"done\":true}\n",
        )
        .create_async()
        .await;

    let matrix = vec![
        (cfg("openai", &openai_srv.url(), "gpt-5", false), Some("k")),
        (
            cfg("anthropic", &anthr_srv.url(), "claude-opus-4-7", true),
            Some("k"),
        ),
        (cfg("ollama", &ollama_srv.url(), "llama3:8b", false), None),
    ];

    for (config, key) in matrix {
        let provider = match provider_for(&config.provider, key.map(String::from)) {
            Ok(p) => p,
            Err(e) => panic!("provider_for({}) failed: {:?}", config.provider, e),
        };
        let mut stream = match provider.chat_stream(one_user("hi"), &config).await {
            Ok(s) => s,
            Err(e) => panic!(
                "chat_stream({}, default={}) failed: {:?}",
                config.provider, config.is_default, e
            ),
        };
        let mut acc = String::new();
        while let Some(c) = stream.next().await {
            acc.push_str(&c.expect("token ok"));
        }
        assert_eq!(
            acc, "OK",
            "provider={} default={} streamed an empty response (regression of Session 25 bug)",
            config.provider, config.is_default
        );
    }
}
