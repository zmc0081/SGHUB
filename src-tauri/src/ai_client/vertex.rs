//! V2.2.8 — Google Vertex AI (Gemini) via Application Default Credentials.
//!
//! No API key is ever stored: credentials are discovered locally (the ADC
//! chain), exchanged for a short-lived OAuth access token, and the token is
//! cached in memory + auto-refreshed 5 minutes before expiry — token expiry
//! never needs manual intervention.
//!
//! ADC chain (in order):
//!   1. `GOOGLE_APPLICATION_CREDENTIALS` env var → service-account JSON file
//!   2. gcloud user ADC file:
//!      - Windows: `%APPDATA%\gcloud\application_default_credentials.json`
//!      - macOS/Linux: `~/.config/gcloud/application_default_credentials.json`
//!
//! Token exchange:
//!   - `authorized_user` → refresh_token grant against oauth2.googleapis.com
//!   - `service_account` → RS256-signed JWT assertion against `token_uri`
//!     (scope: https://www.googleapis.com/auth/cloud-platform)
//!
//! Corporate proxies: when `ModelConfig.proxy_url` is set, BOTH the token
//! exchange and the model call go through it (http/https/socks5 via
//! `reqwest::Proxy::all`).

use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use async_trait::async_trait;
use futures::StreamExt;
use serde::Serialize;

use crate::ai_client::{AiError, AiProvider, Message, ModelConfig, TokenStream};

const TEST_TIMEOUT: Duration = Duration::from_secs(20);
const STREAM_TIMEOUT: Duration = Duration::from_secs(1800); // 30 min
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
/// Refresh the cached token this long before its actual expiry.
const REFRESH_MARGIN: Duration = Duration::from_secs(300);
const CLOUD_SCOPE: &str = "https://www.googleapis.com/auth/cloud-platform";
const OAUTH_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
/// Gemini's hard cap for maxOutputTokens.
const MAX_OUTPUT_CAP: i32 = 65536;

/// User-facing hint when no local ADC credentials can be found.
pub(crate) const ADC_MISSING_HINT: &str =
    "未找到本地 ADC 凭证,请先运行:gcloud auth application-default login 完成本地登录授权";

pub struct VertexProvider;

// ============================================================
// Credentials (ADC chain)
// ============================================================

#[derive(Debug, Clone, PartialEq)]
enum Credentials {
    AuthorizedUser {
        client_id: String,
        client_secret: String,
        refresh_token: String,
    },
    ServiceAccount {
        client_email: String,
        private_key: String,
        token_uri: String,
    },
}

/// Default gcloud user-ADC file location for this platform.
fn default_adc_path() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var_os("APPDATA").map(|d| {
            PathBuf::from(d)
                .join("gcloud")
                .join("application_default_credentials.json")
        })
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var_os("HOME").map(|d| {
            PathBuf::from(d)
                .join(".config")
                .join("gcloud")
                .join("application_default_credentials.json")
        })
    }
}

fn parse_credentials_json(text: &str) -> Result<Credentials, String> {
    let v: serde_json::Value =
        serde_json::from_str(text).map_err(|e| format!("凭证 JSON 解析失败: {}", e))?;
    let get = |k: &str| v.get(k).and_then(|x| x.as_str()).map(String::from);
    match v.get("type").and_then(|t| t.as_str()) {
        Some("authorized_user") => Ok(Credentials::AuthorizedUser {
            client_id: get("client_id").ok_or("凭证缺少 client_id")?,
            client_secret: get("client_secret").ok_or("凭证缺少 client_secret")?,
            refresh_token: get("refresh_token").ok_or("凭证缺少 refresh_token")?,
        }),
        Some("service_account") => Ok(Credentials::ServiceAccount {
            client_email: get("client_email").ok_or("凭证缺少 client_email")?,
            private_key: get("private_key").ok_or("凭证缺少 private_key")?,
            token_uri: get("token_uri").unwrap_or_else(|| OAUTH_TOKEN_URL.to_string()),
        }),
        other => Err(format!("不支持的凭证类型: {:?}", other)),
    }
}

