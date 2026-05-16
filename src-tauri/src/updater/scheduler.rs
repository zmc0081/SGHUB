//! Updater scheduler — wires `tokio-cron-scheduler` to the user's
//! `UpdaterConfig` and reschedules whenever the config changes.
//!
//! Cron expressions are 6-field (`sec min hour dom mon dow`) per
//! tokio-cron-scheduler conventions.
//!
//! Lifecycle
//! ---------
//! `init(app)` is called once during `tauri::Builder::setup`:
//!   1. Spawns a `JobScheduler`, starts it.
//!   2. Reads the current `UpdaterConfig` from `get_app_config()` and
//!      registers the first job via `reschedule`.
//!   3. Subscribes to the `config:updater_changed` event so that any
//!      `save_app_config` call live-reschedules without a restart.
//!
//! Live state
//! ----------
//! Pending update info and last-check timestamps are kept in
//! `UPDATER_STATE` (in-memory `RwLock`). On app restart they'd be
//! re-derived (`last_check_at` could also be persisted into the config
//! file by `save_app_config`, but that's a backend wiring detail
//! orthogonal to scheduling).

use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Listener};
use tokio::sync::{Mutex, RwLock};
use tokio_cron_scheduler::{Job, JobScheduler};
use uuid::Uuid;

use crate::config::UpdaterConfig;

// ============================================================
// Live state
// ============================================================

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PendingUpdate {
    pub version: String,
    pub notes: Option<String>,
    pub detected_at: String,
}

#[derive(Default)]
pub struct UpdaterState {
    pub last_check_at: Option<String>,
    pub pending: Option<PendingUpdate>,
    pub last_cron: Option<String>,
}

pub static UPDATER_STATE: OnceLock<RwLock<UpdaterState>> = OnceLock::new();

pub fn state() -> &'static RwLock<UpdaterState> {
    UPDATER_STATE.get_or_init(|| RwLock::new(UpdaterState::default()))
}

// `JobScheduler` is not Clone, so we hold it behind a mutex inside
// a `OnceLock` and add/remove a single tracked job by uuid.
struct ScheduleHandle {
    sched: JobScheduler,
    job_id: Option<Uuid>,
}

static SCHEDULE: OnceLock<Mutex<ScheduleHandle>> = OnceLock::new();

// ============================================================
// Public entry
// ============================================================

pub async fn init(app: AppHandle) -> Result<(), String> {
    // Spawn the scheduler.
    let sched = JobScheduler::new()
        .await
        .map_err(|e| format!("JobScheduler::new failed: {}", e))?;
    sched
        .start()
        .await
        .map_err(|e| format!("scheduler.start failed: {}", e))?;
    SCHEDULE
        .set(Mutex::new(ScheduleHandle {
            sched,
            job_id: None,
        }))
        .map_err(|_| "updater scheduler already initialised".to_string())?;

    // Seed with the user's current configuration.
    let cfg = crate::config::get_app_config().await?;
    if let Err(e) = reschedule(app.clone(), cfg.updater).await {
        log::warn!("initial updater reschedule failed: {}", e);
    }

    // Live reschedule on save_app_config (config::save_app_config emits
    // `config:updater_changed` with the UpdaterConfig payload).
    let listen_app = app.clone();
    app.listen("config:updater_changed", move |event| {
        let payload_str = event.payload().to_string();
        let app = listen_app.clone();
        tauri::async_runtime::spawn(async move {
            match serde_json::from_str::<UpdaterConfig>(&payload_str) {
                Ok(cfg) => {
                    if let Err(e) = reschedule(app, cfg).await {
                        log::warn!("updater live-reschedule failed: {}", e);
                    }
                }
                Err(e) => log::warn!(
                    "config:updater_changed payload parse failed: {}",
                    e
                ),
            }
        });
    });

    Ok(())
}

