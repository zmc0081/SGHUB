//! Tauri command surface for AI Store. Three commands, each a thin
//! wrapper around `products` / `sync_strategy`:
//!
//!   - `ai_store_get_products`   read the cached catalog (no network)
//!   - `ai_store_sync_now`       force an immediate refresh
//!   - `ai_store_get_sync_status` cheap snapshot of the sync_meta row
//!
//! The frontend may call these instead of using its `USE_MOCK_DATA`
//! shortcut; both code paths surface the same shape.

use serde::Serialize;
use tauri::AppHandle;

use crate::AppState;

pub use super::products::SgStoreProduct;
use super::products::{self, SyncMeta};
use super::sync_strategy::{self, Trigger};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SyncState {
    Synced,
    Syncing,
    Offline,
    Stale,
}

#[derive(Debug, Clone, Serialize)]
pub struct SyncStatus {
    pub state: SyncState,
    pub last_synced_at: Option<String>,
    pub next_sync_at: Option<String>,
    pub product_count: i64,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SgStoreSyncResult {
    pub products: Vec<SgStoreProduct>,
    pub status: SyncStatus,
}

fn build_status(meta: SyncMeta, product_count: i64) -> SyncStatus {
    let state = if meta.last_synced_at.is_none() {
        SyncState::Stale
    } else {
        SyncState::Synced
    };
    SyncStatus {
        state,
        last_synced_at: meta.last_synced_at,
        next_sync_at: meta.next_sync_at,
        product_count,
        message: None,
    }
}

#[tauri::command]
pub async fn ai_store_get_products(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<SgStoreProduct>, String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || products::get_cached(&pool))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ai_store_sync_now(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<SgStoreSyncResult, String> {
    let _count = sync_strategy::run_once(&app, Trigger::Manual).await?;

    // Re-read the freshly-written cache + meta to return the
    // canonical view rather than echoing the in-memory list.
    let pool = state.db_pool.clone();
    let (products, meta) = tokio::task::spawn_blocking(move || -> Result<_, String> {
        let products = products::get_cached(&pool).map_err(|e| e.to_string())?;
        let meta = products::read_sync_meta(&pool).map_err(|e| e.to_string())?;
        Ok((products, meta))
    })
    .await
    .map_err(|e| e.to_string())??;

    let product_count = products.len() as i64;
    Ok(SgStoreSyncResult {
        products,
        status: build_status(meta, product_count),
    })
}

#[tauri::command]
pub async fn ai_store_get_sync_status(
    state: tauri::State<'_, AppState>,
) -> Result<SyncStatus, String> {
    let pool = state.db_pool.clone();
    let (meta, product_count) = tokio::task::spawn_blocking(move || -> Result<_, String> {
        let meta = products::read_sync_meta(&pool).map_err(|e| e.to_string())?;
        let conn = pool.get().map_err(|e| e.to_string())?;
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM ai_store_products", [], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        Ok((meta, count))
    })
    .await
    .map_err(|e| e.to_string())??;
    Ok(build_status(meta, product_count))
}
