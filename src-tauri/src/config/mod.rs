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

pub mod bootstrap;
pub mod migration;
pub mod paths;
pub mod sources;

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
    /// V2.2.3 — Crossref "polite pool" contact e-mail. Empty = use the
    /// built-in project contact (`search::CROSSREF_MAILTO`). The CORE API key
    /// is NOT stored here — it lives in the OS keychain (see
    /// `search::set_core_api_key`) and config only ever holds references.
    #[serde(default)]
    pub crossref_mailto: String,
    /// V2.2.3 — enabled search sources. Empty = all sources enabled. The
    /// Search-page dropdown is the live selector today; this field is
    /// forward-compat for a per-source settings toggle once config
    /// persistence lands (currently a stub).
    #[serde(default)]
    pub enabled_sources: Vec<String>,
}

fn mock_app_config() -> AppConfig {
    AppConfig {
        language: None,
        theme: "light".into(),
        data_dir: r"C:\Users\zm891\AppData\Roaming\com.sghub.app".into(),
        auto_update: true,
        auto_backup: true,
        backup_retention_days: 7,
        // Real default model is derived from `model_configs.is_default`
        // (the frontend reads it from get_model_configs); the config stub
        // no longer fabricates a phantom id here.
        default_model_id: None,
        log_level: "info".into(),
        crossref_mailto: String::new(),
        enabled_sources: Vec::new(),
    }
}

#[tauri::command]
pub async fn get_app_config() -> Result<AppConfig, String> {
    Ok(mock_app_config())
}

#[tauri::command]
pub async fn save_app_config(_config: AppConfig) -> Result<(), String> {
    // Persistence is still a no-op stub (config file writer TBD). V2.2.5
    // removed the updater config + its change event, so there is nothing
    // to broadcast here anymore.
    Ok(())
}

// ============================================================
// Data-directory commands (V2.1.0)
// ============================================================

use std::path::PathBuf;

#[derive(Debug, Clone, Serialize)]
pub struct CurrentDataDir {
    pub path: String,
    pub is_custom: bool,
    pub size_mb: f64,
}

#[tauri::command]
pub fn get_current_data_dir(app: tauri::AppHandle) -> Result<CurrentDataDir, String> {
    let dir = paths::effective_data_dir(&app);
    let bs = bootstrap::load();
    let is_custom = bs.data_dir.as_ref().map(|p| p == &dir).unwrap_or(false);
    let size_mb = if dir.is_dir() {
        migration::dir_size_mb(&dir)
    } else {
        0.0
    };
    Ok(CurrentDataDir {
        path: dir.to_string_lossy().into_owned(),
        is_custom,
        size_mb,
    })
}

/// Pop the OS folder picker. Returns the chosen path or `None` when
/// the user cancels. Frontend can also drive this through the dialog
/// plugin directly — we offer this command so future migrations can
/// add validation hooks in one place.
#[tauri::command]
pub async fn select_new_data_dir(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = tokio::sync::oneshot::channel::<Option<PathBuf>>();
    app.dialog()
        .file()
        .set_title("选择数据目录 / Pick data directory")
        .pick_folder(move |p| {
            let _ = tx.send(p.and_then(|fp| fp.into_path().ok()));
        });
    let res = rx.await.map_err(|e| format!("dialog channel: {}", e))?;
    Ok(res.map(|p| p.to_string_lossy().into_owned()))
}

#[tauri::command]
pub fn validate_data_dir(
    app: tauri::AppHandle,
    path: String,
) -> Result<migration::ValidationResult, String> {
    let candidate = PathBuf::from(path);
    let current = paths::effective_data_dir(&app);
    Ok(migration::validate(&candidate, &current))
}