/// Walk the ADC chain and load credentials. Errors carry the gcloud hint.
fn load_credentials() -> Result<Credentials, String> {
    // 1. Explicit env var (service-account JSON path)
    if let Some(p) = std::env::var_os("GOOGLE_APPLICATION_CREDENTIALS") {
        let p = PathBuf::from(p);
        let text = std::fs::read_to_string(&p).map_err(|e| {
            format!(
                "GOOGLE_APPLICATION_CREDENTIALS 指向的文件无法读取 ({}): {}",
                p.display(),
                e
            )
        })?;
        return parse_credentials_json(&text);
    }
    // 2. gcloud user ADC file
    if let Some(p) = default_adc_path() {
        if p.exists() {
            let text = std::fs::read_to_string(&p)
                .map_err(|e| format!("读取 ADC 凭证失败 ({}): {}", p.display(), e))?;
            return parse_credentials_json(&text);
        }
    }
    Err(ADC_MISSING_HINT.to_string())
}

// ============================================================
// Access-token cache + exchange
// ============================================================

struct CachedToken {
    token: String,
    /// Refresh once `Instant::now()` passes this (expiry minus margin).
    refresh_at: Instant,
}

fn token_cache() -> &'static Mutex<Option<CachedToken>> {
    static CELL: OnceLock<Mutex<Option<CachedToken>>> = OnceLock::new();
    CELL.get_or_init(|| Mutex::new(None))
}

#[derive(Serialize)]
struct JwtClaims<'a> {
    iss: &'a str,
    scope: &'a str,
    aud: &'a str,
    iat: u64,
    exp: u64,
}

/// One token exchange against Google's OAuth endpoint.
async fn fetch_token(client: &reqwest::Client, creds: &Credentials) -> Result<(String, u64), String> {
    let resp = match creds {
        Credentials::AuthorizedUser {
            client_id,
            client_secret,
            refresh_token,
        } => {
            client
                .post(OAUTH_TOKEN_URL)
                .form(&[
                    ("grant_type", "refresh_token"),
                    ("client_id", client_id.as_str()),
                    ("client_secret", client_secret.as_str()),
                    ("refresh_token", refresh_token.as_str()),
                ])
                .send()
                .await
        }
        Credentials::ServiceAccount {
            client_email,
            private_key,
            token_uri,
        } => {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| e.to_string())?
                .as_secs();
            let claims = JwtClaims {
                iss: client_email,
                scope: CLOUD_SCOPE,
                aud: token_uri,
                iat: now,
                exp: now + 3600,
            };
            let key = jsonwebtoken::EncodingKey::from_rsa_pem(private_key.as_bytes())
                .map_err(|e| format!("服务账号私钥解析失败: {}", e))?;
            let jwt = jsonwebtoken::encode(
                &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::RS256),
                &claims,
                &key,
            )
            .map_err(|e| format!("JWT 签名失败: {}", e))?;
            client
                .post(token_uri)
                .form(&[
                    ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
                    ("assertion", jwt.as_str()),
                ])
                .send()
                .await
        }
    }
    .map_err(|e| format!("令牌请求失败(网络/代理): {}", e))?;

    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("令牌获取失败 (HTTP {}): {}", status.as_u16(), body));
    }
    let v: serde_json::Value =
        serde_json::from_str(&body).map_err(|e| format!("令牌响应解析失败: {}", e))?;
    let token = v
        .get("access_token")
        .and_then(|t| t.as_str())
        .ok_or("令牌响应缺少 access_token")?
        .to_string();
    let expires_in = v.get("expires_in").and_then(|x| x.as_u64()).unwrap_or(3600);
    Ok((token, expires_in))
}