/// Replace any existing job with one built from `cfg`. If `cfg.enabled`
/// is false the job is simply removed.
pub async fn reschedule(app: AppHandle, cfg: UpdaterConfig) -> Result<(), String> {
    let handle = SCHEDULE
        .get()
        .ok_or_else(|| "updater scheduler not initialised".to_string())?;
    let mut guard = handle.lock().await;

    // Drop the previous job.
    if let Some(id) = guard.job_id.take() {
        if let Err(e) = guard.sched.remove(&id).await {
            log::warn!("scheduler.remove old job failed: {}", e);
        }
    }
    {
        let mut st = state().write().await;
        st.last_cron = None;
    }

    if !cfg.enabled {
        log::info!("updater: disabled (no job scheduled)");
        return Ok(());
    }

    let cron = build_cron(&cfg)?;
    log::info!("updater: scheduling with cron `{}`", cron);

    let app_for_job = app.clone();
    let cfg_for_job = cfg.clone();
    let job = Job::new_async(cron.as_str(), move |_uuid, _lock| {
        let app = app_for_job.clone();
        let cfg = cfg_for_job.clone();
        Box::pin(async move {
            run_tick(app, cfg).await;
        })
    })
    .map_err(|e| format!("Job::new_async failed: {}", e))?;
    let id = guard
        .sched
        .add(job)
        .await
        .map_err(|e| format!("scheduler.add failed: {}", e))?;
    guard.job_id = Some(id);

    {
        let mut st = state().write().await;
        st.last_cron = Some(cron);
    }
    Ok(())
}

/// Run one check. Honours the per-mode predicate (daily-N-days) so the
/// cron firing daily can still represent "every 7 days" semantics
/// reliably across month boundaries.
async fn run_tick(app: AppHandle, cfg: UpdaterConfig) {
    if cfg.frequency_type == "daily" && cfg.frequency_value > 1 {
        // Skip if last check was < N days ago.
        let last = state().read().await.last_check_at.clone();
        if let Some(prev) = last {
            if !days_since(&prev).is_some_and(|d| d >= cfg.frequency_value as i64) {
                log::info!(
                    "updater: skipping tick — last check was less than {} days ago",
                    cfg.frequency_value
                );
                return;
            }
        }
    }
    perform_check(app, &cfg.action).await;
}

/// Invoke the Tauri updater plugin and record the outcome in
/// `UPDATER_STATE`. Failure to reach the update server is logged and
/// swallowed — the scheduler should keep ticking next time.
pub async fn perform_check(app: AppHandle, action: &str) {
    let now = chrono::Utc::now()
        .format("%Y-%m-%dT%H:%M:%SZ")
        .to_string();
    {
        let mut st = state().write().await;
        st.last_check_at = Some(now.clone());
    }

    // The plugin is only registered for release builds (see lib.rs);
    // calling `app.updater()` without registration panics inside Tauri
    // (`state() called before manage()`). Gate this branch with the
    // same cfg so dev builds keep last_check_at refresh + UI flow but
    // skip the real plugin call.
    #[cfg(all(desktop, not(debug_assertions)))]
    {
        use tauri_plugin_updater::UpdaterExt;
        let updater = match app.updater() {
            Ok(u) => u,
            Err(e) => {
                log::warn!("updater: unavailable ({}). Skipping check.", e);
                return;
            }
        };
        match updater.check().await {
            Ok(Some(update)) => {
                let pending = PendingUpdate {
                    version: update.version.clone(),
                    notes: update.body.clone(),
                    detected_at: now,
                };
                log::info!("updater: update available v{}", pending.version);
                {
                    let mut st = state().write().await;
                    st.pending = Some(pending.clone());
                }
                handle_action(&app, &update, action).await;
            }
            Ok(None) => {
                log::info!("updater: no update available");
                let mut st = state().write().await;
                st.pending = None;
            }
            Err(e) => {
                log::warn!("updater: check failed: {}", e);
            }
        }
    }

    // Dev / non-desktop builds: just log and let last_check_at stand.
    #[cfg(not(all(desktop, not(debug_assertions))))]
    {
        let _ = (app, action);
        log::info!("updater: skipped (debug build / plugin not registered)");
    }
}

