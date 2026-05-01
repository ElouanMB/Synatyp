use crate::compiler::{self, CompileResult, CompilerState};
use crate::ai::AiState;
use crate::models;
use tauri::{command, State};
use typst::layout::PagedDocument;
use typst::World;
use std::sync::Arc;

#[derive(serde::Serialize)]
pub struct SourcePosition {
    pub offset: usize,
    pub byte_offset: usize,
    pub x: f32,
    pub y: f32,
    pub height: f32,
    pub page: usize,
}

#[command]
pub async fn compile(
    source: String, 
    project_path: Option<String>, 
    active_page: Option<usize>,
    state: State<'_, CompilerState>
) -> Result<CompileResult, String> {
    Ok(compiler::compile_to_svg(source, project_path, &state, active_page))
}

#[command]
pub async fn render_page(page_index: usize, state: State<'_, CompilerState>) -> Result<compiler::RenderResult, String> {
    compiler::render_page_data(page_index, &state).ok_or_else(|| "Failed to render page".to_string())
}

#[command]
pub async fn open_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[command]
pub async fn save_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[command]
pub async fn export_pdf(source: String, project_path: Option<String>, path: String) -> Result<(), String> {
    let pdf = compiler::compile_to_pdf(source, project_path).map_err(|errs| {
        errs.first()
            .map(|e| e.message.clone())
            .unwrap_or_else(|| "Unknown error".to_string())
    })?;
    std::fs::write(path, pdf).map_err(|e| e.to_string())
}

#[command]
pub async fn init_project(name: String, app_handle: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let projects_dir = app_dir.join("projects");
    let project_dir = projects_dir.join(&name);
    
    std::fs::create_dir_all(&project_dir).map_err(|e| e.to_string())?;
    
    let project_path_str = project_dir.to_string_lossy().to_string();
    if let Err(e) = setup_assets_internal(&project_path_str, &app_handle) {
        eprintln!("[AssetSetup] Error: {}", e);
    }
    
    // Create the dedicated assets directory for the project.
    std::fs::create_dir_all(project_dir.join("assets")).map_err(|e| e.to_string())?;
    
    // Initialize the project with a main document if it does not already exist.
    let main_typ = project_dir.join("main.typ");
    if !main_typ.exists() {
        std::fs::write(&main_typ, "= Nouveau Projet\n\nCommencez à écrire ici.").map_err(|e| e.to_string())?;
    }
    
    Ok(project_dir.to_string_lossy().to_string().replace("\\", "/"))
}

#[command]
pub async fn import_asset(project_path: String, asset_path: String) -> Result<String, String> {
    let project_dir = std::path::Path::new(&project_path);
    let assets_dir = project_dir.join("assets");
    
    if !assets_dir.exists() {
        std::fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
    }
    
    let asset_name = std::path::Path::new(&asset_path).file_name().ok_or("Invalid asset path")?;
    let dest_path = assets_dir.join(asset_name);
    
    std::fs::copy(&asset_path, &dest_path).map_err(|e| e.to_string())?;
    
    Ok(format!("assets/{}", asset_name.to_string_lossy()))
}

#[command]
pub async fn setup_delta_plane_assets(project_path: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    setup_assets_internal(&project_path, &app_handle).map_err(|e| e.to_string())
}

