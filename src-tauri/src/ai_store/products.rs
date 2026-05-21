//! Local SKU catalog cache for SG AI Store.
//!
//! Schema lives in `migrations/V005__ai_store_products.sql`. This module
//! owns:
//!   - typed `SgStoreProduct` (mirrors the frontend `sgAiStoreApi.ts`)
//!   - `get_cached(pool)` reads every row, hydrating JSON columns
//!   - `replace_all(pool, &products, etag)` writes the catalog atomically
//!     (DELETE + INSERT inside a transaction) and bumps sync_meta
//!   - `read_sync_meta(pool) / write_sync_meta(...)` for ETag + timestamps
//!
//! The HTTP fetch lives in [`sync_strategy::fetch_remote`]; this file
//! only persists what is given to it.

use std::collections::HashMap;

use rusqlite::params;
use serde::{Deserialize, Serialize};

pub type LocalizedString = HashMap<String, String>;
pub type LocalizedStringArray = HashMap<String, Vec<String>>;

/// Mirrors the TypeScript `SgStoreProduct` interface byte-for-byte so
/// that `serde_json::to_string(&products)` round-trips through the
/// Tauri IPC layer without any frontend-side coercion.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SgStoreProduct {
    pub id: String,
    pub name: LocalizedString,
    pub description: LocalizedString,
    pub icon_url: String,
    pub model_provider: String,
    pub model_id: String,
    pub billing_period: String, // "monthly" | "yearly"
    pub price_cny: f64,
    pub price_usd: f64,
    pub token_quota: i64,
    pub features: LocalizedStringArray,
    pub tags: Vec<String>,
    pub popular: bool,
    pub purchase_url: String,
}

#[derive(Debug, Clone, Default)]
pub struct SyncMeta {
    pub etag: Option<String>,
    pub last_synced_at: Option<String>,
    pub next_sync_at: Option<String>,
}

const SELECT_COLS: &str = "id, name_json, description_json, icon_url, model_provider, model_id, \
                           billing_period, price_cny, price_usd, token_quota, features_json, \
                           tags_json, popular, purchase_url, synced_at";

fn row_to_product(row: &rusqlite::Row) -> rusqlite::Result<SgStoreProduct> {
    let name_json: String = row.get(1)?;
    let description_json: String = row.get(2)?;
    let features_json: String = row.get(10)?;
    let tags_json: String = row.get(11)?;
    Ok(SgStoreProduct {
        id: row.get(0)?,
        name: serde_json::from_str(&name_json).unwrap_or_default(),
        description: serde_json::from_str(&description_json).unwrap_or_default(),
        icon_url: row.get(3)?,
        model_provider: row.get(4)?,
        model_id: row.get(5)?,
        billing_period: row.get(6)?,
        price_cny: row.get(7)?,
        price_usd: row.get(8)?,
        token_quota: row.get(9)?,
        features: serde_json::from_str(&features_json).unwrap_or_default(),
        tags: serde_json::from_str(&tags_json).unwrap_or_default(),
        popular: row.get::<_, i64>(12)? == 1,
        purchase_url: row.get(13)?,
    })
}

pub fn get_cached(pool: &crate::db::DbPool) -> rusqlite::Result<Vec<SgStoreProduct>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM ai_store_products ORDER BY popular DESC, model_provider ASC, id ASC",
        SELECT_COLS
    ))?;
    let rows = stmt.query_map([], row_to_product)?;
    rows.collect()
}