#[cfg(all(desktop, not(debug_assertions)))]
async fn handle_action(
    app: &AppHandle,
    update: &tauri_plugin_updater::Update,
    action: &str,
) {
    match action {
        "silent_download" => {
            // Download + install without prompting. The OS still reopens
            // the app post-install.
            let _ = update
                .download_and_install(|_chunk, _total| {}, || {})
                .await
                .map_err(|e| log::warn!("silent download failed: {}", e));
        }
        "check_only" => {
            // Do nothing — UI badge alone informs the user.
        }
        // "notify" is the default. We emit an event the frontend
        // listens to so it can pop a "update available" toast.
        _ => {
            use tauri::Emitter;
            let _ = app.emit("updater:available", &update.version);
        }
    }
}

// ============================================================
// Cron builder (pure — covered by unit tests)
// ============================================================

/// Translate `(HH, MM)` from a "HH:MM" string.
fn parse_check_time(s: &str) -> Result<(u32, u32), String> {
    let mut it = s.split(':');
    let hh = it
        .next()
        .ok_or_else(|| format!("invalid check_time `{}`", s))?
        .parse::<u32>()
        .map_err(|_| format!("invalid check_time hour `{}`", s))?;
    let mm = it
        .next()
        .ok_or_else(|| format!("invalid check_time `{}`", s))?
        .parse::<u32>()
        .map_err(|_| format!("invalid check_time minute `{}`", s))?;
    if it.next().is_some() {
        return Err(format!("check_time has extra fields: `{}`", s));
    }
    if hh > 23 || mm > 59 {
        return Err(format!("check_time out of range: `{}`", s));
    }
    Ok((hh, mm))
}

const WEEKDAY_TOKENS: [(u32, &str); 7] = [
    (1 << 0, "MON"),
    (1 << 1, "TUE"),
    (1 << 2, "WED"),
    (1 << 3, "THU"),
    (1 << 4, "FRI"),
    (1 << 5, "SAT"),
    (1 << 6, "SUN"),
];

/// Render a Mon=1..Sun=64 bitmask as `MON,WED,FRI` (in order).
fn weekday_bitmask_to_cron(mask: u32) -> String {
    let mut out: Vec<&str> = Vec::new();
    for (bit, token) in WEEKDAY_TOKENS.iter() {
        if mask & bit != 0 {
            out.push(token);
        }
    }
    out.join(",")
}

/// Build the 6-field cron string for an `UpdaterConfig`.
pub fn build_cron(cfg: &UpdaterConfig) -> Result<String, String> {
    let (hh, mm) = parse_check_time(&cfg.check_time)?;
    match cfg.frequency_type.as_str() {
        "daily" => {
            // Clamp to a sane range; UI restricts to 1..=30 but defend.
            let n = cfg.frequency_value.clamp(1, 30);
            if n == 1 {
                Ok(format!("0 {mm} {hh} * * *"))
            } else {
                // Standard cron `*/N` semantics restart at day 1 of each
                // month — close enough for "every N days" UX. The runtime
                // predicate in `run_tick` enforces the >= N day guarantee.
                Ok(format!("0 {mm} {hh} */{n} * *"))
            }
        }
        "weekly" => {
            let mask = cfg.frequency_value & 0x7F;
            if mask == 0 {
                return Err("weekly mode requires at least one weekday".into());
            }
            let days = weekday_bitmask_to_cron(mask);
            Ok(format!("0 {mm} {hh} * * {days}"))
        }
        other => Err(format!("unknown frequency_type: `{}`", other)),
    }
}

// ============================================================
// Helpers
// ============================================================

