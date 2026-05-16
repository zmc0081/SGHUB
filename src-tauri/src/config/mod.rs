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
    pub auto_update: bool,
    pub auto_backup: bool,
    pub backup_retention_days: u32,
    pub default_model_id: Option<String>,
    pub log_level: String,
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
    }
}

#[tauri::command]
pub async fn get_app_config() -> Result<AppConfig, String> {
    Ok(mock_app_config())
}

#[tauri::command]
pub async fn save_app_config(config: AppConfig) -> Result<(), String> {
    let _ = config;
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

        // Deserialize a JSON missing the field
        let parsed: AppConfig = serde_json::from_str(r#"{
            "theme":"light","data_dir":"","auto_update":true,"auto_backup":false,
            "backup_retention_days":7,"default_model_id":null,"log_level":"info"
        }"#).unwrap();
        assert!(parsed.language.is_none());
    }
}
