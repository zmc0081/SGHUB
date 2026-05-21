//! SG AI Store integration (V2.2.1 Session 28).
//!
//! Three sub-modules, deliberately kept small so each unit is reviewable
//! on its own:
//!
//!   - [`products`]       local cache of the SG AI Store SKU catalog
//!                        backed by `ai_store_products` (V005). Owns
//!                        the ETag / "synced_at" bookkeeping in
//!                        `ai_store_sync_meta`.
//!   - [`sse_listener`]   long-lived task that subscribes to
//!                        `https://sgaistore.com/api/products/stream`
//!                        for live `products-updated` notifications.
//!                        In mock mode (default in V2.2.1) emits a
//!                        synthetic event on a timer.
//!   - [`sync_strategy`]  orchestrates the periodic + on-demand
//!                        refreshes: first sync 5s after boot, periodic
//!                        every 5 minutes, immediate on SSE push, and
//!                        a graceful offline degradation path.
//!
//! Public surface:
//!   - Tauri commands re-exported from [`commands`].
//!   - Each command returns its own typed payload; nothing leaks raw
//!     SQL rows to the frontend.
//!
//! Mock mode is the default while sgaistore.com is pre-launch — every
//! HTTP / SSE path is gated by `USE_MOCK_DATA = true` so a fresh `cargo
//! tauri dev` never reaches the wire. Flip to `false` once the real
//! endpoint is up and you want to exercise the network path.

pub mod commands;
pub mod products;
pub mod sse_listener;
pub mod sync_strategy;

pub use commands::{
    ai_store_get_products, ai_store_get_sync_status, ai_store_sync_now, SgStoreProduct,
    SgStoreSyncResult, SyncStatus,
};
