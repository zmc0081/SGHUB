//! Thin wrapper around `tauri-plugin-notification`.
//! Sending fire-and-forget — failures are logged, never propagated.

use tauri_plugin_notification::NotificationExt;

pub fn send_subscription_notification(
    app: &tauri::AppHandle,
    keyword: &str,
    new_count: usize,
) {
    let title = format!("SGHUB: 发现 {} 篇新文献", new_count);
    let body = format!("订阅: {}", keyword);
    if let Err(e) = app
        .notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
    {
        log::warn!("OS notification send failed: {}", e);
    }
}