fn setup_assets_internal(project_path: &str, app_handle: &tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let project_dir = std::path::Path::new(project_path);
    
    // Initialize target directory structure within the project.
    let assets_target = project_dir.join("assets");
    let fonts_target = project_dir.join("fonts");
    std::fs::create_dir_all(&assets_target).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&fonts_target).map_err(|e| e.to_string())?;

    // Resolve the source directory for application assets.
    let mut resources_root = None;

    // 1. Try production resource directory (bundled)
    if let Ok(res) = app_handle.path().resource_dir() {
        if res.join("assets").exists() && res.join("fonts").exists() {
            resources_root = Some(res);
        } else if res.join("_up_").join("resources").join("assets").exists() {
            resources_root = Some(res.join("_up_").join("resources"));
        }
    }

    // 2. Fallback to searching parents (development/unpacked build)
    if resources_root.is_none() || !resources_root.as_ref().unwrap().join("assets").exists() {
        let mut current_search = std::env::current_dir().map_err(|e| e.to_string())?;
        for _ in 0..6 {
            let check = current_search.join("resources");
            if check.exists() && check.join("assets").exists() && check.join("fonts").exists() {
                resources_root = Some(check);
                break;
            }
            if let Some(parent) = current_search.parent() {
                current_search = parent.to_path_buf();
            } else {
                break;
            }
        }
    }

    let resources_dir = resources_root.ok_or_else(|| "Could not find resources directory in any expected location".to_string())?;
    println!("[AssetSetup] Using resources from: {:?}", resources_dir);
    
    let logo_src = resources_dir.join("assets").join("logo text long color.png");
    let fonts_src = resources_dir.join("fonts");

    // Copy branding and core assets.
    if logo_src.exists() {
        std::fs::copy(&logo_src, assets_target.join("logo text long color.png")).map_err(|e| e.to_string())?;
    }

    // Recursively synchronize font files.
    fn copy_dir_all(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
        std::fs::create_dir_all(dst)?;
        for entry in std::fs::read_dir(src)? {
            let entry = entry?;
            let ty = entry.file_type()?;
            if ty.is_dir() {
                copy_dir_all(&entry.path(), &dst.join(entry.file_name()))?;
            } else {
                std::fs::copy(entry.path(), dst.join(entry.file_name()))?;
            }
        }
        Ok(())
    }

    if fonts_src.exists() {
        copy_dir_all(&fonts_src, &fonts_target).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[derive(serde::Serialize)]
pub struct FileItem {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileItem>>,
}

#[command]
pub async fn list_project_files(project_path: String) -> Result<Vec<FileItem>, String> {
    let root = std::path::Path::new(&project_path);
    if !root.exists() {
        return Ok(Vec::new());
    }

    fn walk(dir: &std::path::Path) -> Vec<FileItem> {
        let mut items = Vec::new();
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                let normalized_path = path.to_string_lossy().to_string().replace("\\", "/");
                let is_dir = path.is_dir();
                
                let children = if is_dir {
                    Some(walk(&path))
                } else {
                    None
                };

                items.push(FileItem {
                    name,
                    path: normalized_path,
                    is_dir,
                    children,
                });
            }
        }
        items
    }
    
    Ok(walk(root))
}

#[derive(serde::Serialize)]
pub struct ProjectInfo {
    pub name: String,
    pub path: String,
}

#[command]
pub async fn list_projects(app_handle: tauri::AppHandle) -> Result<Vec<ProjectInfo>, String> {
    use tauri::Manager;
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let projects_dir = app_dir.join("projects");
    
    if !projects_dir.exists() {
        return Ok(Vec::new());
    }
    
    let mut projects = Vec::new();
    if let Ok(entries) = std::fs::read_dir(projects_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(name) = path.file_name() {
                    projects.push(ProjectInfo {
                        name: name.to_string_lossy().to_string(),
                        path: path.to_string_lossy().to_string().replace("\\", "/"),
                    });
                }
            }
        }
    }
    
    Ok(projects)
}

