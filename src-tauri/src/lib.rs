use tauri::Manager;

pub mod ai_client;
pub mod ai_store;
pub mod chat;
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
pub mod translate;
pub mod updater;

pub struct AppState {
    pub db_pool: db::DbPool,
}

#[tauri::command]
fn get_db_status(state: tauri::State<'_, AppState>) -> Result<db::DbStatus, String> {
    db::get_status(&state.db_pool).map_err(|e| e.to_string())
}

/// Canonical app version for any in-app display (Settings / About).
/// Sourced from `package_info().version`, which Tauri derives from
/// `tauri.conf.json` (= the packaged binary's version) — never hardcoded
/// in the frontend. Keeps "installed version == displayed version".
#[tauri::command]
fn get_app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // tauri-plugin-updater requires `plugins.updater.{endpoints,pubkey}`
    // in `tauri.conf.json` to deserialize. We only register it in
    // release builds — dev builds use the UpdaterCard UI without the
    // real check (`app.updater()` returns Err and is logged + skipped).
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        // V2.1.0 — needed so the frontend can call `relaunch()` after
        // a successful data-directory migration.
        .plugin(tauri_plugin_process::init());
    #[cfg(not(debug_assertions))]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }
    builder
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

            // V2.1.0 — auto-updater scheduler. Lives independently of the
            // subscription scheduler so the user can disable one without
            // affecting the other.
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = updater::init(app_handle).await {
                    log::warn!("updater scheduler init failed: {}", e);
                }
            });

            // V2.2.1 Session 28 — AI Store catalog sync + SSE listener.
            // Both spawn long-lived tokio tasks; both are mock-only in
            // V2.2.1 (USE_MOCK_DATA = true in ai_store::sync_strategy)
            // so they never hit the network.
            ai_store::sync_strategy::start_scheduler(app.handle().clone());
            ai_store::sse_listener::spawn(app.handle().clone());

            // V2.2.1 Session 29 — SG AI Store balance auto-refresh.
            // 10s boot then hourly. Mock-only: build_mock_snapshot
            // draws a small synthetic usage on each refresh so the
            // Models card balance subtly drifts down over time.
            ai_store::billing::start_auto_refresh(app.handle().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_db_status,
            get_app_version,
            config::get_app_config,
            config::save_app_config,
            config::get_system_locale,
            config::get_current_data_dir,
            config::select_new_data_dir,
            config::validate_data_dir,
            config::migrate_data_dir,
            config::reset_data_dir_to_default,
            config::delete_old_data_dir,
            // V2.2.4 — first-run onboarding
            config::get_onboarding_status,
            config::complete_onboarding,
            config::onboarding_set_data_dir,
            config::get_privacy_status,
            config::set_privacy_agreed,
            config::get_enabled_sources,
            config::set_enabled_sources,
            updater::commands::get_updater_status,
            updater::commands::check_update_now,
            updater::commands::install_pending_update,
            search::search_papers,
            search::set_core_api_key,
            search::is_core_api_key_set,
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
            library::get_paper_folders,
            library::create_quick_folder,
            library::set_read_status,
            library::export_text_file,
            library::reveal_in_folder,
            library::pdf_download::resolve_paper_url,
            library::pdf_download::open_external_url,
            library::pdf_download::download_paper_pdf,
            library::pdf_download::cancel_download,
            library::pdf_download::open_local_pdf,
            library::pdf_download::read_pdf_bytes,
            library::pdf_download::open_pdf_with_app_picker,
            library::uploader::upload_local_paper,
            library::uploader::upload_local_papers_batch,
            library::uploader::update_paper_metadata,
            library::uploader::search_local_papers,
            library::uploader::re_extract_paper_metadata,
            library::uploader::delete_paper,
            library::uploader::delete_papers_batch,
            library::uploader::get_uploaded_pdfs_size,
            library::uploader::cleanup_orphan_pdfs,
            library::uploader::check_duplicate_pdfs,
            skill_engine::get_skills,
            skill_engine::get_skill_detail,
            skill_engine::start_parse,
            skill_engine::get_parse_history,
            skill_engine::get_parse_overview,
            skill_engine::uploader::upload_skill_file,
            skill_engine::uploader::upload_skill_zip,
            skill_engine::uploader::delete_custom_skill,
            skill_engine::uploader::save_skill,
            skill_engine::uploader::get_skill_yaml,
            skill_engine::uploader::export_skill,
            skill_engine::uploader::test_skill_with_paper,
            skill_engine::generator::generate_skill_from_description,
            skill_engine::generator::refine_skill_from_chat,
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
            ai_client::detect_ollama,
            ai_client::ai_chat_stream,
            translate::translate_document,
            ai_client::usage::get_usage_stats_7days,
            ai_client::usage::get_usage_stats_n_days,
            ai_client::usage::rebuild_usage_stats,
            chat::create_chat_session,
            chat::list_chat_sessions,
            chat::delete_chat_session,
            chat::rename_chat_session,
            chat::pin_chat_session,
            chat::get_session_detail,
            chat::set_chat_session_model,
            chat::get_messages_by_session,
            chat::upload_chat_attachment,
            chat::reference_paper_as_attachment,
            chat::send_chat_message,
            chat::cancel_chat_stream,
            chat::regenerate_message,
            chat::edit_and_resend,
            // V2.2.1 Session 28 — AI Store (use full path: tauri::command
            // macros expose a hidden __cmd__ companion at the function's
            // original module path, which a `pub use` re-export doesn't
            // carry along.)
            ai_store::commands::ai_store_get_products,
            ai_store::commands::ai_store_sync_now,
            ai_store::commands::ai_store_get_sync_status,
            // V2.2.1 Session 29 — SG AI Store billing
            ai_store::billing::ai_store_get_balance,
            ai_store::billing::ai_store_refresh_all_balances,
            // V2.2.4 — onboarding raw-key verification
            ai_store::billing::ai_store_verify_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
