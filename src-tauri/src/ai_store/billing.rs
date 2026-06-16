//! SG AI Store balance + usage queries.
//!
//! Production path: `GET https://sgaistore.com/api/billing/balance`
//! with `Authorization: Bearer <key>`. In V2.2.1 (USE_MOCK_DATA=true)
//! we return synthetic balances seeded by the model UUID so values
//! stay stable across refreshes within the same boot, and each
//! successive refresh subtracts a small amount to simulate usage.
//!
//! On every successful query the headline numbers (balance_cny,
//! remaining_tokens, subscription_expires_at, balance_synced_at)
//! are written back to `model_configs` via
//! [`crate::ai_client::write_balance`] so the Models card stays
//! responsive without a network round-trip.

use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::Duration;

use chrono::{Duration as ChronoDuration, Utc};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::ai_client::{self, write_balance};
use crate::AppState;

/// Frontend-facing shape — mirrors `SgStoreBalance` in
/// `src/lib/sgAiStoreApi.ts`. Returned by `ai_store_get_balance`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceSnapshot {
    pub balance_cny: f64,
    pub remaining_tokens: i64,
    pub subscription: Option<SubscriptionInfo>,
    pub usage_24h: Usage24h,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionInfo {
    pub product_name: String,
    pub expires_at: String,
    pub auto_renew: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Usage24h {
    pub tokens_in: i64,
    pub tokens_out: i64,
    pub call_count: i64,
}

const USE_MOCK_DATA: bool = true;

/// In-memory mock state per `model_config_id`. Survives the lifetime of
/// the process; each refresh subtracts a tiny amount so the UI shows
/// movement. Wiped on app restart (intentional: matches the "first
/// boot reads cached value from DB" pattern).
static MOCK_STATE: LazyLock<Mutex<HashMap<String, MockBalance>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[derive(Clone)]
struct MockBalance {
    balance_cny: f64,
    remaining_tokens: i64,
    expires_at: String,
}

fn seed_from_id(id: &str) -> u64 {
    // Cheap deterministic hash: sum bytes + length. Doesn't need
    // cryptographic strength — only stability for the mock seed.
    let mut h: u64 = 0;
    for b in id.bytes() {
        h = h.wrapping_mul(31).wrapping_add(b as u64);
    }
    h
}

fn fresh_mock(id: &str) -> MockBalance {
    let seed = seed_from_id(id);
    // Range 6.50 - 14.49 CNY across ids; high-bit ids closer to 14
    let cny = 6.5 + (seed % 800) as f64 / 100.0;
    let tokens = 6_000_000 + ((seed % 9000) as i64) * 1000;
    let expires_at = (Utc::now() + ChronoDuration::days(30))
        .format("%Y-%m-%dT%H:%M:%SZ")
        .to_string();
    MockBalance {
        balance_cny: cny,
        remaining_tokens: tokens,
        expires_at,
    }
}

fn drain_mock(b: &mut MockBalance) {
    // Each refresh: small synthetic usage (1.5% of balance).
    let drain_cny = (b.balance_cny * 0.015).max(0.05);
    b.balance_cny = (b.balance_cny - drain_cny).max(0.0);
    let drain_tokens = (b.remaining_tokens / 100).max(5_000);
    b.remaining_tokens = (b.remaining_tokens - drain_tokens).max(0);
}

fn build_mock_snapshot(id: &str, product_name: String) -> BalanceSnapshot {
    let mut state = MOCK_STATE.lock().expect("MOCK_STATE poisoned");
    let entry = state.entry(id.to_string()).or_insert_with(|| fresh_mock(id));
    drain_mock(entry);
    BalanceSnapshot {
        balance_cny: entry.balance_cny,
        remaining_tokens: entry.remaining_tokens,
        subscription: Some(SubscriptionInfo {
            product_name,
            expires_at: entry.expires_at.clone(),
            auto_renew: false,
        }),
        usage_24h: Usage24h {
            // Deterministic-ish: a few calls + reasonable tokens
            tokens_in: ((seed_from_id(id) % 80_000) + 5_000) as i64,
            tokens_out: ((seed_from_id(id) % 40_000) + 2_000) as i64,
            call_count: ((seed_from_id(id) % 25) + 1) as i64,
        },
    }
}

/// Query the gateway (or mock) for one model's balance, and write the
/// headline fields back to `model_configs`. Returns the full snapshot
/// so the frontend can also render the 24h usage strip.
pub async fn get_balance_for(
    app: &AppHandle,
    model_config_id: &str,
) -> Result<BalanceSnapshot, String> {
    // 1. Look up the ModelConfig (we need provider/model_id for the
    //    mock product_name; in production we'd also need the key).
    let pool = {
        let state = app.state::<AppState>();
        state.db_pool.clone()
    };
    let mid = model_config_id.to_string();
    let cfg = tokio::task::spawn_blocking(move || ai_client::get_one(&pool, &mid))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("model `{}` not found", model_config_id))?;

    if !cfg.is_sg_ai_store {
        return Err(format!(
            "model `{}` is not flagged as SG AI Store (endpoint={})",
            cfg.name, cfg.endpoint
        ));
    }

    let snap = if USE_MOCK_DATA {
        log::info!(
            "ai_store::billing: mock balance fetch for model_config_id={} name={}",
            model_config_id,
            cfg.name
        );
        build_mock_snapshot(model_config_id, cfg.name.clone())
    } else {
        // V2.2.x — real path:
        //   let key = keychain::get_api_key(model_config_id)?.ok_or(...)?;
        //   let url = format!("{}/api/billing/balance",
        //                     cfg.endpoint.trim_end_matches('/'));
        //   let resp = reqwest::Client::new()
        //       .get(url)
        //       .bearer_auth(key)
        //       .timeout(Duration::from_secs(10))
        //       .send().await
        //       .map_err(|e| e.to_string())?;
        //   resp.json::<BalanceSnapshot>().await.map_err(|e| e.to_string())?
        return Err("real fetch not enabled".into());
    };

    // 2. Persist headline numbers so the Models card has them on next mount.
    let pool = {
        let state = app.state::<AppState>();
        state.db_pool.clone()
    };
    let id_for_write = model_config_id.to_string();
    let balance_cny = snap.balance_cny;
    let remaining_tokens = snap.remaining_tokens;
    let expires_at = snap
        .subscription
        .as_ref()
        .map(|s| s.expires_at.clone());
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let _ = tokio::task::spawn_blocking(move || {
        write_balance(
            &pool,
            &id_for_write,
            Some(balance_cny),
            Some(remaining_tokens),
            expires_at.as_deref(),
            &now,
        )
    })
    .await;

    Ok(snap)
}

