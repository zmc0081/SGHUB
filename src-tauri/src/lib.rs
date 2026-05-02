use tauri::Manager;

pub mod ai_client;
pub mod config;
pub mod db;
pub mod keychain;
pub mod library;
pub mod search;

pub struct AppState {
    pub db_pool: db::DbPool,
}

#[tauri::command]
fn get_db_status(state: tauri::State<'_, AppState>) -> Result<db::DbStatus, String> {
    db::get_status(&state.db_pool).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let pool = db::init(app.handle())?;
            app.manage(AppState { db_pool: pool });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_db_status,
            config::get_app_config,
            config::save_app_config,
            search::search_papers,
            library::get_folders,
            library::get_folder_tree,
            library::create_folder,
            library::rename_folder,
            library::move_folder,
            library::delete_folder,
            library::reorder_folders,
            library::add_to_folder,
            library::remove_from_folder,
            library::move_paper_to_folder,
            library::batch_add_to_folder,
            library::create_tag,
            library::delete_tag,
            library::get_tags,
            library::add_tag_to_paper,
            library::remove_tag_from_paper,
            library::batch_tag,
            library::get_papers_by_folder,
            library::get_papers_by_tag,
            library::set_read_status,
            library::export_text_file,
            ai_client::get_model_configs,
            ai_client::add_model_config,
            ai_client::update_model_config,
            ai_client::delete_model_config,
            ai_client::set_default_model,
            ai_client::get_model_presets,
            ai_client::test_model_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