#[tauri::command]
pub async fn migrate_data_dir(
    app: tauri::AppHandle,
    new_path: String,
    mode: String,
) -> Result<migration::MigrationResult, String> {
    use tauri::Emitter;
    let mode_enum = migration::MigrationMode::parse(&mode)?;
    let dest = PathBuf::from(&new_path);
    let current = paths::effective_data_dir(&app);

    // Re-validate before doing real work — `validate` is cheap.
    let v = migration::validate(&dest, &current);
    if !v.valid {
        return Err(v.error.unwrap_or_else(|| "invalid path".into()));
    }

    let result = match mode_enum {
        migration::MigrationMode::Migrate => {
            let src = current.clone();
            let dest_for_copy = dest.clone();
            let app_for_emit = app.clone();
            tokio::task::spawn_blocking(move || {
                migration::copy_with_verify(&src, &dest_for_copy, move |p| {
                    if let Err(e) = app_for_emit.emit("data_migration:progress", &p) {
                        log::warn!("data_migration:progress emit failed: {}", e);
                    }
                })
            })
            .await
            .map_err(|e| format!("migration task join: {}", e))?
        }
        migration::MigrationMode::Fresh => {
            // Ensure the dest dir at least exists; we don't touch contents.
            if let Err(e) = std::fs::create_dir_all(&dest) {
                return Err(format!("create new dir: {}", e));
            }
            migration::MigrationResult {
                success: true,
                migrated_files: 0,
                total_size_mb: 0.0,
                errors: Vec::new(),
            }
        }
        migration::MigrationMode::UseExisting => {
            // We trust the user — they confirmed in the wizard that the
            // existing SGHUB data at `dest` is what they want to use.
            migration::MigrationResult {
                success: true,
                migrated_files: 0,
                total_size_mb: migration::dir_size_mb(&dest),
                errors: Vec::new(),
            }
        }
    };

    if !result.success {
        return Ok(result);
    }

    // Only after a successful copy do we flip `bootstrap.toml`. Crash
    // anywhere before this point and the user keeps booting the OLD
    // directory — their data is untouched. Load-modify-save so we don't
    // clobber `onboarding_completed` (V2.2.4).
    let mut new_bootstrap = bootstrap::load();
    new_bootstrap.data_dir = Some(dest);
    bootstrap::save(&new_bootstrap).map_err(|e| format!("write bootstrap.toml: {}", e))?;
    Ok(result)
}

/// Remove the bootstrap override — next launch will use the OS default.
/// Does NOT touch any data on disk. Preserves `onboarding_completed`
/// (V2.2.4) — we only clear the data-dir override here.
#[tauri::command]
pub fn reset_data_dir_to_default() -> Result<(), String> {
    let mut bs = bootstrap::load();
    bs.data_dir = None;
    bootstrap::save(&bs)?;
    Ok(())
}

/// Best-effort recursive delete used by the post-migration "delete old
/// directory?" prompt. Refuses any path that isn't structurally
/// SGHUB-shaped (contains `data/` subdir) to prevent foot-shooting.
#[tauri::command]
pub fn delete_old_data_dir(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.join("data").exists() {
        return Err("拒绝删除:目标目录看起来不是 SGHUB 数据目录(缺少 data/ 子目录)".into());
    }
    std::fs::remove_dir_all(&p).map_err(|e| format!("remove failed: {}", e))?;
    Ok(())
}

// ============================================================
// First-run onboarding (V2.2.4)
// ============================================================

#[derive(Debug, Clone, Serialize)]
pub struct OnboardingStatus {
    pub completed: bool,
}

/// Decide whether the first-run wizard should appear.
///
/// Priority:
/// 1. `bootstrap.onboarding_completed == true` → never show again.
/// 2. **Upgrading-user grace**: a user who already has model configs or
///    library papers predates onboarding (they upgraded into V2.2.4).
///    Auto-mark complete so we don't interrupt them, persist it so the
///    next launch skips the DB probe, and report `completed = true`.
/// 3. Otherwise it's a fresh install → `completed = false` (show wizard).
///
/// Any DB error is non-fatal: we fall back to "fresh" rather than
/// blocking boot.
#[tauri::command]
pub async fn get_onboarding_status(
    state: tauri::State<'_, crate::AppState>,
) -> Result<OnboardingStatus, String> {
    if bootstrap::load().onboarding_completed {
        return Ok(OnboardingStatus { completed: true });
    }

    let pool = state.db_pool.clone();
    let is_legacy_user = tokio::task::spawn_blocking(move || -> bool {
        let Ok(conn) = pool.get() else {
            return false;
        };
        let models: i64 = conn
            .query_row("SELECT COUNT(*) FROM model_configs", [], |r| r.get(0))
            .unwrap_or(0);
        let papers: i64 = conn
            .query_row("SELECT COUNT(*) FROM papers", [], |r| r.get(0))
            .unwrap_or(0);
        models > 0 || papers > 0
    })
    .await
    .unwrap_or(false);

    if is_legacy_user {
        let mut bs = bootstrap::load();
        bs.onboarding_completed = true;
        if let Err(e) = bootstrap::save(&bs) {
            log::warn!("onboarding: failed to persist upgrading-user grace: {}", e);
        }
        return Ok(OnboardingStatus { completed: true });
    }

    Ok(OnboardingStatus { completed: false })
}