/// Refresh every SG AI Store model's balance in sequence. Returns the
/// count of models successfully refreshed.
pub async fn refresh_all(app: &AppHandle) -> Result<usize, String> {
    let pool = {
        let state = app.state::<AppState>();
        state.db_pool.clone()
    };
    let configs = tokio::task::spawn_blocking(move || ai_client::list_all(&pool))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    let sg_ids: Vec<String> = configs
        .into_iter()
        .filter(|c| c.is_sg_ai_store)
        .map(|c| c.id)
        .collect();

    let mut ok = 0;
    for id in &sg_ids {
        match get_balance_for(app, id).await {
            Ok(_) => ok += 1,
            Err(e) => log::warn!(
                "ai_store::billing: refresh failed for {}: {}",
                id,
                e
            ),
        }
    }
    log::info!(
        "ai_store::billing: refresh_all done — {}/{} models updated",
        ok,
        sg_ids.len()
    );
    Ok(ok)
}

// ============================================================
// Auto-refresh scheduler — spawned from lib.rs setup hook.
// 10s boot delay, then every hour. Stays mock-safe (just hits
// build_mock_snapshot for each row).
// ============================================================

const BOOT_DELAY: Duration = Duration::from_secs(10);
const PERIODIC_INTERVAL: Duration = Duration::from_secs(60 * 60);

