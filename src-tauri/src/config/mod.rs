use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub language: String,
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
        language: "zh-CN".into(),
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