/// Cached access token; auto-refreshes 5 min before expiry. A failed refresh
/// is retried once before erroring out.
async fn get_access_token(client: &reqwest::Client) -> Result<String, String> {
    if let Ok(cache) = token_cache().lock() {
        if let Some(c) = cache.as_ref() {
            if Instant::now() < c.refresh_at {
                return Ok(c.token.clone());
            }
        }
    }
    let creds = load_credentials()?;
    let (token, expires_in) = match fetch_token(client, &creds).await {
        Ok(t) => t,
        Err(first) => {
            log::warn!("vertex: token fetch failed, retrying once: {}", first);
            fetch_token(client, &creds).await?
        }
    };
    let ttl = Duration::from_secs(expires_in);
    let refresh_at = Instant::now() + ttl.saturating_sub(REFRESH_MARGIN);
    if let Ok(mut cache) = token_cache().lock() {
        *cache = Some(CachedToken {
            token: token.clone(),
            refresh_at,
        });
    }
    Ok(token)
}

// ============================================================
// Request plumbing
// ============================================================

/// reqwest client honouring the per-model proxy (http/https/socks5). Empty →
/// system proxy / direct.
fn build_client(proxy_url: Option<&str>, timeout: Duration) -> Result<reqwest::Client, String> {
    let mut b = reqwest::Client::builder()
        .timeout(timeout)
        .connect_timeout(CONNECT_TIMEOUT);
    if let Some(p) = proxy_url.map(str::trim).filter(|s| !s.is_empty()) {
        let proxy = reqwest::Proxy::all(p).map_err(|e| format!("代理地址无效 ({}): {}", p, e))?;
        b = b.proxy(proxy);
    }
    b.build().map_err(|e| e.to_string())
}

/// Vertex endpoint per the region rule: `global` uses the global host, any
/// other region gets the regional host + path segment.
fn build_url(project: &str, region: &str, model: &str, method: &str) -> String {
    if region.is_empty() || region == "global" {
        format!(
            "https://aiplatform.googleapis.com/v1/projects/{}/locations/global/publishers/google/models/{}:{}",
            project, model, method
        )
    } else {
        format!(
            "https://{}-aiplatform.googleapis.com/v1/projects/{}/locations/{}/publishers/google/models/{}:{}",
            region, project, region, model, method
        )
    }
}

/// Map our message list to a Gemini `generateContent` body: system messages
/// become `systemInstruction`, assistant → role "model", images → inlineData.
fn to_gemini_body(messages: &[Message], max_tokens: i32) -> serde_json::Value {
    let mut system_texts: Vec<&str> = Vec::new();
    let mut contents: Vec<serde_json::Value> = Vec::new();
    for m in messages {
        if m.role == "system" {
            system_texts.push(&m.content);
            continue;
        }
        let role = if m.role == "assistant" { "model" } else { "user" };
        let mut parts = Vec::new();
        if !m.content.is_empty() {
            parts.push(serde_json::json!({ "text": m.content }));
        }
        for img in &m.images {
            parts.push(serde_json::json!({
                "inlineData": { "mimeType": img.media_type, "data": img.base64 }
            }));
        }
        if parts.is_empty() {
            parts.push(serde_json::json!({ "text": "" }));
        }
        contents.push(serde_json::json!({ "role": role, "parts": parts }));
    }
    let mut body = serde_json::json!({
        "contents": contents,
        "generationConfig": { "maxOutputTokens": max_tokens.clamp(1, MAX_OUTPUT_CAP) },
    });
    if !system_texts.is_empty() {
        body["systemInstruction"] = serde_json::json!({
            "parts": [{ "text": system_texts.join("\n\n") }]
        });
    }
    body
}

/// Project/region off the config, with the required-project check.
fn project_region(config: &ModelConfig) -> Result<(String, String), String> {
    let project = config
        .gcp_project_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or("未配置 GCP 项目 ID — 请编辑模型填写项目 ID")?
        .to_string();
    let region = config
        .gcp_region
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("global")
        .to_string();
    Ok((project, region))
}