#[command]
pub async fn delete_project(name: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let projects_dir = app_dir.join("projects");
    let project_dir = projects_dir.join(&name);
    
    if project_dir.exists() {
        std::fs::remove_dir_all(project_dir).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[command]
pub async fn rename_project(old_name: String, new_name: String, app_handle: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let projects_dir = app_dir.join("projects");
    let old_dir = projects_dir.join(&old_name);
    let new_dir = projects_dir.join(&new_name);
    
    if !old_dir.exists() {
        return Err("Project does not exist".to_string());
    }
    
    if new_dir.exists() {
        return Err("A project with this name already exists".to_string());
    }
    
    std::fs::rename(old_dir, &new_dir).map_err(|e| e.to_string())?;
    
    Ok(new_dir.to_string_lossy().to_string().replace("\\", "/"))
}

#[command]
pub async fn resolve_click(
    page: u32, 
    x: f64, 
    y: f64, 
    source: String, 
    project_path: Option<String>,
    state: State<'_, CompilerState>
) -> Result<Option<SourcePosition>, String> {
    let world;
    let document;
    let root = project_path.map(std::path::PathBuf::from);
    
    if let Some(doc) = state.get_document(&source) {
        document = doc;
        world = compiler::MemoryWorld::new(source, root);
    } else {
        world = compiler::MemoryWorld::new(source, root);
        let warned = typst::compile::<PagedDocument>(&world);
        document = Arc::new(warned.output.map_err(|_| "Compilation failed".to_string())?);
    }

    let page_idx = (page as usize).saturating_sub(1);
    let page_obj = document.pages.get(page_idx).ok_or_else(|| "Page not found".to_string())?;
    let frame = &page_obj.frame;

    let source_obj = World::source(&world, world.main()).map_err(|e| e.to_string())?;
    let res = compiler::resolve_offset(&source_obj, frame, x as f32, y as f32);
    
    let Some((off, gx, gy, gh)) = res else {
        return Ok(None);
    };

    // --- Check if the resolved offset is inside a function definition body ---
    // If so, remap to the nearest call-site string argument
    let remapped_off = remap_func_body_offset(&source_obj, &document, off, page_idx, y as f32)
        .unwrap_or(off);

    let text = source_obj.text();
    let char_offset = text.get(..remapped_off).map(|s| s.chars().count()).unwrap_or(remapped_off);
    
    println!("  -> byte_offset: {} (remapped from {}), char: {}, pos: ({},{})", remapped_off, off, char_offset, gx, gy);
    Ok(Some(SourcePosition { 
        offset: char_offset,
        byte_offset: remapped_off,
        x: gx,
        y: gy,
        height: gh,
        page: page as usize,
    }))
}

/// If `off` falls inside a `#let func(params) = { ... }` body, find all calls to
/// that function and return the byte offset of the string argument of the call
/// whose rendered Y position on `page_idx` is closest to `click_y`.
fn remap_func_body_offset(
    source: &typst::syntax::Source,
    document: &typst::layout::PagedDocument,
    off: usize,
    page_idx: usize,
    click_y: f32,
) -> Option<usize> {
    use typst::syntax::{LinkedNode, SyntaxKind};

    let root = LinkedNode::new(source.root());

    // 1. Find the LetBinding (function def) that contains this offset
    fn find_let_binding<'a>(node: LinkedNode<'a>, off: usize, depth: usize) -> Option<LinkedNode<'a>> {
        let range = node.range();
        if off < range.start || off >= range.end {
            return None;
        }
        if node.kind() == SyntaxKind::LetBinding {
            let has_params = node.children().any(|c| c.kind() == SyntaxKind::Params);
            let has_closure = node.children().any(|c| c.kind() == SyntaxKind::Closure);
            if has_params || has_closure {
                return Some(node);
            }
        }
        for child in node.children() {
            if let Some(found) = find_let_binding(child, off, depth + 1) {
                return Some(found);
            }
        }
        None
    }

    let let_binding = find_let_binding(root.clone(), off, 0);
    if let_binding.is_none() {
        return None;
    }
    let let_binding = let_binding.unwrap();

    // 2. Get the function name (the Ident right after `let` or inside `Closure`)
    let func_name: String = if let Some(ident) = let_binding.children().find(|c| c.kind() == SyntaxKind::Ident) {
        ident.text().to_string()
    } else if let Some(closure) = let_binding.children().find(|c| c.kind() == SyntaxKind::Closure) {
        if let Some(ident) = closure.children().find(|c| c.kind() == SyntaxKind::Ident) {
            ident.text().to_string()
        } else {
            return None;
        }
    } else {
        return None;
    };

    // 3. Collect all call sites: FuncCall nodes outside any LetBinding, calling func_name
    fn collect_calls<'a>(
        node: LinkedNode<'a>,
        func_name: &str,
        in_let: bool,
        calls: &mut Vec<(usize, usize)>, // (call_start, first_str_arg_inner_start)
        src_text: &str,
    ) {
        let in_let_now = in_let || (node.kind() == SyntaxKind::LetBinding
            && node.children().any(|c| c.kind() == SyntaxKind::Params || c.kind() == SyntaxKind::Closure));

        if !in_let_now && node.kind() == SyntaxKind::FuncCall {
            // Find the identifier child that matches our function name
            let callee_matches = node.children()
                .any(|c| {
                    if c.kind() == SyntaxKind::Ident {
                        c.text() == func_name
                    } else if c.kind() == SyntaxKind::FieldAccess {
                        c.children().last().map(|cc| cc.text() == func_name).unwrap_or(false)
                    } else {
                        false
                    }
                });

            if callee_matches {
                // Find the first Str argument
                let str_arg = node.children()
                    .find(|c| c.kind() == SyntaxKind::Args)
                    .and_then(|args| args.children().find(|c| c.kind() == SyntaxKind::Str));

                if let Some(str_node) = str_arg {
                    let range = str_node.range();
                    if range.len() >= 2 {
                        calls.push((node.range().start, range.start + 1));
                    }
                }
            }
        }

        for child in node.children() {
            collect_calls(child, func_name, in_let_now, calls, src_text);
        }
    }

    let mut calls: Vec<(usize, usize)> = Vec::new();
    collect_calls(root, &func_name, false, &mut calls, source.text());

    if calls.is_empty() {
        return None;
    }

    if calls.len() == 1 {
        return Some(calls[0].1);
    }

    // 4. Multiple calls: find the one whose rendered position is closest to click_y on page_idx
    let page_height = document.pages.get(page_idx)
        .map(|p| p.frame.height().to_pt() as f32)
        .unwrap_or(f32::MAX);

    let mut best_idx = 0;
    let mut best_dist = f32::MAX;

    for (i, (call_start, _)) in calls.iter().enumerate() {
        if let Some((call_page_1based, _, call_y, _)) = compiler::resolve_position(source, document, *call_start) {
            let call_page = (call_page_1based as usize).saturating_sub(1); // convert to 0-based
            if call_page == page_idx {
                let dist = (call_y - click_y).abs();
                if dist < best_dist {
                    best_dist = dist;
                    best_idx = i;
                }
            } else if call_page < page_idx {
                // Call is on a previous page — use source order heuristic
                let approx_y = (call_page as f32) * page_height + call_y;
                let approx_click = (page_idx as f32) * page_height + click_y;
                let dist = (approx_y - approx_click).abs();
                if dist < best_dist {
                    best_dist = dist;
                    best_idx = i;
                }
            }
        } else {
            if best_dist == f32::MAX {
                best_idx = i;
            }
        }
    }

    Some(calls[best_idx].1)
}


