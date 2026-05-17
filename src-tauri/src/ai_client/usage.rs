//! Token + cost accounting (V2.1.0).
//!
//! `upsert_usage_stats` already lives in `ai_client/mod.rs` — this
//! module layers cost-aware writes, the 7-day rollup query the model
//! page reads, and the back-fill that synthesises history from
//! `chat_messages` + `ai_parse_results` for V2.0.1 upgraders.

use rusqlite::{params, params_from_iter};
use serde::{Deserialize, Serialize};

use super::ModelConfig;

// ============================================================
// Cost calculation
// ============================================================

/// USD cost of one (tokens_in, tokens_out) pair against a model's
/// per-1M-token prices.
pub fn estimate_cost(model: &ModelConfig, tokens_in: i64, tokens_out: i64) -> f64 {
    let inp = (tokens_in as f64) / 1_000_000.0 * model.input_price_per_1m_tokens;
    let out = (tokens_out as f64) / 1_000_000.0 * model.output_price_per_1m_tokens;
    inp + out
}

/// Per-call UPSERT that *also* writes the cost estimate. Replaces the
/// old `upsert_usage_stats` (which always wrote 0 cost) at the three
/// call paths.
pub fn record_usage(
    pool: &crate::db::DbPool,
    model: &ModelConfig,
    tokens_in: i64,
    tokens_out: i64,
) -> rusqlite::Result<()> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let date = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let id = uuid::Uuid::now_v7().to_string();
    let cost = estimate_cost(model, tokens_in, tokens_out);
    conn.execute(
        "INSERT INTO usage_stats \
         (id, model_config_id, date, tokens_in_total, tokens_out_total, call_count, cost_est_total) \
         VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6) \
         ON CONFLICT(model_config_id, date) DO UPDATE SET \
            tokens_in_total = tokens_in_total + excluded.tokens_in_total, \
            tokens_out_total = tokens_out_total + excluded.tokens_out_total, \
            call_count = call_count + 1, \
            cost_est_total = cost_est_total + excluded.cost_est_total",
        params![id, model.id, date, tokens_in, tokens_out, cost],
    )?;
    Ok(())
}

// ============================================================
// Public types for the 7-day rollup
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyUsage {
    /// `YYYY-MM-DD`.
    pub date: String,
    pub tokens_in: i64,
    pub tokens_out: i64,
    pub call_count: i64,
    pub cost_est: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelUsage {
    pub model_config_id: String,
    /// Display name (joined from `model_configs.name`); falls back to
    /// the id when the row was deleted but stats remain.
    pub model_name: String,
    pub tokens_in: i64,
    pub tokens_out: i64,
    pub call_count: i64,
    pub cost_est: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageStats7Days {
    pub total_tokens_in: i64,
    pub total_tokens_out: i64,
    pub total_call_count: i64,
    pub total_cost_est: f64,
    /// 7 entries, one per calendar day (today − 6 .. today). Zero-filled
    /// for days with no activity so the bar chart spans a full week.
    pub daily_breakdown: Vec<DailyUsage>,
    pub by_model: Vec<ModelUsage>,
}

// ============================================================
// Query — `WHERE date >= date('now', '-6 days')`
// ============================================================

/// (date_yyyymmdd, model_config_id, tokens_in, tokens_out, call_count, cost)
type RawUsageRow = (String, String, i64, i64, i64, f64);

fn query_7day_rows(
    pool: &crate::db::DbPool,
) -> rusqlite::Result<Vec<RawUsageRow>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let mut stmt = conn.prepare(
        "SELECT date, model_config_id, \
                tokens_in_total, tokens_out_total, call_count, cost_est_total \
         FROM usage_stats \
         WHERE date >= date('now', '-6 days') \
         ORDER BY date ASC",
    )?;
    let rows = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, i64>(2)?,
                r.get::<_, i64>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, f64>(5)?,
            ))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

fn model_names(pool: &crate::db::DbPool) -> rusqlite::Result<std::collections::HashMap<String, String>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let mut stmt = conn.prepare("SELECT id, name FROM model_configs")?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
    let mut map = std::collections::HashMap::new();
    for r in rows {
        let (id, name) = r?;
        map.insert(id, name);
    }
    Ok(map)
}