fn days_since(iso: &str) -> Option<i64> {
    let then = chrono::DateTime::parse_from_rfc3339(iso).ok()?;
    let now = chrono::Utc::now();
    Some((now - then.with_timezone(&chrono::Utc)).num_days())
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn cfg(
        ftype: &str,
        fval: u32,
        time: &str,
    ) -> UpdaterConfig {
        UpdaterConfig {
            enabled: true,
            frequency_type: ftype.into(),
            frequency_value: fval,
            check_time: time.into(),
            action: "notify".into(),
            last_check_at: None,
        }
    }

    #[test]
    fn parse_time_basic() {
        assert_eq!(parse_check_time("09:00").unwrap(), (9, 0));
        assert_eq!(parse_check_time("00:01").unwrap(), (0, 1));
        assert_eq!(parse_check_time("23:59").unwrap(), (23, 59));
    }

    #[test]
    fn parse_time_rejects_garbage() {
        assert!(parse_check_time("9").is_err());
        assert!(parse_check_time("24:00").is_err());
        assert!(parse_check_time("12:60").is_err());
        assert!(parse_check_time("12:34:56").is_err());
        assert!(parse_check_time("ab:cd").is_err());
    }

    #[test]
    fn weekday_mask_to_cron_orderly() {
        assert_eq!(weekday_bitmask_to_cron(0), "");
        assert_eq!(weekday_bitmask_to_cron(1), "MON");
        assert_eq!(weekday_bitmask_to_cron(1 + 4 + 16), "MON,WED,FRI");
        assert_eq!(
            weekday_bitmask_to_cron(0x7F),
            "MON,TUE,WED,THU,FRI,SAT,SUN"
        );
        // Bits above weekday 7 are silently masked off by the caller.
        assert_eq!(weekday_bitmask_to_cron(64), "SUN");
    }

    #[test]
    fn cron_daily_every_day() {
        let c = cfg("daily", 1, "09:00");
        assert_eq!(build_cron(&c).unwrap(), "0 0 9 * * *");
    }

    #[test]
    fn cron_daily_every_7_days() {
        let c = cfg("daily", 7, "09:00");
        assert_eq!(build_cron(&c).unwrap(), "0 0 9 */7 * *");
    }

    #[test]
    fn cron_daily_clamps_out_of_range() {
        // Frontend should enforce 1..=30 but we defend in depth.
        let lo = cfg("daily", 0, "10:30");
        assert_eq!(build_cron(&lo).unwrap(), "0 30 10 * * *");
        let hi = cfg("daily", 99, "10:30");
        assert_eq!(build_cron(&hi).unwrap(), "0 30 10 */30 * *");
    }

    #[test]
    fn cron_weekly_mon_wed_fri() {
        let c = cfg("weekly", 1 + 4 + 16, "09:00");
        assert_eq!(build_cron(&c).unwrap(), "0 0 9 * * MON,WED,FRI");
    }

    #[test]
    fn cron_weekly_all_seven() {
        let c = cfg("weekly", 0x7F, "09:00");
        assert_eq!(
            build_cron(&c).unwrap(),
            "0 0 9 * * MON,TUE,WED,THU,FRI,SAT,SUN"
        );
    }

    #[test]
    fn cron_weekly_empty_mask_errors() {
        let c = cfg("weekly", 0, "09:00");
        assert!(build_cron(&c).is_err());
    }

    #[test]
    fn cron_unknown_frequency_errors() {
        let c = cfg("hourly", 1, "09:00");
        assert!(build_cron(&c).is_err());
    }

    #[test]
    fn cron_respects_minute_hour() {
        let c = cfg("daily", 1, "23:45");
        assert_eq!(build_cron(&c).unwrap(), "0 45 23 * * *");
    }

    #[test]
    fn days_since_recent() {
        let now = chrono::Utc::now();
        let one_day_ago = (now - chrono::Duration::days(1))
            .format("%Y-%m-%dT%H:%M:%SZ")
            .to_string();
        let d = days_since(&one_day_ago).unwrap();
        assert!((0..=1).contains(&d), "expected 0 or 1, got {d}");
    }

    #[test]
    fn days_since_invalid_iso() {
        assert_eq!(days_since("not a date"), None);
    }
}