/// Flip `onboarding_completed = true`. Called when the user finishes the
/// wizard OR skips the whole thing from the welcome screen. Idempotent.
#[tauri::command]
pub fn complete_onboarding() -> Result<(), String> {
    let mut bs = bootstrap::load();
    bs.onboarding_completed = true;
    bootstrap::save(&bs).map_err(|e| format!("write bootstrap.toml: {}", e))?;
    Ok(())
}

/// Set the **initial** data directory during onboarding. Fresh install,
/// so there is nothing to migrate — we validate the path, make sure it
/// exists, and point `bootstrap.data_dir` at it. Unlike
/// `migrate_data_dir` this never copies files. Callers should only invoke
/// this for a *custom* pick (keeping the OS default leaves
/// `bootstrap.data_dir = None`).
#[tauri::command]
pub async fn onboarding_set_data_dir(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let dest = PathBuf::from(&path);
    let current = paths::effective_data_dir(&app);
    let v = migration::validate(&dest, &current);
    if !v.valid {
        return Err(v.error.unwrap_or_else(|| "invalid path".into()));
    }
    std::fs::create_dir_all(&dest).map_err(|e| format!("create data dir: {}", e))?;
    let mut bs = bootstrap::load();
    bs.data_dir = Some(dest);
    bootstrap::save(&bs).map_err(|e| format!("write bootstrap.toml: {}", e))?;
    Ok(())
}

// ============================================================
// Literature data sources — single global toggle (V2.2.6)
// ============================================================

/// The enabled source ids (empty = all). Read by Literature Search and the
/// Today's Feed scheduler so both query the same set.
#[tauri::command]
pub fn get_enabled_sources(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    Ok(sources::load_enabled(&app))
}

/// Persist the enabled source ids (the Settings "文献数据源管理" card).
#[tauri::command]
pub fn set_enabled_sources(app: tauri::AppHandle, sources: Vec<String>) -> Result<(), String> {
    self::sources::save_enabled(&app, sources)
}

// ============================================================
// Privacy-policy consent gate (V2.2.6)
// ============================================================

#[derive(Debug, Clone, Serialize)]
pub struct PrivacyStatus {
    /// True when the user has accepted the currently-required policy version.
    pub agreed: bool,
    /// The policy version the app currently requires (kept equal to the app
    /// version — the bundled policy header must match, enforced by
    /// `scripts/check-version`).
    pub required_version: String,
    /// The version the user last accepted ("" = never).
    pub agreed_version: String,
}

/// Report whether the user must (re-)read & accept the privacy policy before
/// entering the app. A fresh install has never agreed; a policy/version bump
/// makes `agreed_version` stale and re-prompts.
#[tauri::command]
pub fn get_privacy_status(app: tauri::AppHandle) -> Result<PrivacyStatus, String> {
    let required = app.package_info().version.to_string();
    let bs = bootstrap::load();
    let agreed = bs.privacy_agreed && bs.privacy_agreed_version == required;
    Ok(PrivacyStatus {
        agreed,
        required_version: required,
        agreed_version: bs.privacy_agreed_version,
    })
}

/// Record the user's acceptance of the current policy version. Persists both
/// the flag and the accepted version into `bootstrap.toml` so a later policy
/// bump re-prompts. Idempotent.
#[tauri::command]
pub fn set_privacy_agreed(app: tauri::AppHandle) -> Result<(), String> {
    let version = app.package_info().version.to_string();
    let mut bs = bootstrap::load();
    bs.privacy_agreed = true;
    bs.privacy_agreed_version = version;
    bootstrap::save(&bs).map_err(|e| format!("write bootstrap.toml: {}", e))?;
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
            "zh",
            "zh-CN",
            "zh_CN",
            "zh-Hans",
            "zh-Hans-CN",
            "ZH-CN",
            // V2.1.0-rc2 collapses zh-TW / zh-HK into zh-CN too.
            "zh-TW",
            "zh-Hant",
            "zh-HK",
            "zh_MO",
        ] {
            assert_eq!(resolve_locale(Some(input)), "zh-CN", "input: {input}");
        }
    }

    #[test]
    fn everything_else_resolves_to_en_us() {
        for input in [
            "en-US",
            "en_GB",
            "ja-JP",
            "ja",
            "fr-FR",
            "fr_CA.UTF-8",
            "ko-KR",
            "de-DE",
            "",
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

        // Deserialize a JSON missing the optional `language` field.
        let parsed: AppConfig = serde_json::from_str(
            r#"{
            "theme":"light","data_dir":"","auto_update":true,"auto_backup":false,
            "backup_retention_days":7,"default_model_id":null,"log_level":"info"
        }"#,
        )
        .unwrap();
        assert!(parsed.language.is_none());
    }
}