/// Extract the text of one `streamGenerateContent?alt=sse` data line.
/// Returns None for keep-alives / lines without candidate text.
fn parse_vertex_line(line: &str) -> Option<String> {
    let data = line.strip_prefix("data:")?.trim();
    if data.is_empty() {
        return None;
    }
    let v: serde_json::Value = serde_json::from_str(data).ok()?;
    let parts = v
        .pointer("/candidates/0/content/parts")?
        .as_array()?
        .iter()
        .filter_map(|p| p.get("text").and_then(|t| t.as_str()))
        .collect::<Vec<_>>()
        .join("");
    if parts.is_empty() {
        None
    } else {
        Some(parts)
    }
}

#[async_trait]
impl AiProvider for VertexProvider {
    async fn chat_stream(
        &self,
        messages: Vec<Message>,
        config: &ModelConfig,
    ) -> Result<TokenStream, AiError> {
        let (project, region) = project_region(config).map_err(AiError::Connection)?;
        let client = build_client(config.proxy_url.as_deref(), STREAM_TIMEOUT)
            .map_err(AiError::Connection)?;
        let token = get_access_token(&client)
            .await
            .map_err(AiError::Connection)?;

        let url = format!(
            "{}?alt=sse",
            build_url(&project, &region, &config.model_id, "streamGenerateContent")
        );
        let body = to_gemini_body(&messages, config.max_tokens);

        let resp = client
            .post(&url)
            .bearer_auth(&token)
            // Required for end-user (authorized_user) ADC credentials on some
            // projects: bills/quotas the request against the target project.
            .header("x-goog-user-project", &project)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(AiError::from)?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(crate::ai_client::status_to_error(status, text));
        }