/// Pure rollup of the raw rows into the shape the UI consumes. Lives
/// outside the IO so unit tests can drive it with synthetic data.
pub fn rollup_7days(
    raw: Vec<RawUsageRow>,
    names: &std::collections::HashMap<String, String>,
    today_yyyymmdd: &str,
) -> UsageStats7Days {
    use std::collections::BTreeMap;
    // Daily aggregate (date → tuple)
    let mut by_date: BTreeMap<String, (i64, i64, i64, f64)> = BTreeMap::new();
    // Per-model aggregate
    let mut by_model: std::collections::HashMap<String, (i64, i64, i64, f64)> =
        std::collections::HashMap::new();

    let mut total_in: i64 = 0;
    let mut total_out: i64 = 0;
    let mut total_calls: i64 = 0;
    let mut total_cost: f64 = 0.0;

    for (date, mid, tin, tout, calls, cost) in raw {
        let d = by_date.entry(date).or_insert((0, 0, 0, 0.0));
        d.0 += tin;
        d.1 += tout;
        d.2 += calls;
        d.3 += cost;
        let m = by_model.entry(mid).or_insert((0, 0, 0, 0.0));
        m.0 += tin;
        m.1 += tout;
        m.2 += calls;
        m.3 += cost;
        total_in += tin;
        total_out += tout;
        total_calls += calls;
        total_cost += cost;
    }

    // Zero-fill the 7 days so the bar chart spans the whole week.
    let mut daily_breakdown = Vec::with_capacity(7);
    if let Ok(today) = chrono::NaiveDate::parse_from_str(today_yyyymmdd, "%Y-%m-%d") {
        for back in (0..7).rev() {
            let date = (today - chrono::Duration::days(back))
                .format("%Y-%m-%d")
                .to_string();
            let (tin, tout, calls, cost) =
                by_date.get(&date).copied().unwrap_or((0, 0, 0, 0.0));
            daily_breakdown.push(DailyUsage {
                date,
                tokens_in: tin,
                tokens_out: tout,
                call_count: calls,
                cost_est: cost,
            });
        }
    } else {
        // Fallback — just emit whatever we have, sorted (BTreeMap is sorted).
        for (date, (tin, tout, calls, cost)) in by_date.iter() {
            daily_breakdown.push(DailyUsage {
                date: date.clone(),
                tokens_in: *tin,
                tokens_out: *tout,
                call_count: *calls,
                cost_est: *cost,
            });
        }
    }

    let mut by_model_vec: Vec<ModelUsage> = by_model
        .into_iter()
        .map(|(mid, (tin, tout, calls, cost))| ModelUsage {
            model_name: names.get(&mid).cloned().unwrap_or_else(|| mid.clone()),
            model_config_id: mid,
            tokens_in: tin,
            tokens_out: tout,
            call_count: calls,
            cost_est: cost,
        })
        .collect();
    // Stable order: highest call_count first so the most-used model
    // surfaces in the legend.
    by_model_vec.sort_by_key(|m| std::cmp::Reverse(m.call_count));

    UsageStats7Days {
        total_tokens_in: total_in,
        total_tokens_out: total_out,
        total_call_count: total_calls,
        total_cost_est: total_cost,
        daily_breakdown,
        by_model: by_model_vec,
    }
}

/// IO-side wrapper.
pub fn query_usage_stats_7days(
    pool: &crate::db::DbPool,
) -> rusqlite::Result<UsageStats7Days> {
    let rows = query_7day_rows(pool)?;
    let names = model_names(pool)?;
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    Ok(rollup_7days(rows, &names, &today))
}

// ============================================================
// Backfill from chat_messages + ai_parse_results
// ============================================================