pub fn start_auto_refresh(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        log::info!(
            "ai_store::billing: auto-refresh scheduler online (boot {:?}, periodic {:?})",
            BOOT_DELAY,
            PERIODIC_INTERVAL
        );
        tokio::time::sleep(BOOT_DELAY).await;
        let _ = refresh_all(&app).await;
        loop {
            tokio::time::sleep(PERIODIC_INTERVAL).await;
            let _ = refresh_all(&app).await;
        }
    });
}

// ============================================================
// Tauri commands
// ============================================================

#[tauri::command]
pub async fn ai_store_get_balance(
    app: AppHandle,
    _state: tauri::State<'_, AppState>,
    model_config_id: String,
) -> Result<BalanceSnapshot, String> {
    get_balance_for(&app, &model_config_id).await
}

#[tauri::command]
pub async fn ai_store_refresh_all_balances(
    app: AppHandle,
    _state: tauri::State<'_, AppState>,
) -> Result<usize, String> {
    refresh_all(&app).await
}

/// V2.2.4 — onboarding "AI Store" tab. Verify a *raw* API key BEFORE any
/// model config exists by hitting the balance endpoint with it. On
/// success the frontend creates the SG AI Store model config and sets it
/// as default. (`ai_store_get_balance` can't be used here — it requires
/// an already-persisted, SG-AI-Store-flagged model row.)
///
/// Mock path (V2.2.x): any non-empty key returns a deterministic
/// synthetic balance seeded by the key, so the onboarding flow is fully
/// exercisable offline. Production path hits
/// `GET {endpoint}/api/billing/balance` with `Authorization: Bearer`.
#[tauri::command]
pub async fn ai_store_verify_key(api_key: String) -> Result<BalanceSnapshot, String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err("API Key 不能为空 / API key is empty".into());
    }

    if USE_MOCK_DATA {
        log::info!("ai_store::billing: mock key verification (len={})", key.len());
        let mut mock = fresh_mock(key);
        drain_mock(&mut mock);
        return Ok(BalanceSnapshot {
            balance_cny: mock.balance_cny,
            remaining_tokens: mock.remaining_tokens,
            subscription: Some(SubscriptionInfo {
                product_name: "SG AI Store".into(),
                expires_at: mock.expires_at,
                auto_renew: false,
            }),
            usage_24h: Usage24h::default(),
        });
    }

    // Production path:
    let url = "https://sgaistore.com/api/billing/balance";
    let resp = reqwest::Client::new()
        .get(url)
        .bearer_auth(key)
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("无法连接到 SG AI Store / cannot reach gateway: {}", e))?;
    if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err("API Key 无效或已过期 / invalid or expired key (401)".into());
    }
    if !resp.status().is_success() {
        return Err(format!("SG AI Store 返回 HTTP {}", resp.status()));
    }
    resp.json::<BalanceSnapshot>()
        .await
        .map_err(|e| format!("解析余额响应失败 / parse balance failed: {}", e))
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mock_seed_is_deterministic() {
        let a = seed_from_id("abc-123");
        let b = seed_from_id("abc-123");
        assert_eq!(a, b);
        assert_ne!(seed_from_id("abc-123"), seed_from_id("abc-124"));
    }

    #[test]
    fn fresh_mock_balance_in_range() {
        let m = fresh_mock("test-uuid-1");
        assert!(m.balance_cny >= 6.5 && m.balance_cny < 14.5);
        assert!(m.remaining_tokens >= 6_000_000);
        assert!(m.remaining_tokens < 16_000_000);
        assert!(m.expires_at.ends_with("Z"));
    }

    #[test]
    fn drain_reduces_balance_but_doesnt_go_negative() {
        let mut m = fresh_mock("drain-test");
        let original = m.balance_cny;
        drain_mock(&mut m);
        assert!(m.balance_cny < original);
        assert!(m.balance_cny >= 0.0);

        // Drain repeatedly — should bottom out at 0 not go negative.
        for _ in 0..200 {
            drain_mock(&mut m);
        }
        assert!(m.balance_cny >= 0.0);
        assert!(m.remaining_tokens >= 0);
    }
}
