use tauri::Manager;

pub mod ai_client;
pub mod config;
pub mod db;
pub mod keychain;
pub mod library;
pub mod notify;
pub mod pdf_extract;
pub mod scheduler;
pub mod search;
pub mod skill_engine;
pub mod subscription;

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
        .plugin(tauri_plugin_notification::init())
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

            // Spawn the cron scheduler (daily 09:00) — non-fatal if it fails.
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = scheduler::start(app_handle).await {
                    log::warn!("scheduler start failed: {}", e);
                }
            });

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
            library::get_recent_papers,
            library::get_paper,
            library::set_read_status,
            library::export_text_file,
            skill_engine::get_skills,
            skill_engine::start_parse,
            skill_engine::get_parse_history,
            subscription::create_subscription,
            subscription::update_subscription,
            subscription::delete_subscription,
            subscription::toggle_subscription_active,
            subscription::get_subscriptions,
            subscription::get_subscription_results,
            subscription::mark_subscription_paper_read,
            subscription::get_unread_subscription_count,
            subscription::get_notifications,
            subscription::mark_notification_read,
            subscription::run_subscriptions_now,
            ai_client::get_model_configs,
            ai_client::add_model_config,
            ai_client::update_model_config,
            ai_client::delete_model_config,
            ai_client::set_default_model,
            ai_client::get_model_presets,
            ai_client::test_model_connection,
            ai_client::ai_chat_stream,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
