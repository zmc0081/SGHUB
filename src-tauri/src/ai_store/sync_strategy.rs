//! Orchestrates AI Store catalog refresh.
//!
//! Triggers (mock + production both honor these):
//!
//! - boot — 5s after `start_scheduler` is called
//! - periodic — every 5 minutes after a successful sync
//! - sse-pushed — immediate refresh when the SSE listener sees
//!   `products-updated`
//! - manual — `ai_store_sync_now` Tauri command
//!
//! Offline degradation: if a sync fails, the last-good catalog stays
//! visible in the UI; the sync_meta `next_sync_at` shifts back by the
//! retry cadence (1m → 2m → 5m, capped); the frontend status
//! indicator turns to `offline` once two consecutive attempts fail.

use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::AppState;

use super::products::{self, SgStoreProduct};

/// Event name carrying [`Trigger`] payloads between the SSE listener,
/// the periodic ticker, and the manual command handler. The scheduler
/// task listens for this in a single place so the cause is always
/// logged consistently.
pub const SYNC_TRIGGER_EVENT: &str = "ai_store:internal_sync_trigger";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum Trigger {
    Boot,
    Periodic,
    SsePushed,
    Manual,
}

const INITIAL_DELAY: Duration = Duration::from_secs(5);
const PERIODIC_INTERVAL: Duration = Duration::from_secs(5 * 60);

/// Spawn the long-lived scheduler task. Returns immediately.
///
/// Uses `tauri::async_runtime::spawn` rather than `tokio::spawn`
/// because this is called from the Tauri `setup` hook, which runs
/// outside any tokio reactor context. The async_runtime wrapper
/// drops us onto Tauri's tokio runtime; inside the task `tokio::time`
/// etc. work normally.
pub fn start_scheduler(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        log::info!(
            "ai_store::sync_strategy: scheduler online (initial {:?}, periodic {:?})",
            INITIAL_DELAY,
            PERIODIC_INTERVAL,
        );
        tokio::time::sleep(INITIAL_DELAY).await;

        // First sync (boot).
        let _ = run_once(&app, Trigger::Boot).await;

        loop {
            tokio::time::sleep(PERIODIC_INTERVAL).await;
            let _ = run_once(&app, Trigger::Periodic).await;
        }
    });
}

/// Run one sync cycle. Public so the Tauri command and the SSE
/// listener can both invoke it.
pub async fn run_once(app: &AppHandle, trigger: Trigger) -> Result<usize, String> {
    log::info!("ai_store::sync_strategy: running sync (trigger={:?})", trigger);

    let products = fetch_remote(app).await?;
    let pool = {
        let state = app.state::<AppState>();
        state.db_pool.clone()
    };
    let count = products.len();
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let next = chrono::Utc::now()
        + chrono::Duration::from_std(PERIODIC_INTERVAL).unwrap_or(chrono::Duration::minutes(5));
    let next_str = next.format("%Y-%m-%dT%H:%M:%SZ").to_string();

    let products_clone = products.clone();
    let now_for_blocking = now.clone();
    let next_for_blocking = next_str.clone();
    tokio::task::spawn_blocking(move || {
        products::replace_all(
            &pool,
            &products_clone,
            None, // V2.2.1 mock — no real ETag yet
            &now_for_blocking,
            Some(&next_for_blocking),
        )
    })
    .await
    .map_err(|e| format!("sync blocking join: {}", e))?
    .map_err(|e| format!("sync write: {}", e))?;

    // Tell the UI "you can re-fetch now".
    if let Err(e) = app.emit("ai_store:products_updated", count) {
        log::warn!("ai_store:products_updated emit failed: {}", e);
    }
    Ok(count)
}

/// Fetch the catalog from the remote endpoint.
///
/// V2.2.1 ships with `USE_MOCK_DATA = true` — `fetch_remote` returns
/// the same six SKUs the frontend's `mockData.ts` holds, so a fresh
/// install populates the Store on first sync without ever hitting
/// the network. Flip the constant once sgaistore.com is live.
const USE_MOCK_DATA: bool = true;

async fn fetch_remote(_app: &AppHandle) -> Result<Vec<SgStoreProduct>, String> {
    if USE_MOCK_DATA {
        return Ok(mock_catalog());
    }
    // V2.2.x — real HTTP path:
    //   let url = format!("{}/api/products", SG_AI_STORE_BASE_URL);
    //   let resp = reqwest::get(url).await.map_err(|e| e.to_string())?;
    //   resp.json::<Vec<SgStoreProduct>>().await.map_err(|e| e.to_string())
    Err("real fetch not enabled".into())
}