/// Atomically replace the catalog. Wrapped in a transaction so a
/// partially-applied write can never produce a half-empty Store UI.
pub fn replace_all(
    pool: &crate::db::DbPool,
    products: &[SgStoreProduct],
    etag: Option<&str>,
    now: &str,
    next_sync_at: Option<&str>,
) -> rusqlite::Result<()> {
    let mut conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let tx = conn.transaction()?;
    tx.execute("DELETE FROM ai_store_products", [])?;
    {
        let mut stmt = tx.prepare(
            "INSERT INTO ai_store_products \
             (id, name_json, description_json, icon_url, model_provider, model_id, \
              billing_period, price_cny, price_usd, token_quota, features_json, \
              tags_json, popular, purchase_url, synced_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        )?;
        for p in products {
            stmt.execute(params![
                p.id,
                serde_json::to_string(&p.name).unwrap_or_else(|_| "{}".into()),
                serde_json::to_string(&p.description).unwrap_or_else(|_| "{}".into()),
                p.icon_url,
                p.model_provider,
                p.model_id,
                p.billing_period,
                p.price_cny,
                p.price_usd,
                p.token_quota,
                serde_json::to_string(&p.features).unwrap_or_else(|_| "{}".into()),
                serde_json::to_string(&p.tags).unwrap_or_else(|_| "[]".into()),
                if p.popular { 1i64 } else { 0i64 },
                p.purchase_url,
                now,
            ])?;
        }
    }
    tx.execute(
        "UPDATE ai_store_sync_meta SET etag = ?1, last_synced_at = ?2, next_sync_at = ?3 WHERE id = 1",
        params![etag, now, next_sync_at],
    )?;
    tx.commit()?;
    Ok(())
}

pub fn read_sync_meta(pool: &crate::db::DbPool) -> rusqlite::Result<SyncMeta> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let row = conn.query_row(
        "SELECT etag, last_synced_at, next_sync_at FROM ai_store_sync_meta WHERE id = 1",
        [],
        |row| {
            Ok(SyncMeta {
                etag: row.get(0)?,
                last_synced_at: row.get(1)?,
                next_sync_at: row.get(2)?,
            })
        },
    );
    match row {
        Ok(m) => Ok(m),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(SyncMeta::default()),
        Err(e) => Err(e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_at;
    use tempfile::TempDir;

    fn mk_product(id: &str, provider: &str, popular: bool) -> SgStoreProduct {
        let mut name = HashMap::new();
        name.insert("zh-CN".into(), format!("产品 {id}"));
        name.insert("en-US".into(), format!("Product {id}"));
        let mut features = HashMap::new();
        features.insert("zh-CN".into(), vec!["要点1".into(), "要点2".into()]);
        features.insert("en-US".into(), vec!["feature1".into(), "feature2".into()]);
        SgStoreProduct {
            id: id.into(),
            name,
            description: HashMap::new(),
            icon_url: String::new(),
            model_provider: provider.into(),
            model_id: format!("{provider}-flagship"),
            billing_period: "monthly".into(),
            price_cny: 99.0,
            price_usd: 14.0,
            token_quota: 1_000_000,
            features,
            tags: vec!["popular".into()],
            popular,
            purchase_url: format!("https://sgaistore.com/buy/{id}"),
        }
    }

    fn fresh() -> (TempDir, crate::db::DbPool) {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();
        (tmp, pool)
    }

    #[test]
    fn replace_all_round_trips_localized_fields() {
        let (_tmp, pool) = fresh();
        let products = vec![
            mk_product("a", "anthropic", true),
            mk_product("b", "openai", false),
        ];
        replace_all(&pool, &products, Some("v1"), "2026-05-21T00:00:00Z", Some("2026-05-21T00:05:00Z")).unwrap();

        let got = get_cached(&pool).unwrap();
        assert_eq!(got.len(), 2);
        // ORDER BY popular DESC → 'a' first
        assert_eq!(got[0].id, "a");
        assert!(got[0].popular);
        assert_eq!(got[0].name.get("zh-CN").unwrap(), "产品 a");
        assert_eq!(got[0].features.get("en-US").unwrap()[0], "feature1");
    }

    #[test]
    fn replace_all_is_transactional() {
        let (_tmp, pool) = fresh();
        replace_all(&pool, &[mk_product("first", "anthropic", false)], None, "t1", None).unwrap();
        assert_eq!(get_cached(&pool).unwrap().len(), 1);

        // Second sync wipes the first row and inserts the new set.
        replace_all(
            &pool,
            &[mk_product("x", "openai", true), mk_product("y", "deepseek", false)],
            Some("etag-2"),
            "t2",
            Some("t2+5min"),
        )
        .unwrap();
        let after = get_cached(&pool).unwrap();
        assert_eq!(after.len(), 2);
        assert!(!after.iter().any(|p| p.id == "first"));
    }

    #[test]
    fn sync_meta_round_trip() {
        let (_tmp, pool) = fresh();
        let initial = read_sync_meta(&pool).unwrap();
        assert!(initial.etag.is_none());
        assert!(initial.last_synced_at.is_none());

        replace_all(&pool, &[], Some("etag-1"), "2026-05-21T00:00:00Z", Some("2026-05-21T00:05:00Z")).unwrap();
        let after = read_sync_meta(&pool).unwrap();
        assert_eq!(after.etag.as_deref(), Some("etag-1"));
        assert_eq!(after.last_synced_at.as_deref(), Some("2026-05-21T00:00:00Z"));
        assert_eq!(after.next_sync_at.as_deref(), Some("2026-05-21T00:05:00Z"));
    }
}