#[command]
pub async fn resolve_position(
    offset: usize, 
    source: String, 
    project_path: Option<String>,
    state: State<'_, CompilerState>
) -> Result<Option<SourcePosition>, String> {
    let world;
    let document;
    let root = project_path.map(std::path::PathBuf::from);
    
    if let Some(doc) = state.get_document(&source) {
        document = doc;
        world = compiler::MemoryWorld::new(source, root);
    } else {
        world = compiler::MemoryWorld::new(source, root);
        let warned = typst::compile::<PagedDocument>(&world);
        document = Arc::new(warned.output.map_err(|_| "Compilation failed".to_string())?);
    }
    
    let source_obj = World::source(&world, world.main()).map_err(|e| e.to_string())?;
    
    // Convert UTF-16 code unit offset to byte offset
    let mut byte_offset = 0;
    let mut char_iter = source_obj.text().chars();
    let mut current_utf16_offset = 0;
    
    while current_utf16_offset < offset {
        if let Some(c) = char_iter.next() {
            current_utf16_offset += c.len_utf16();
            byte_offset += c.len_utf8();
        } else {
            break;
        }
    }

    if let Some((page, gx, gy, gh)) = compiler::resolve_position(&source_obj, &document, byte_offset) {
        Ok(Some(SourcePosition {
            offset,
            byte_offset,
            x: gx,
            y: gy,
            height: gh,
            page: page as usize,
        }))
    } else {
        Ok(None)
    }
}