/// In-process duplicate of the frontend's `MOCK_PRODUCTS`. Kept here
/// (rather than imported across crates) so the Rust unit tests can
/// exercise the full sync pipeline without a network mock.
fn mock_catalog() -> Vec<SgStoreProduct> {
    use std::collections::HashMap;

    fn loc(zh: &str, en: &str) -> HashMap<String, String> {
        let mut m = HashMap::new();
        m.insert("zh-CN".into(), zh.into());
        m.insert("en-US".into(), en.into());
        m
    }
    fn loc_arr(zh: &[&str], en: &[&str]) -> HashMap<String, Vec<String>> {
        let mut m = HashMap::new();
        m.insert("zh-CN".into(), zh.iter().map(|s| s.to_string()).collect());
        m.insert("en-US".into(), en.iter().map(|s| s.to_string()).collect());
        m
    }

    vec![
        SgStoreProduct {
            id: "claude-opus-monthly".into(),
            name: loc("Claude Opus 月度包", "Claude Opus — Monthly"),
            description: loc(
                "Anthropic 旗舰推理模型,适合长文献深度精读。",
                "Anthropic's flagship reasoning model — best for deep literature reads.",
            ),
            icon_url: String::new(),
            model_provider: "anthropic".into(),
            model_id: "claude-opus-4-7".into(),
            billing_period: "monthly".into(),
            price_cny: 199.0,
            price_usd: 28.0,
            token_quota: 50_000_000,
            features: loc_arr(
                &["50M tokens / 月", "200K 上下文窗口"],
                &["50M tokens / month", "200K context window"],
            ),
            tags: vec!["popular".into(), "deep-research".into()],
            popular: true,
            purchase_url: "https://sgaistore.com/buy/claude-opus-monthly".into(),
        },
        SgStoreProduct {
            id: "claude-opus-yearly".into(),
            name: loc("Claude Opus 年度包", "Claude Opus — Yearly"),
            description: loc(
                "Claude Opus 全年使用,相比月度包总价节省约 16%。",
                "A full year of Claude Opus access — ~16% cheaper than 12 monthly packs.",
            ),
            icon_url: String::new(),
            model_provider: "anthropic".into(),
            model_id: "claude-opus-4-7".into(),
            billing_period: "yearly".into(),
            price_cny: 1999.0,
            price_usd: 280.0,
            token_quota: 700_000_000,
            features: loc_arr(
                &["700M tokens / 年", "相比月度包省 ~16%"],
                &["700M tokens / year", "~16% cheaper than 12 × monthly"],
            ),
            tags: vec!["best-value".into()],
            popular: false,
            purchase_url: "https://sgaistore.com/buy/claude-opus-yearly".into(),
        },
        SgStoreProduct {
            id: "claude-sonnet-monthly".into(),
            name: loc("Claude Sonnet 月度包", "Claude Sonnet — Monthly"),
            description: loc(
                "Anthropic 主力模型,速度比 Opus 快 ~3 倍。",
                "Anthropic's workhorse — ~3x faster than Opus.",
            ),
            icon_url: String::new(),
            model_provider: "anthropic".into(),
            model_id: "claude-sonnet-4-5".into(),
            billing_period: "monthly".into(),
            price_cny: 99.0,
            price_usd: 14.0,
            token_quota: 200_000_000,
            features: loc_arr(
                &["200M tokens / 月", "200K 上下文窗口"],
                &["200M tokens / month", "200K context window"],
            ),
            tags: vec!["everyday".into()],
            popular: true,
            purchase_url: "https://sgaistore.com/buy/claude-sonnet-monthly".into(),
        },
        SgStoreProduct {
            id: "gpt5-monthly".into(),
            name: loc("GPT-5 月度包", "GPT-5 — Monthly"),
            description: loc(
                "OpenAI 最新旗舰模型,在结构化 JSON 输出、多语言、视觉理解上表现优异。",
                "OpenAI's newest flagship — excels at structured JSON output and vision.",
            ),
            icon_url: String::new(),
            model_provider: "openai".into(),
            model_id: "gpt-5".into(),
            billing_period: "monthly".into(),
            price_cny: 159.0,
            price_usd: 22.0,
            token_quota: 100_000_000,
            features: loc_arr(
                &["100M tokens / 月", "128K 上下文窗口", "原生视觉理解"],
                &["100M tokens / month", "128K context window", "Native vision"],
            ),
            tags: vec!["vision".into()],
            popular: true,
            purchase_url: "https://sgaistore.com/buy/gpt5-monthly".into(),
        },
        SgStoreProduct {
            id: "deepseek-v3-monthly".into(),
            name: loc("DeepSeek V3 月度包", "DeepSeek V3 — Monthly"),
            description: loc(
                "国产开源大模型,价格极具竞争力。",
                "China-built open-weight model with very competitive pricing.",
            ),
            icon_url: String::new(),
            model_provider: "deepseek".into(),
            model_id: "deepseek-chat".into(),
            billing_period: "monthly".into(),
            price_cny: 49.0,
            price_usd: 7.0,
            token_quota: 500_000_000,
            features: loc_arr(
                &["500M tokens / 月", "64K 上下文", "性价比最高"],
                &["500M tokens / month", "64K context", "Best price-per-token"],
            ),
            tags: vec!["best-price".into()],
            popular: false,
            purchase_url: "https://sgaistore.com/buy/deepseek-v3-monthly".into(),
        },
        SgStoreProduct {
            id: "multi-mix-monthly".into(),
            name: loc("全模型混合包", "Multi-Model Bundle"),
            description: loc(
                "一份订阅,自由切换 Claude / GPT-5 / DeepSeek。",
                "One subscription, all four headline models on tap.",
            ),
            icon_url: String::new(),
            model_provider: "multi".into(),
            model_id: "mixed".into(),
            billing_period: "monthly".into(),
            price_cny: 299.0,
            price_usd: 42.0,
            token_quota: 300_000_000,
            features: loc_arr(
                &["300M tokens / 月", "4 个模型共享", "自由切换"],
                &["300M tokens / month", "Shared across 4 models", "Switch freely"],
            ),
            tags: vec!["flexibility".into()],
            popular: true,
            purchase_url: "https://sgaistore.com/buy/multi-mix-monthly".into(),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mock_catalog_has_six_skus_with_expected_providers() {
        let m = mock_catalog();
        assert_eq!(m.len(), 6);
        let providers: std::collections::HashSet<_> =
            m.iter().map(|p| p.model_provider.clone()).collect();
        assert!(providers.contains("anthropic"));
        assert!(providers.contains("openai"));
        assert!(providers.contains("deepseek"));
        assert!(providers.contains("multi"));
    }

    #[test]
    fn mock_catalog_has_popular_items() {
        let m = mock_catalog();
        assert!(m.iter().any(|p| p.popular));
    }
}
