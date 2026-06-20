//! V2.2.6 — the single global "enabled literature sources" toggle.
//!
//! One place configures which of the 8 sources are queried; Literature Search
//! and Today's Feed both read this, so the two stay consistent (the Settings
//! "文献数据源管理" card is the only editor). Stored as JSON in the data
//! directory so it travels with the rest of the data on a data-dir move.
//!
//! Convention (matches the old `AppConfig.enabled_sources`): an EMPTY list
//! means "all sources enabled" (fresh install / never configured).

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

const FILE: &str = "sources.json";

/// Canonical id list — the order is also the search/merge priority.
pub const ALL_SOURCES: [&str; 8] = [
    "arxiv",
    "semantic_scholar",
    "pubmed",
    "openalex",
    "crossref",
    "core",
    "dblp",
    "doaj",
];

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct SourcesConfig {
    /// Enabled source ids. EMPTY = all enabled.
    #[serde(default)]
    enabled: Vec<String>,
}

fn file_path(app: &tauri::AppHandle) -> PathBuf {
    crate::config::paths::data_root(app).join(FILE)
}

/// Enabled source ids; empty = all (missing file / parse error → empty).
pub fn load_enabled(app: &tauri::AppHandle) -> Vec<String> {
    match std::fs::read_to_string(file_path(app)) {
        Ok(t) => serde_json::from_str::<SourcesConfig>(&t)
            .map(|c| c.enabled)
            .unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

/// Persist the enabled source ids (unknown ids are dropped so the file can't
/// drift from `ALL_SOURCES`).
pub fn save_enabled(app: &tauri::AppHandle, enabled: Vec<String>) -> Result<(), String> {
    let enabled: Vec<String> = enabled
        .into_iter()
        .filter(|s| ALL_SOURCES.contains(&s.as_str()))
        .collect();
    let path = file_path(app);
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("create data dir: {}", e))?;
    }
    let text = serde_json::to_string_pretty(&SourcesConfig { enabled })
        .map_err(|e| format!("serialize sources.json: {}", e))?;
    std::fs::write(&path, text).map_err(|e| format!("write sources.json: {}", e))?;
    Ok(())
}

/// Whether `name` should be queried, given the loaded enabled set
/// (empty set = everything on).
pub fn is_enabled(enabled: &[String], name: &str) -> bool {
    enabled.is_empty() || enabled.iter().any(|s| s == name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_means_all_enabled() {
        let enabled: Vec<String> = Vec::new();
        for s in ALL_SOURCES {
            assert!(is_enabled(&enabled, s), "{s} should be on when empty");
        }
    }

    #[test]
    fn subset_only_enables_listed() {
        let enabled = vec!["arxiv".to_string(), "dblp".to_string()];
        assert!(is_enabled(&enabled, "arxiv"));
        assert!(is_enabled(&enabled, "dblp"));
        assert!(!is_enabled(&enabled, "pubmed"));
        assert!(!is_enabled(&enabled, "core"));
    }
}