/// Wipe `usage_stats` and re-synthesise from existing message + parse
/// rows. For users upgrading from V2.0.1 where stats weren't being
/// written. Idempotent — safe to run any number of times.
pub fn rebuild_from_history(pool: &crate::db::DbPool) -> rusqlite::Result<i64> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

    conn.execute("DELETE FROM usage_stats", [])?;

    // Source A — assistant chat_messages: model_config_id lives on the
    // owning session (chat_messages itself only stores `model_name`).
    // Source B — ai_parse_results: only stores `model_name`; we map back
    // to a model_config_id by joining on the human-readable name. Rows
    // whose model_name no longer matches any configured model are
    // silently dropped (the user deleted the model — no place to put
    // those tokens).
    let sources = [
        "SELECT s.model_config_id, substr(m.created_at, 1, 10) AS d, \
                COALESCE(m.tokens_in, 0) AS ti, COALESCE(m.tokens_out, 0) AS togo \
         FROM chat_messages m \
         JOIN chat_sessions s ON s.id = m.session_id \
         WHERE m.role = 'assistant' AND s.model_config_id IS NOT NULL",
        "SELECT mc.id, substr(r.created_at, 1, 10) AS d, \
                COALESCE(r.tokens_in, 0) AS ti, COALESCE(r.tokens_out, 0) AS togo \
         FROM ai_parse_results r \
         JOIN model_configs mc ON mc.name = r.model_name",
    ];

    let mut bucket: std::collections::HashMap<(String, String), (i64, i64, i64)> =
        std::collections::HashMap::new();
    for sql in sources {
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, i64>(2)?,
                r.get::<_, i64>(3)?,
            ))
        })?;
        for row in rows {
            let (mid, date, ti, togo) = row?;
            let e = bucket.entry((mid, date)).or_insert((0, 0, 0));
            e.0 += ti;
            e.1 += togo;
            e.2 += 1;
        }
    }

    // Pull pricing so we can re-cost. Falls back to zeros for missing.
    let mut prices = conn.prepare(
        "SELECT id, input_price_per_1m_tokens, output_price_per_1m_tokens FROM model_configs",
    )?;
    let mut price_map: std::collections::HashMap<String, (f64, f64)> = std::collections::HashMap::new();
    for r in prices.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?, r.get::<_, f64>(2)?)))? {
        let (id, ip, op) = r?;
        price_map.insert(id, (ip, op));
    }

    let mut inserted: i64 = 0;
    for ((mid, date), (tin, tout, calls)) in bucket {
        let (ip, op) = price_map.get(&mid).copied().unwrap_or((0.0, 0.0));
        let cost = (tin as f64) / 1_000_000.0 * ip + (tout as f64) / 1_000_000.0 * op;
        let id = uuid::Uuid::now_v7().to_string();
        conn.execute(
            "INSERT INTO usage_stats \
             (id, model_config_id, date, tokens_in_total, tokens_out_total, call_count, cost_est_total) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params_from_iter::<Vec<&dyn rusqlite::ToSql>>(vec![
                &id, &mid, &date, &tin, &tout, &calls, &cost,
            ]),
        )?;
        inserted += 1;
    }
    Ok(inserted)
}

// ============================================================
// Tauri commands
// ============================================================

use crate::AppState;

