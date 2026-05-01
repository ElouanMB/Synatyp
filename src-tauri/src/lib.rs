pub mod commands;
pub mod compiler;
pub mod models;
pub mod ai;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenvy::dotenv().ok();
    tauri::Builder::default()
        .manage(compiler::CompilerState::new())
        .manage(ai::AiState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::compile,
            commands::render_page,
            commands::export_pdf,
            commands::open_file,
            commands::save_file,
            commands::resolve_click,
            commands::resolve_position,
            commands::init_project,
            commands::import_asset,
            commands::list_project_files,
            commands::list_projects,
            commands::delete_project,
            commands::rename_project,
            commands::search_projects,
            commands::create_file,
            commands::rename_file,
            commands::delete_file,
            commands::create_dir,
            commands::show_in_folder,
            commands::apply_text_edit,
            commands::setup_delta_plane_assets,
            commands::get_projects_dir,
            commands::call_gemini,
            commands::unlock_ai,
            models::unlock_models
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