#[derive(serde::Serialize)]
pub struct SearchResult {
    pub project_name: String,
    pub file_name: String,
    pub file_path: String,
    pub line: usize,
    pub content: String,
}

#[command]
pub async fn search_projects(query: String, app_handle: tauri::AppHandle) -> Result<Vec<SearchResult>, String> {
    use tauri::Manager;
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let projects_dir = app_dir.join("projects");
    
    println!("[Search] Searching for: '{}' in {:?}", query, projects_dir);
    
    if !projects_dir.exists() {
        println!("[Search] Projects directory does not exist");
        return Ok(Vec::new());
    }
    
    let mut results = Vec::new();
    let query_lower = query.to_lowercase();
    
    if let Ok(project_entries) = std::fs::read_dir(projects_dir) {
        for project_entry in project_entries.flatten() {
            let project_path = project_entry.path();
            if !project_path.is_dir() { continue; }
            
            let project_name = project_path.file_name().unwrap_or_default().to_string_lossy().to_string();
            println!("[Search] Searching in project: {}", project_name);
            
            fn walk_search(dir: &std::path::Path, query: &str, project_name: &str, results: &mut Vec<SearchResult>) {
                if let Ok(entries) = std::fs::read_dir(dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_dir() {
                            walk_search(&path, query, project_name, results);
                        } else if path.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()) == Some("typ".to_string()) {
                            println!("[Search] Checking file: {:?}", path);
                            match std::fs::read_to_string(&path) {
                                Ok(content) => {
                                    for (i, line) in content.lines().enumerate() {
                                        if line.to_lowercase().contains(query) {
                                            println!("[Search] Found match in {:?} line {}", path, i + 1);
                                            results.push(SearchResult {
                                                project_name: project_name.to_string(),
                                                file_name: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                                                file_path: path.to_string_lossy().to_string().replace("\\", "/"),
                                                line: i + 1,
                                                content: line.trim().to_string(),
                                            });
                                            if results.len() > 2000 { return; }
                                        }
                                    }
                                }
                                Err(e) => {
                                    println!("[Search] Failed to read file {:?}: {}", path, e);
                                }
                            }
                        }
                    }
                }
            }
            
            walk_search(&project_path, &query_lower, &project_name, &mut results);
            if results.len() > 1000 { break; }
        }
    }
    
    println!("[Search] Found {} total results", results.len());
    Ok(results)
}

#[command]
pub async fn create_file(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if p.exists() {
        return Err("File already exists".to_string());
    }
    std::fs::write(p, "").map_err(|e| e.to_string())
}

#[command]
pub async fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    let old = std::path::Path::new(&old_path);
    let new = std::path::Path::new(&new_path);
    
    if !old.exists() {
        return Err("Source file does not exist".to_string());
    }
    
    if new.exists() {
        return Err("Destination already exists".to_string());
    }
    
    std::fs::rename(old, new).map_err(|e| e.to_string())
}

#[command]
pub async fn delete_file(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Ok(());
    }
    
    if p.is_dir() {
        std::fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        std::fs::remove_file(p).map_err(|e| e.to_string())
    }
}