#[tauri::command]
pub async fn get_usage_stats_7days(
    state: tauri::State<'_, AppState>,
) -> Result<UsageStats7Days, String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || query_usage_stats_7days(&pool))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rebuild_usage_stats(
    state: tauri::State<'_, AppState>,
) -> Result<i64, String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || rebuild_from_history(&pool))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai_client::ModelConfig;
    use crate::db::init_at;
    use tempfile::TempDir;

    fn cfg(id: &str, ip: f64, op: f64) -> ModelConfig {
        ModelConfig {
            id: id.into(),
            name: format!("Model {id}"),
            provider: "openai".into(),
            endpoint: "https://api.example.com".into(),
            model_id: "test".into(),
            max_tokens: 1024,
            is_default: false,
            keychain_ref: None,
            created_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-01-01T00:00:00Z".into(),
            input_price_per_1m_tokens: ip,
            output_price_per_1m_tokens: op,
        }
    }

    fn insert_model(pool: &crate::db::DbPool, id: &str, name: &str) {
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO model_configs \
             (id, name, provider, endpoint, model_id, max_tokens, is_default, \
              created_at, updated_at, input_price_per_1m_tokens, output_price_per_1m_tokens) \
             VALUES (?1, ?2, 'openai', 'https://x', 'm', 1024, 0, \
                     strftime('%Y-%m-%dT%H:%M:%SZ','now'), \
                     strftime('%Y-%m-%dT%H:%M:%SZ','now'), 5.0, 15.0)",
            params![id, name],
        )
        .unwrap();
    }

    #[test]
    fn cost_basic() {
        let m = cfg("m1", 5.0, 15.0);
        // 1M in + 500k out @ $5/$15 → 5 + 7.5 = 12.5
        let c = estimate_cost(&m, 1_000_000, 500_000);
        assert!((c - 12.5).abs() < 1e-9, "got {}", c);
    }

    #[test]
    fn cost_zero_when_unpriced() {
        let m = cfg("m1", 0.0, 0.0);
        assert_eq!(estimate_cost(&m, 1_000_000, 1_000_000), 0.0);
    }

    #[test]
    fn record_usage_upserts_and_sums_cost() {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();
        insert_model(&pool, "m1", "GPT-5");
        let m = cfg("m1", 5.0, 15.0);

        // 3 calls today → call_count=3, tokens summed, cost summed
        record_usage(&pool, &m, 1_000_000, 100_000).unwrap();
        record_usage(&pool, &m, 200_000, 50_000).unwrap();
        record_usage(&pool, &m, 0, 0).unwrap();

        let conn = pool.get().unwrap();
        let (calls, tin, tout, cost): (i64, i64, i64, f64) = conn
            .query_row(
                "SELECT call_count, tokens_in_total, tokens_out_total, cost_est_total \
                 FROM usage_stats WHERE model_config_id = 'm1'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .unwrap();
        assert_eq!(calls, 3);
        assert_eq!(tin, 1_200_000);
        assert_eq!(tout, 150_000);
        // 1.2M in * $5 + 150k out * $15 = 6.0 + 2.25 = 8.25
        assert!((cost - 8.25).abs() < 1e-6, "cost={cost}");
    }

    #[test]
    fn rollup_zero_fills_missing_days() {
        let raw = vec![
            ("2026-05-15".into(), "m1".into(), 100, 200, 1, 0.5),
            ("2026-05-17".into(), "m1".into(), 300, 400, 2, 1.0),
        ];
        let mut names = std::collections::HashMap::new();
        names.insert("m1".into(), "GPT-5".into());

        let r = rollup_7days(raw, &names, "2026-05-17");
        assert_eq!(r.daily_breakdown.len(), 7);
        let dates: Vec<&str> = r.daily_breakdown.iter().map(|d| d.date.as_str()).collect();
        assert_eq!(
            dates,
            [
                "2026-05-11", "2026-05-12", "2026-05-13", "2026-05-14",
                "2026-05-15", "2026-05-16", "2026-05-17",
            ]
        );
        // The two days with data
        assert_eq!(r.daily_breakdown[4].call_count, 1); // 2026-05-15
        assert_eq!(r.daily_breakdown[6].call_count, 2); // 2026-05-17
        // Zero-filled in-between
        assert_eq!(r.daily_breakdown[5].call_count, 0);

        assert_eq!(r.total_call_count, 3);
        assert_eq!(r.total_tokens_in, 400);
        assert_eq!(r.total_tokens_out, 600);
        assert!((r.total_cost_est - 1.5).abs() < 1e-9);

        assert_eq!(r.by_model.len(), 1);
        assert_eq!(r.by_model[0].model_name, "GPT-5");
    }

    #[test]
    fn rollup_sorts_models_by_call_count() {
        let raw = vec![
            ("2026-05-17".into(), "m_low".into(), 10, 10, 1, 0.0),
            ("2026-05-17".into(), "m_high".into(), 10, 10, 50, 0.0),
            ("2026-05-17".into(), "m_mid".into(), 10, 10, 5, 0.0),
        ];
        let mut names = std::collections::HashMap::new();
        names.insert("m_low".into(), "Low".into());
        names.insert("m_high".into(), "High".into());
        names.insert("m_mid".into(), "Mid".into());

        let r = rollup_7days(raw, &names, "2026-05-17");
        assert_eq!(r.by_model[0].model_name, "High");
        assert_eq!(r.by_model[1].model_name, "Mid");
        assert_eq!(r.by_model[2].model_name, "Low");
    }

    #[test]
    fn rollup_unknown_model_id_uses_id_as_name() {
        let raw = vec![("2026-05-17".into(), "ghost".into(), 0, 0, 1, 0.0)];
        let names = std::collections::HashMap::new();
        let r = rollup_7days(raw, &names, "2026-05-17");
        assert_eq!(r.by_model[0].model_name, "ghost");
    }

    #[test]
    fn query_round_trip() {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();
        insert_model(&pool, "m1", "GPT-5");
        let m = cfg("m1", 5.0, 15.0);
        record_usage(&pool, &m, 1_000_000, 100_000).unwrap();
        record_usage(&pool, &m, 0, 50_000).unwrap();

        let stats = query_usage_stats_7days(&pool).unwrap();
        assert_eq!(stats.total_call_count, 2);
        assert_eq!(stats.total_tokens_in, 1_000_000);
        assert_eq!(stats.total_tokens_out, 150_000);
        assert_eq!(stats.daily_breakdown.len(), 7);
        // today is at the end
        assert_eq!(stats.daily_breakdown.last().unwrap().call_count, 2);
        assert_eq!(stats.by_model.len(), 1);
        assert_eq!(stats.by_model[0].model_name, "GPT-5");
    }

    #[test]
    fn rebuild_pulls_from_chat_and_parse_tables() {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();
        insert_model(&pool, "m1", "GPT-5");
        let conn = pool.get().unwrap();

        // Session owns the model_config_id; messages carry the tokens.
        conn.execute(
            "INSERT INTO chat_sessions (id, title, model_config_id, created_at, updated_at) \
             VALUES ('s1', 'T', 'm1', \
                     strftime('%Y-%m-%dT%H:%M:%SZ','now'), \
                     strftime('%Y-%m-%dT%H:%M:%SZ','now'))",
            [],
        )
        .unwrap();
        for (i, ti, togo) in [(1, 100, 200), (2, 50, 75)] {
            conn.execute(
                "INSERT INTO chat_messages \
                 (id, session_id, role, content, tokens_in, tokens_out, model_name, created_at) \
                 VALUES (?1, 's1', 'assistant', 'x', ?2, ?3, 'GPT-5', \
                         strftime('%Y-%m-%dT%H:%M:%SZ','now'))",
                params![format!("msg-{}", i), ti, togo],
            )
            .unwrap();
        }

        let inserted = rebuild_from_history(&pool).unwrap();
        assert_eq!(inserted, 1, "one (model_id, date) bucket");

        let (calls, tin, tout): (i64, i64, i64) = conn
            .query_row(
                "SELECT call_count, tokens_in_total, tokens_out_total FROM usage_stats",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap();
        assert_eq!(calls, 2);
        assert_eq!(tin, 150);
        assert_eq!(tout, 275);
    }

    #[test]
    fn rebuild_pulls_parse_results_by_model_name() {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();
        insert_model(&pool, "m1", "GPT-5");
        let conn = pool.get().unwrap();

        // Insert one parse result referencing the model by name.
        conn.execute(
            "INSERT INTO papers (id, title, authors, source) \
             VALUES ('p1', 'X', '[]', 'arxiv')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO ai_parse_results \
             (id, paper_id, skill_name, model_name, result_json, tokens_in, tokens_out) \
             VALUES ('r1', 'p1', 'general_read', 'GPT-5', '{}', 300, 400)",
            [],
        )
        .unwrap();

        let inserted = rebuild_from_history(&pool).unwrap();
        assert_eq!(inserted, 1);
        let (calls, tin, tout): (i64, i64, i64) = conn
            .query_row(
                "SELECT call_count, tokens_in_total, tokens_out_total FROM usage_stats",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap();
        assert_eq!(calls, 1);
        assert_eq!(tin, 300);
        assert_eq!(tout, 400);
    }

    #[test]
    fn rebuild_is_idempotent() {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();
        insert_model(&pool, "m1", "GPT-5");
        let m = cfg("m1", 5.0, 15.0);

        // Pretend we already have stats from a previous record_usage call.
        record_usage(&pool, &m, 1_000_000, 100_000).unwrap();
        // No chat / parse rows exist → rebuild wipes the table.
        let inserted = rebuild_from_history(&pool).unwrap();
        assert_eq!(inserted, 0);
        let conn = pool.get().unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM usage_stats", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }
}
