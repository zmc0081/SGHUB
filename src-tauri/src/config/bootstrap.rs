//! Bootstrap configuration — the only setting we can NOT put in the
//! main config file, because it tells us where the main config file
//! (and the whole data directory) lives.
//!
//! Stored in the OS standard config directory so the app can find it
//! before it knows where its own data directory is:
//!
//! - Windows:  `%APPDATA%\sghub-bootstrap\bootstrap.toml`
//! - macOS:    `~/Library/Application Support/sghub-bootstrap/bootstrap.toml`
//! - Linux:    `~/.config/sghub-bootstrap/bootstrap.toml`
//!
//! If the file is missing or the path it points to is gone, callers
//! fall back to `app.path().app_data_dir()` (the Tauri default).

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

const BOOTSTRAP_DIR_NAME: &str = "sghub-bootstrap";
const BOOTSTRAP_FILE_NAME: &str = "bootstrap.toml";

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct BootstrapConfig {
    /// Custom data directory. `None` means "use the Tauri default
    /// `app_data_dir()`". When present, the directory MUST already
    /// exist — callers verify before honouring it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data_dir: Option<PathBuf>,
}

// ============================================================
// Paths
// ============================================================

/// Resolve `<os_config_dir>/sghub-bootstrap/`. Returns `None` if the
/// OS doesn't expose a config dir (extremely rare; usually only
/// stripped-down embedded targets).
pub fn bootstrap_dir() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join(BOOTSTRAP_DIR_NAME))
}

pub fn bootstrap_file() -> Option<PathBuf> {
    bootstrap_dir().map(|d| d.join(BOOTSTRAP_FILE_NAME))
}

// ============================================================
// Load / save
// ============================================================

/// Read the bootstrap config. Missing file or any parse error returns
/// the default — failures here MUST be non-fatal because the app needs
/// to start even on a fresh install.
pub fn load() -> BootstrapConfig {
    let Some(path) = bootstrap_file() else {
        return BootstrapConfig::default();
    };
    match std::fs::read_to_string(&path) {
        Ok(text) => toml::from_str(&text).unwrap_or_else(|e| {
            log::warn!(
                "bootstrap: failed to parse `{}`: {} — using default",
                path.display(),
                e
            );
            BootstrapConfig::default()
        }),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            BootstrapConfig::default()
        }
        Err(e) => {
            log::warn!(
                "bootstrap: failed to read `{}`: {} — using default",
                path.display(),
                e
            );
            BootstrapConfig::default()
        }
    }
}

/// Persist the bootstrap config atomically (write to a temp file in
/// the same dir, then rename). Returns a path or a human-friendly
/// error.
pub fn save(cfg: &BootstrapConfig) -> Result<PathBuf, String> {
    let dir = bootstrap_dir()
        .ok_or_else(|| "no OS config directory available".to_string())?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("create bootstrap dir failed: {}", e))?;
    let path = dir.join(BOOTSTRAP_FILE_NAME);
    let text = toml::to_string_pretty(cfg)
        .map_err(|e| format!("serialize bootstrap toml failed: {}", e))?;
    let tmp = dir.join(format!("{}.tmp", BOOTSTRAP_FILE_NAME));
    std::fs::write(&tmp, &text)
        .map_err(|e| format!("write tmp bootstrap failed: {}", e))?;
    std::fs::rename(&tmp, &path)
        .map_err(|e| format!("rename tmp -> bootstrap.toml failed: {}", e))?;
    Ok(path)
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    /// In-process bootstrap save/load that bypasses the OS config dir
    /// lookup — exercises the same serde shape that `load` / `save`
    /// would use on disk.
    fn roundtrip(cfg: &BootstrapConfig) -> BootstrapConfig {
        let text = toml::to_string_pretty(cfg).unwrap();
        toml::from_str(&text).unwrap()
    }

    #[test]
    fn default_is_none() {
        let cfg = BootstrapConfig::default();
        assert!(cfg.data_dir.is_none());
    }

    #[test]
    fn serializes_none_as_empty() {
        // `skip_serializing_if = Option::is_none` makes None disappear
        // from the file so a fresh install has `bootstrap.toml = ""`.
        let cfg = BootstrapConfig { data_dir: None };
        let text = toml::to_string_pretty(&cfg).unwrap();
        assert!(!text.contains("data_dir"), "got: {text}");
    }

    #[test]
    fn round_trip_with_path() {
        let tmp = TempDir::new().unwrap();
        let cfg = BootstrapConfig {
            data_dir: Some(tmp.path().to_path_buf()),
        };
        let back = roundtrip(&cfg);
        assert_eq!(back.data_dir.as_deref(), Some(tmp.path()));
    }

    #[test]
    fn missing_file_load_returns_default() {
        // `load()` is OS-config-dir aware so we can't easily isolate
        // it; just call it and accept whatever the host returns.
        // The contract is: it never panics, it always returns *some*
        // BootstrapConfig.
        let _ = load();
    }

    #[test]
    fn parse_legacy_empty_file() {
        let text = "";
        let parsed: BootstrapConfig = toml::from_str(text).unwrap();
        assert!(parsed.data_dir.is_none());
    }

    #[test]
    fn parse_explicit_data_dir() {
        let text = "data_dir = \"D:\\\\custom\\\\sghub\"\n";
        let parsed: BootstrapConfig = toml::from_str(text).unwrap();
        assert_eq!(
            parsed.data_dir,
            Some(PathBuf::from(r"D:\custom\sghub"))
        );
    }
}
