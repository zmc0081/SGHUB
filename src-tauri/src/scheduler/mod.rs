//! Periodic execution of active subscriptions via `tokio-cron-scheduler`.
//!
//! v1: hardcoded daily at 09:00 local time. Future: read cron expression
//! from `config.toml` (`subscriptions.cron_expr`).

use tokio_cron_scheduler::{Job, JobScheduler};

const DEFAULT_CRON: &str = "0 0 9 * * *"; // sec min hour dom mon dow — daily 09:00

pub async fn start(app: tauri::AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let sched = JobScheduler::new().await?;

    let app_for_job = app.clone();
    let job = Job::new_async(DEFAULT_CRON, move |_uuid, _l| {
        let app = app_for_job.clone();
        Box::pin(async move {
            log::info!("scheduler: cron tick — running active subscriptions");
            crate::subscription::run_all_active(&app).await;
        })
    })?;
    sched.add(job).await?;

    sched.start().await?;
    log::info!("scheduler started: cron `{}`", DEFAULT_CRON);

    // Keep the scheduler alive for the app's lifetime.
    // (JobScheduler doesn't impl Clone; leak is the simplest "live forever".)
    Box::leak(Box::new(sched));
    Ok(())
}