#[command]
pub async fn create_dir(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if p.exists() {
        return Err("Directory already exists".to_string());
    }
    std::fs::create_dir_all(p).map_err(|e| e.to_string())
}

#[command]
pub async fn apply_text_edit(
    source: String,
    start: usize,
    end: usize,
    new_text: String,
) -> Result<String, String> {
    Ok(compiler::apply_text_edit(&source, start, end, &new_text))
}

#[command]
pub async fn get_projects_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let projects_dir = app_dir.join("projects");
    std::fs::create_dir_all(&projects_dir).map_err(|e| e.to_string())?;
    Ok(projects_dir.to_string_lossy().to_string().replace("\\", "/"))
}

#[command]
pub async fn show_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(path.replace("/", "\\"))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
pub async fn call_gemini(
    current_code: String,
    notes: String,
    template_context: Option<String>,
    ai_state: State<'_, AiState>,
) -> Result<String, String> {
    // Priority 1: Check in-memory state (unlocked via password)
    // Priority 2: Fallback to .env for development
    let api_key = ai_state.get_key().or_else(|| {
        dotenvy::dotenv().ok();
        std::env::var("gemini_key").ok()
    }).ok_or_else(|| "Assistant non déverrouillé ou clé Gemini manquante".to_string())?;

    let model = "gemini-3.1-flash-lite-preview";
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model, api_key
    );

    let client = reqwest::Client::new();
    
    let prompt = format!(
        "Tu es un expert en Typst. Voici le code actuel du document :\n\n```typst\n{}\n```\n\nVoici les notes de l'utilisateur pour modifier ou ajouter du contenu :\n\n{}\n\n{}\n\nIMPORTANT : Retourne UNIQUEMENT le code Typst complet et structuré. Ne mets pas de blocs de code markdown (pas de ```typst). Ne donne aucune explication. Juste le code.",
        current_code, 
        notes,
        template_context.map(|ctx| format!("Utilise ce contexte de template si nécessaire :\n{}", ctx)).unwrap_or_default()
    );

    let request_body = serde_json::json!({
        "contents": [{
            "parts": [{
                "text": prompt
            }]
        }],
        "generationConfig": {
            "temperature": 0.2,
            "topK": 40,
            "topP": 0.95,
            "maxOutputTokens": 8192,
        }
    });

    let response = client
        .post(&url)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Erreur lors de l'envoi à Gemini : {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let err_text = response.text().await.unwrap_or_default();
        return Err(format!("Gemini API error ({}): {}", status, err_text));
    }

    let res_json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Erreur lors du parsing de la réponse : {}", e))?;

    let ai_text = res_json["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .ok_or_else(|| "Réponse invalide de Gemini".to_string())?;

    // Basic cleaning in case the AI ignored the "no markdown" instruction
    let mut cleaned = ai_text.trim().to_string();
    if cleaned.starts_with("```typst") {
        cleaned = cleaned.replace("```typst", "");
    }
    if cleaned.starts_with("```") {
        cleaned = cleaned.replace("```", "");
    }
    if cleaned.ends_with("```") {
        cleaned = cleaned[..cleaned.len() - 3].trim().to_string();
    }

    Ok(cleaned)
}

#[tauri::command]
pub async fn unlock_ai(password: String, ai_state: State<'_, AiState>) -> Result<bool, String> {
    // 1. Try to unlock using hardcoded encrypted key (for Production build)
    if let Some(decrypted_key) = models::get_decrypted_ai_key(&password) {
        ai_state.set_key(decrypted_key);
        return Ok(true);
    }

    // 2. Fallback to .env comparison (for Development)
    dotenvy::dotenv().ok();
    if let Ok(correct_mdp) = std::env::var("unlock_mdp") {
        if password == correct_mdp {
            // Also try to set the key from .env if we have it
            if let Ok(key) = std::env::var("gemini_key") {
                ai_state.set_key(key);
            }
            return Ok(true);
        }
    }
    
    Err("Mot de passe incorrect".to_string())
}
