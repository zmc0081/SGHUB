//! App-wide config & locale detection.
//!
//! V2.1.0 — `language` switched from `String` to `Option<String>`:
//!   - `Some("zh-CN")` etc. → user picked a specific language
//!   - `None`              → follow system locale (`get_system_locale`)
//!
//! Supported language codes (V2.1.0-rc2 — locked to two):
//!   zh-CN  (简体中文)
//!   en-US  (English)
//! All other OS locales resolve to en-US.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// `None` = follow system locale. Serde keeps the field absent on
    /// write when None so older configs read cleanly.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    pub theme: String,
    pub data_dir: String,
    /// Legacy v2.0 toggle. Kept as a back-compat hint but the real source
    /// of truth for the auto-updater is `updater.enabled` (V2.1.0+).
    pub auto_update: bool,
    pub auto_backup: bool,
    pub backup_retention_days: u32,
    pub default_model_id: Option<String>,
    pub log_level: String,
    /// V2.1.0 — fine-grained auto-updater schedule.
    #[serde(default = "UpdaterConfig::default")]
    pub updater: UpdaterConfig,
}

/// Auto-updater scheduling configuration (V2.1.0).
///
/// `frequency_value` semantics depend on `frequency_type`:
/// - "daily"  → run every N days (1..=30)
/// - "weekly" → 7-bit weekday bitmask
///   (Mon=1 Tue=2 Wed=4 Thu=8 Fri=16 Sat=32 Sun=64; Mon+Wed+Fri = 21)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UpdaterConfig {
    /// Master switch. When false the scheduler is removed entirely.
    pub enabled: bool,
    /// "daily" | "weekly"
    pub frequency_type: String,
    /// Days N (daily mode) or weekday bitmask (weekly mode).
    pub frequency_value: u32,
    /// "HH:MM" 24-hour local time.
    pub check_time: String,
    /// "notify" — show a system notification, user decides
    /// "silent_download" — download in background, user restarts to apply
    /// "check_only" — just mark availability, no notification, no download
    pub action: String,
    /// ISO 8601 timestamp of the last successful check (None = never).
    #[serde(default)]
    pub last_check_at: Option<String>,
}

impl Default for UpdaterConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            frequency_type: "daily".into(),
            frequency_value: 7,
            check_time: "09:00".into(),
            action: "notify".into(),
            last_check_at: None,
        }
    }
}

fn mock_app_config() -> AppConfig {
    AppConfig {
        language: None,
        theme: "light".into(),
        data_dir: r"C:\Users\zm891\AppData\Roaming\com.sghub.app".into(),
        auto_update: true,
        auto_backup: true,
        backup_retention_days: 7,
        default_model_id: Some("model-claude-opus-4-7".into()),
        log_level: "info".into(),
        updater: UpdaterConfig::default(),
    }
}

#[tauri::command]
pub async fn get_app_config() -> Result<AppConfig, String> {
    Ok(mock_app_config())
}

#[tauri::command]
pub async fn save_app_config(
    app: tauri::AppHandle,
    config: AppConfig,
) -> Result<(), String> {
    // Persistence is still a no-op stub (config file writer TBD), but we
    // fire the change event so live listeners (e.g. the updater scheduler)
    // can react to the new settings without a restart.
    use tauri::Emitter;
    if let Err(e) = app.emit("config:updater_changed", &config.updater) {
        log::warn!("config:updater_changed emit failed: {}", e);
    }
    Ok(())
}

// ============================================================
// Locale detection
// ============================================================

/// Map a raw OS locale to one of our 2 supported app locales.
/// Any "zh*" → zh-CN; everything else → en-US.
pub fn resolve_locale(raw: Option<&str>) -> String {
    let Some(raw) = raw else {
        return "en-US".into();
    };
    let trimmed = raw
        .split(['.', '@'])
        .next()
        .unwrap_or(raw)
        .replace('_', "-");
    if trimmed.to_lowercase().starts_with("zh") {
        "zh-CN".into()
    } else {
        "en-US".into()
    }
}

#[tauri::command]
pub async fn get_system_locale() -> Result<String, String> {
    let raw = sys_locale::get_locale();
    Ok(resolve_locale(raw.as_deref()))
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn any_chinese_resolves_to_zh_cn() {
        for input in [
            "zh", "zh-CN", "zh_CN", "zh-Hans", "zh-Hans-CN", "ZH-CN",
            // V2.1.0-rc2 collapses zh-TW / zh-HK into zh-CN too.
            "zh-TW", "zh-Hant", "zh-HK", "zh_MO",
        ] {
            assert_eq!(resolve_locale(Some(input)), "zh-CN", "input: {input}");
        }
    }

    #[test]
    fn everything_else_resolves_to_en_us() {
        for input in [
            "en-US", "en_GB", "ja-JP", "ja", "fr-FR", "fr_CA.UTF-8",
            "ko-KR", "de-DE", "",
        ] {
            assert_eq!(resolve_locale(Some(input)), "en-US", "input: {input}");
        }
        assert_eq!(resolve_locale(None), "en-US");
    }

    #[test]
    fn config_language_round_trips_as_optional() {
        let with_lang = AppConfig {
            language: Some("zh-CN".into()),
            ..mock_app_config()
        };
        let json = serde_json::to_string(&with_lang).unwrap();
        assert!(json.contains(r#""language":"zh-CN""#));

        let cfg_none = AppConfig {
            language: None,
            ..mock_app_config()
        };
        let json_none = serde_json::to_string(&cfg_none).unwrap();
        // `None` is skipped, not serialized as `"language":null`.
        assert!(!json_none.contains("language"), "json: {}", json_none);

        // Deserialize a JSON missing the field (also missing `updater` —
        // serde's `default = "UpdaterConfig::default"` fills it in).
        let parsed: AppConfig = serde_json::from_str(r#"{
            "theme":"light","data_dir":"","auto_update":true,"auto_backup":false,
            "backup_retention_days":7,"default_model_id":null,"log_level":"info"
        }"#).unwrap();
        assert!(parsed.language.is_none());
        assert_eq!(parsed.updater, UpdaterConfig::default());
        assert!(parsed.updater.enabled);
        assert_eq!(parsed.updater.frequency_type, "daily");
        assert_eq!(parsed.updater.frequency_value, 7);
        assert_eq!(parsed.updater.check_time, "09:00");
        assert_eq!(parsed.updater.action, "notify");
    }
}
