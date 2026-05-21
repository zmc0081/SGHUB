//! SSE listener for `products-updated` notifications from
//! sgaistore.com. While the real endpoint is pre-launch, this module
//! is mock-only: a tokio task that fires a synthetic event every
//! `MOCK_TICK` so the rest of the system (sync_strategy, frontend
//! listener) sees the same shape it will see in production.
//!
//! Production path (commented out, behind `USE_MOCK_DATA`):
//!   1. open GET `{base}/api/products/stream` with `Accept: text/event-stream`
//!   2. parse named events:
//!         event: products-updated
//!         data: {"etag":"..."}
//!         event: heartbeat
//!         data: {}
//!   3. on `products-updated` → call sync_strategy::sync_now
//!   4. on disconnect → exponential backoff (1s → 2s → 4s → … capped at 60s)
//!   5. heartbeat watchdog: if no heartbeat in 90s, drop the connection
//!      and reconnect.

use std::time::Duration;

use tauri::{AppHandle, Emitter};
use tokio::time::sleep;

use super::sync_strategy::{Trigger, SYNC_TRIGGER_EVENT};

/// Synthetic mock cadence — keep this slower than the periodic sync
/// (5 min) so users mostly see the "refreshed by sync" UX flow rather
/// than "refreshed by SSE", which would over-claim what the mock can do.
const MOCK_TICK: Duration = Duration::from_secs(15 * 60);

/// Spawn the SSE listener task (mock-only in V2.2.1).
///
/// Returns immediately; the task lives for the lifetime of the app.
pub fn spawn(app: AppHandle) {
    tokio::spawn(async move {
        log::info!("ai_store::sse_listener: starting in MOCK mode (tick {:?})", MOCK_TICK);

        // First synthetic event after one tick — give the periodic
        // first-boot sync (sync_strategy::INITIAL_DELAY) a chance to
        // populate the cache before SSE jolts a re-fetch.
        loop {
            sleep(MOCK_TICK).await;
            log::debug!("ai_store::sse_listener: mock 'products-updated' tick");
            // Tell the frontend "the catalog might be stale" so the
            // header indicator can reflect that.
            if let Err(e) = app.emit("ai_store:products_updated", ()) {
                log::warn!("ai_store::sse_listener: emit failed: {}", e);
            }
            // Also nudge the sync strategy to run an immediate refresh.
            if let Err(e) = app.emit(SYNC_TRIGGER_EVENT, Trigger::SsePushed) {
                log::warn!("ai_store::sse_listener: trigger emit failed: {}", e);
            }
        }

        // V2.2.x — real implementation will live here, gated by
        // `if !USE_MOCK_DATA { real_loop(app).await; }`. Sketch:
        //
        //   loop {
        //       match connect_sse(&base_url).await { ... }
        //       sleep(backoff(retries)).await;
        //   }
    });
}