        let byte_stream = resp.bytes_stream();
        let token_stream = async_stream::stream! {
            let mut byte_stream = byte_stream;
            let mut buffer = String::new();
            loop {
                match byte_stream.next().await {
                    Some(Ok(chunk)) => {
                        buffer.push_str(&String::from_utf8_lossy(&chunk));
                        while let Some(nl) = buffer.find('\n') {
                            let line: String = buffer.drain(..=nl).collect();
                            if let Some(text) = parse_vertex_line(line.trim()) {
                                yield Ok(text);
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
        };
        Ok(Box::pin(token_stream))
    }
}

// ============================================================
// Test connection (real end-to-end ADC round trip)
// ============================================================

/// Minimal real request: credentials → token → (proxy) → generateContent with
/// maxOutputTokens=1. Errors are classified into the three user-facing cases.
pub async fn test_connection(config: &ModelConfig) -> Result<String, String> {
    let (project, region) = project_region(config)?;
    let client = build_client(config.proxy_url.as_deref(), TEST_TIMEOUT)?;
    let token = get_access_token(&client).await.map_err(|e| {
        if e.contains("gcloud auth") {
            e // credential-missing hint already user-ready
        } else if e.contains("网络/代理") || e.contains("令牌请求失败") {
            format!("{} — 请检查代理地址与网络连通性", e)
        } else {
            format!("凭证无效: {} — 请重新运行 gcloud auth application-default login", e)
        }
    })?;

    let url = build_url(&project, &region, &config.model_id, "generateContent");
    let body = serde_json::json!({
        "contents": [{ "role": "user", "parts": [{ "text": "Hi" }] }],
        "generationConfig": { "maxOutputTokens": 1 },
    });
    let resp = client
        .post(&url)
        .bearer_auth(&token)
        .header("x-goog-user-project", &project)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求失败(网络/代理): {} — 请检查代理地址", e))?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    match status.as_u16() {
        200 => {
            let v: serde_json::Value = serde_json::from_str(&text).unwrap_or_default();
            let out = v
                .pointer("/candidates/0/content/parts/0/text")
                .and_then(|t| t.as_str())
                .unwrap_or("(ok)");
            Ok(out.to_string())
        }
        401 | 403 => Err(format!(
            "项目/权限错误 (HTTP {}) — 请检查项目 ID `{}` 是否正确、Vertex AI API 是否已启用,以及当前 ADC 账号是否有访问权限",
            status.as_u16(),
            project
        )),
        404 => Err(format!(
            "模型或区域不存在 (HTTP 404) — 请检查模型 `{}` 与区域 `{}`",
            config.model_id, region
        )),
        s => Err(format!("HTTP {}: {}", s, text)),
    }
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai_client::ImageData;

    #[test]
    fn parses_authorized_user_credentials() {
        let json = r#"{"type":"authorized_user","client_id":"cid","client_secret":"sec","refresh_token":"rt"}"#;
        let c = parse_credentials_json(json).unwrap();
        assert_eq!(
            c,
            Credentials::AuthorizedUser {
                client_id: "cid".into(),
                client_secret: "sec".into(),
                refresh_token: "rt".into(),
            }
        );
    }

    #[test]
    fn parses_service_account_credentials_with_default_token_uri() {
        let json = r#"{"type":"service_account","client_email":"a@b.iam.gserviceaccount.com","private_key":"-----BEGIN"}"#;
        match parse_credentials_json(json).unwrap() {
            Credentials::ServiceAccount {
                client_email,
                token_uri,
                ..
            } => {
                assert_eq!(client_email, "a@b.iam.gserviceaccount.com");
                assert_eq!(token_uri, OAUTH_TOKEN_URL);
            }
            other => panic!("wrong variant: {:?}", other),
        }
    }

    #[test]
    fn rejects_unknown_credential_type() {
        assert!(parse_credentials_json(r#"{"type":"external_account"}"#).is_err());
        assert!(parse_credentials_json("not json").is_err());
    }

    #[test]
    fn builds_global_and_regional_urls() {
        assert_eq!(
            build_url("proj", "global", "gemini-2.5-pro", "streamGenerateContent"),
            "https://aiplatform.googleapis.com/v1/projects/proj/locations/global/publishers/google/models/gemini-2.5-pro:streamGenerateContent"
        );
        assert_eq!(
            build_url("proj", "us-central1", "gemini-2.5-flash", "generateContent"),
            "https://us-central1-aiplatform.googleapis.com/v1/projects/proj/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent"
        );
    }

    #[test]
    fn gemini_body_maps_roles_system_and_images() {
        let msgs = vec![
            Message {
                role: "system".into(),
                content: "be brief".into(),
                images: Vec::new(),
            },
            Message {
                role: "user".into(),
                content: "look".into(),
                images: vec![ImageData {
                    media_type: "image/png".into(),
                    base64: "AAA=".into(),
                }],
            },
            Message {
                role: "assistant".into(),
                content: "ok".into(),
                images: Vec::new(),
            },
        ];
        let body = to_gemini_body(&msgs, 200000);
        assert_eq!(
            body.pointer("/systemInstruction/parts/0/text").unwrap(),
            "be brief"
        );
        assert_eq!(body.pointer("/contents/0/role").unwrap(), "user");
        assert_eq!(
            body.pointer("/contents/0/parts/1/inlineData/mimeType")
                .unwrap(),
            "image/png"
        );
        assert_eq!(body.pointer("/contents/1/role").unwrap(), "model");
        // over-cap max_tokens is clamped to Gemini's limit
        assert_eq!(
            body.pointer("/generationConfig/maxOutputTokens")
                .and_then(|v| v.as_i64())
                .unwrap(),
            MAX_OUTPUT_CAP as i64
        );
    }

    #[test]
    fn parses_vertex_sse_line() {
        let line = r#"data: {"candidates":[{"content":{"role":"model","parts":[{"text":"He"},{"text":"llo"}]}}]}"#;
        assert_eq!(parse_vertex_line(line).as_deref(), Some("Hello"));
        assert_eq!(parse_vertex_line("data:"), None);
        assert_eq!(parse_vertex_line("event: ping"), None);
        // final usage-only chunk has no parts → None
        let done = r#"data: {"usageMetadata":{"totalTokenCount":5}}"#;
        assert_eq!(parse_vertex_line(done), None);
    }
}
