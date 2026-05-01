use chrono::Datelike;
use serde::Serialize;
use typst::diag::{FileError, FileResult, SourceResult};
use typst::foundations::{Bytes, Datetime};
use typst::layout::{Frame, PagedDocument};
use typst::syntax::{FileId, Source};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::Library;
use typst::World;
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;

static LIBRARY: Lazy<LazyHash<Library>> = Lazy::new(|| LazyHash::new(Library::default()));

struct FontSlot {
    font: Mutex<Option<Font>>,
}
static FONT_SLOTS: Lazy<Vec<FontSlot>> = Lazy::new(|| {
    let mut slots = Vec::new();
    
    // Load embedded fonts for instant availability.
    for data in typst_assets::fonts() {
        for font in Font::iter(Bytes::new(data)) {
            slots.push(FontSlot {
                font: Mutex::new(Some(font)),
            });
        }
    }

    // Fallback: If no embedded fonts (rare bug), load system fonts to prevent invisible text
    if slots.is_empty() {
        println!("Typst: No embedded fonts found, scanning system fonts...");
        let mut db = fontdb::Database::new();
        db.load_system_fonts();
        for face in db.faces() {
            if let fontdb::Source::File(path) = &face.source {
                if let Ok(data) = std::fs::read(path) {
                    for font in Font::iter(Bytes::new(data)) {
                        slots.push(FontSlot {
                            font: Mutex::new(Some(font)),
                        });
                    }
                }
            }
            if slots.len() > 100 { break; } // Limit to first 100 to avoid slow startup
        }
    }

    println!("Typst: Total fonts available: {} slots", slots.len());
    slots
});

impl MemoryWorld {
    pub fn new(source_text: String, root: Option<std::path::PathBuf>) -> Self {
        let main = FileId::new(None, typst::syntax::VirtualPath::new("main.typ"));
        let source = Source::new(main, source_text);
        
        let mut infos = Vec::new();
        for slot in &*FONT_SLOTS {
            if let Some(font) = &*slot.font.lock().unwrap() {
                infos.push(font.info().clone());
            }
        }
        let mut local_fonts = Vec::new();

        // Recursively scan the project root for local font files (TTF/OTF).
        if let Some(provided_root) = &root {
            let root_dir = if provided_root.is_file() {
                provided_root.parent().unwrap_or(provided_root).to_path_buf()
            } else {
                provided_root.clone()
            };

            fn scan_fonts(dir: &std::path::Path, infos: &mut Vec<typst::text::FontInfo>, local_fonts: &mut Vec<Font>) {
                if let Ok(entries) = std::fs::read_dir(dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_dir() {
                            scan_fonts(&path, infos, local_fonts);
                        } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                            let ext_lower = ext.to_lowercase();
                            if ext_lower == "ttf" || ext_lower == "otf" {
                                if let Ok(data) = std::fs::read(&path) {
                                    for font in Font::iter(Bytes::new(data)) {
                                        infos.push(font.info().clone());
                                        local_fonts.push(font);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            scan_fonts(&root_dir, &mut infos, &mut local_fonts);
        }

        Self {
            library: (*LIBRARY).clone(),
            book: LazyHash::new(FontBook::from_infos(infos)),
            local_fonts,
            main,
            source,
            root,
        }
    }
}

pub struct MemoryWorld {
    library: LazyHash<Library>,
    book: LazyHash<FontBook>,
    local_fonts: Vec<Font>,
    main: FileId,
    source: Source,
    root: Option<std::path::PathBuf>,
}

impl World for MemoryWorld {
    fn library(&self) -> &LazyHash<Library> { &self.library }
    fn book(&self) -> &LazyHash<FontBook> { &self.book }
    fn main(&self) -> FileId { self.main }

    fn source(&self, id: FileId) -> FileResult<Source> {
        if id == self.main {
            Ok(self.source.clone())
        } else if let Some(root) = &self.root {
            let path = root.join(id.vpath().as_rootless_path());
            let text = std::fs::read_to_string(&path).map_err(|_| FileError::NotFound(path))?;
            Ok(Source::new(id, text))
        } else {
            Err(FileError::NotFound(id.vpath().as_rootless_path().to_path_buf()))
        }
    }

    fn file(&self, id: FileId) -> FileResult<Bytes> {
        if let Some(root) = &self.root {
            let path = root.join(id.vpath().as_rootless_path());
            let data = std::fs::read(&path).map_err(|_| FileError::NotFound(path))?;
            Ok(Bytes::new(data))
        } else {
            Err(FileError::NotFound(id.vpath().as_rootless_path().to_path_buf()))
        }
    }

    fn font(&self, index: usize) -> Option<Font> {
        let global_count = FONT_SLOTS.len();
        if index < global_count {
            FONT_SLOTS.get(index).and_then(|slot| slot.font.lock().unwrap().clone())
        } else {
            self.local_fonts.get(index - global_count).cloned()
        }
    }

    fn today(&self, offset: Option<i64>) -> Option<Datetime> {
        let now = chrono::Local::now();
        let date = if let Some(offset) = offset {
            now.naive_utc() + chrono::Duration::hours(offset)
        } else {
            now.naive_local()
        };
        Datetime::from_ymd(date.year(), date.month() as u8, date.day() as u8)
    }
}

pub struct CompilerState {
    pub last_source: Mutex<String>,
    pub last_doc: Mutex<Option<Arc<PagedDocument>>>,
}

impl CompilerState {
    pub fn new() -> Self {
        Self {
            last_source: Mutex::new(String::new()),
            last_doc: Mutex::new(None),
        }
    }

    pub fn get_document(&self, source: &str) -> Option<Arc<PagedDocument>> {
        let last_source = self.last_source.lock().unwrap();
        if *last_source == source {
            return self.last_doc.lock().unwrap().clone();
        }
        None
    }

    pub fn set_document(&self, source: String, doc: Arc<PagedDocument>) {
        let mut last_source = self.last_source.lock().unwrap();
        let mut last_doc = self.last_doc.lock().unwrap();
        
        *last_source = source;
        *last_doc = Some(doc);
    }
}

#[derive(Serialize)]
pub struct TypstError {
    pub message: String,
    pub line: Option<usize>,
    pub column: Option<usize>,
    pub severity: String,
}

#[derive(Serialize, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct TextRange {
    pub start: usize,
    pub end: usize,
    pub text: String,
}

#[derive(Serialize)]
pub struct PageMetadata {
    pub width: f32,
    pub height: f32,
}

#[derive(Serialize)]
pub struct CompileResult {
    pub page_count: usize,
    pub pages: Vec<PageMetadata>,
    pub errors: Vec<TypstError>,
    pub text_ranges: Vec<TextRange>,
    pub active_page_data: Option<RenderResult>,
    pub active_page_index: Option<usize>,
}

#[derive(Serialize)]
pub struct RenderResult {
    pub svg: String,
    pub image: String,
}

pub fn compile_to_svg(source_text: String, root: Option<String>, state: &CompilerState, active_page: Option<usize>) -> CompileResult {
    let root_path = root.map(std::path::PathBuf::from);
    let world = MemoryWorld::new(source_text.clone(), root_path);
    let warned = typst::compile::<PagedDocument>(&world);
    let output: SourceResult<PagedDocument> = warned.output;

    match output {
        Ok(document) => {
            let doc_arc = Arc::new(document);
            let page_count = doc_arc.pages.len();
            
            let pages = doc_arc.pages.iter().map(|page| {
                PageMetadata {
                    width: page.frame.width().to_pt() as f32,
                    height: page.frame.height().to_pt() as f32,
                }
            }).collect();

            state.set_document(source_text, doc_arc.clone());

            let source = world.source(world.main()).unwrap();
            let mut text_ranges = Vec::new();

            // Identify safe editable ranges using the syntax tree
            find_safe_editable_ranges(&source, &mut text_ranges);

            // Merge and sort ranges
            text_ranges.sort_by_key(|r| r.start);
            let mut merged_ranges: Vec<TextRange> = Vec::new();
            if let Some(first) = text_ranges.first().cloned() {
                let mut current = first;
                for next in text_ranges.iter().skip(1) {
                    if next.start <= current.end {
                        current.end = current.end.max(next.end);
                    } else {
                        merged_ranges.push(current);
                        current = next.clone();
                    }
                }
                merged_ranges.push(current);
            }
            
            // Re-extract text for merged ranges to ensure consistency
            for r in &mut merged_ranges {
                if let Some(txt) = source.text().get(r.start..r.end) {
                    r.text = txt.to_string();
                }
            }

            let mut errors = Vec::new();
            let source = world.source(world.main()).unwrap();
            for warn in warned.warnings {
                let (line, column) = source.range(warn.span)
                    .map(|range| (
                        source.byte_to_line(range.start).map(|l| l + 1), 
                        source.byte_to_column(range.start).map(|c| c + 1)
                    ))
                    .unwrap_or((None, None));

                errors.push(TypstError {
                    message: warn.message.to_string(),
                    line,
                    column,
                    severity: "warning".to_string(),
                });
            }

            let active_page_data = active_page.and_then(|idx| {
                if idx < page_count {
                    let page = doc_arc.pages.get(idx)?;
                    render_page_internal(page)
                } else {
                    None
                }
            });

            CompileResult { 
                page_count,
                pages, 
                errors, 
                text_ranges: merged_ranges,
                active_page_data,
                active_page_index: active_page,
            }
        }
        Err(errs) => {
            let mut errors = Vec::new();
            let source = world.source(world.main()).unwrap();
            for err in errs.iter() {
                let (line, column) = source.range(err.span)
                    .map(|range| (
                        source.byte_to_line(range.start).map(|l| l + 1), 
                        source.byte_to_column(range.start).map(|c| c + 1)
                    ))
                    .unwrap_or((None, None));

                errors.push(TypstError {
                    message: err.message.to_string(),
                    line,
                    column,
                    severity: "error".to_string(),
                });
            }
            CompileResult {
                page_count: 0,
                pages: Vec::new(),
                errors,
                text_ranges: Vec::new(),
                active_page_data: None,
                active_page_index: None,
            }
        }
    }
}

fn render_page_internal(page: &typst::layout::Page) -> Option<RenderResult> {
    // Generate SVG (Near-instant)
    let svg = typst_svg::svg(page);
    
    Some(RenderResult {
        svg,
        image: "".to_string(), // Removed JPEG for speed, use SVG in frontend
    })
}

pub fn render_page_data(page_index: usize, state: &CompilerState) -> Option<RenderResult> {
    let doc_opt = state.last_doc.lock().unwrap();
    let doc = doc_opt.as_ref()?;
    let page = doc.pages.get(page_index)?;

    // Generate SVG
    let svg = typst_svg::svg(page);
    
    Some(RenderResult {
        svg,
        image: "".to_string(),
    })
}

fn find_safe_editable_ranges(source: &Source, ranges: &mut Vec<TextRange>) {
    use typst::syntax::{SyntaxKind, LinkedNode};
    let src_text = source.text();
    let root = LinkedNode::new(source.root());
    
    fn is_in_func_def(node: &LinkedNode) -> bool {
        let mut curr = Some(node);
        while let Some(n) = curr {
            if n.kind() == SyntaxKind::LetBinding {
                // Check if it's a function-like let: #let func(args) = ...
                if n.children().any(|c| c.kind() == SyntaxKind::Params) {
                    return true;
                }
            }
            if n.kind() == SyntaxKind::Closure {
                return true;
            }
            curr = n.parent();
        }
        false
    }

    fn traverse(node: &LinkedNode, src_text: &str, ranges: &mut Vec<TextRange>) {
        match node.kind() {
            SyntaxKind::Text | SyntaxKind::Math | SyntaxKind::Raw => {
                if !is_in_func_def(node) {
                    let range = node.range();
                    if !range.is_empty() {
                        let text = src_text.get(range.clone()).unwrap_or("").to_string();
                        ranges.push(TextRange { start: range.start, end: range.end, text });
                    }
                }
            }
            SyntaxKind::Str => {
                if !is_in_func_def(node) {
                    let range = node.range();
                    if range.len() >= 2 {
                        // Exclude surrounding quotes
                        let inner_start = range.start + 1;
                        let inner_end = range.end - 1;
                        let text = src_text.get(inner_start..inner_end).unwrap_or("").to_string();
                        ranges.push(TextRange { start: inner_start, end: inner_end, text });
                    }
                }
            }
            SyntaxKind::Heading | SyntaxKind::ListItem | SyntaxKind::EnumItem | SyntaxKind::TermItem | SyntaxKind::Markup => {
                // Traverse children to find actual text/strings inside these structures
                for child in node.children() {
                    traverse(&child, src_text, ranges);
                }
            }
            _ => {
                // Recursively search for editable content in all other nodes, 
                // but do NOT treat them as editable themselves (protects Idents, Keywords, etc.)
                for child in node.children() {
                    traverse(&child, src_text, ranges);
                }
            }
        }
    }
    
    traverse(&root, src_text, ranges);
}

/// Apply a surgical text edit: replace bytes [start..end] with `new_text`.
/// Returns the updated source string.
pub fn apply_text_edit(source: &str, start: usize, end: usize, new_text: &str) -> String {
    let mut result = source.to_string();
    // Safety: clamp to valid byte boundaries
    let clamped_start = start.min(result.len());
    let clamped_end = end.min(result.len()).max(clamped_start);
    result.replace_range(clamped_start..clamped_end, new_text);
    result
}

pub fn compile_to_pdf(source_text: String, root: Option<String>) -> Result<Vec<u8>, Vec<TypstError>> {
    let root_path = root.map(std::path::PathBuf::from);
    let world = MemoryWorld::new(source_text, root_path);
    let warned = typst::compile::<PagedDocument>(&world);
    let output: SourceResult<PagedDocument> = warned.output;

    match output {
        Ok(document) => {
            let pdf =
                typst_pdf::pdf(&document, &typst_pdf::PdfOptions::default()).map_err(|_e| {
                    vec![TypstError {
                        message: "PDF creation failed".to_string(),
                        line: None,
                        column: None,
                        severity: "error".to_string(),
                    }]
                })?;
            Ok(pdf)
        }
        Err(errs) => {
            let mut errors = Vec::new();
            let source = World::source(&world, world.main()).unwrap();
            for err in errs.iter() {
                if let Some(range) = source.range(err.span) {
                    let line = source.byte_to_line(range.start).map(|l| l + 1);
                    let column = source.byte_to_column(range.start).map(|c| c + 1);

                    errors.push(TypstError {
                        message: err.message.to_string(),
                        line,
                        column,
                        severity: "error".to_string(),
                    });
                }
            }
            Err(errors)
        }
    }
}

pub fn resolve_offset(source: &Source, frame: &Frame, x: f32, y: f32) -> Option<(usize, f32, f32, f32)> {
    let mut nearest_offset = None;
    let mut min_dist = f32::MAX;
    let mut best_coords = (0.0, 0.0, 0.0);

    fn search(source: &Source, frame: &Frame, x: f32, y: f32, nearest: &mut Option<usize>, min_dist: &mut f32, coords: &mut (f32, f32, f32), base_x: f32, base_y: f32) {
        for (pos, item) in frame.items() {
            let item_x = pos.x.to_pt() as f32;
            let item_y = pos.y.to_pt() as f32;
            let x_rel = x - item_x;
            let y_rel = y - item_y;

            match item {
                typst::layout::FrameItem::Group(group) => {
                    search(source, &group.frame, x_rel, y_rel, nearest, min_dist, coords, base_x + item_x, base_y + item_y);
                }
                typst::layout::FrameItem::Text(text) => {
                    let metrics = text.font.metrics();
                    let scale = text.size.to_pt() as f32;
                    let asc = metrics.ascender.get() as f32 * scale;
                    let desc = metrics.descender.get() as f32 * scale;
                    let height = asc + desc.abs();
                    
                    // Calculate distance to this text block's bounding box
                    let width = text.width().to_pt() as f32;
                    let dx = (0.0f32).max(x_rel - width).max(-x_rel);
                    let dy = (0.0f32).max(y_rel - (-desc)).max(-(y_rel - (-asc)));
                    let dist = (dx.powi(2) + dy.powi(2)).sqrt();
                    
                    if dist < *min_dist {
                        // Find the best glyph within this text block
                        let mut best_glyph_offset = None;
                        let mut glyph_x = 0.0;
                        let mut current_x = 0.0;
                        
                        for glyph in &text.glyphs {
                            let glyph_width = glyph.x_advance.get() as f32 * scale;
                            if x_rel <= current_x + glyph_width {
                                let span = glyph.span.0;
                                if !span.is_detached() {
                                    if let Some(range) = source.range(span) {
                                        best_glyph_offset = Some(range.start + glyph.range.start as usize);
                                        glyph_x = current_x;
                                        break;
                                    }
                                }
                            }
                            current_x += glyph_width;
                        }
                        
                        if best_glyph_offset.is_none() && !text.glyphs.is_empty() {
                           if let Some(last) = text.glyphs.last() {
                               let span = last.span.0;
                               if !span.is_detached() {
                                   if let Some(range) = source.range(span) {
                                       best_glyph_offset = Some(range.start + last.range.end as usize);
                                       glyph_x = current_x;
                                   }
                               }
                           }
                        }

                        if let Some(offset) = best_glyph_offset {
                            *min_dist = dist;
                            *nearest = Some(offset as usize);
                            // Store coordinates in absolute page-space points.
                            *coords = (base_x + item_x + glyph_x, base_y + item_y - asc, height);
                        }
                    }
                }
                _ => {}
            }
        }
    }

    search(source, frame, x, y, &mut nearest_offset, &mut min_dist, &mut best_coords, 0.0, 0.0);
    
    if min_dist < 100.0 {
        let (x, y, h) = best_coords;
        Some((nearest_offset?, x, y, h))
    } else {
        None
    }
}

pub fn resolve_position(source: &Source, document: &PagedDocument, target_offset: usize) -> Option<(u32, f32, f32, f32)> {
    let mut best_match = None;
    let mut min_diff = usize::MAX;

    for (i, page) in document.pages.iter().enumerate() {
        if let Some((x, y, h, diff)) = find_best_position(&page.frame, source, target_offset, 0.0, 0.0) {
            if diff < min_diff {
                min_diff = diff;
                best_match = Some((i as u32 + 1, x, y, h));
            }
        }
    }
    best_match
}

fn find_best_position(frame: &Frame, source: &Source, target: usize, base_x: f32, base_y: f32) -> Option<(f32, f32, f32, usize)> {
    let mut best = None;
    let mut min_diff = usize::MAX;

    for (pos, item) in frame.items() {
        let item_x = pos.x.to_pt() as f32;
        let item_y = pos.y.to_pt() as f32;
        
        match item {
            typst::layout::FrameItem::Group(group) => {
                if let Some((x, y, h, diff)) = find_best_position(&group.frame, source, target, base_x + item_x, base_y + item_y) {
                    if diff < min_diff {
                        min_diff = diff;
                        best = Some((x, y, h, diff));
                    }
                }
            }
            typst::layout::FrameItem::Text(text) => {
                let mut current_x = 0.0;
                let metrics = text.font.metrics();
                let scale = text.size.to_pt() as f32;
                let asc = metrics.ascender.get() as f32 * scale;
                let desc = metrics.descender.get() as f32 * scale;
                let height = asc + desc.abs();

                for glyph in &text.glyphs {
                    let span = glyph.span.0;
                    let glyph_width = glyph.x_advance.get() as f32 * scale;
                    
                    if !span.is_detached() {
                        if let Some(range) = source.range(span) {
                            let g_start = range.start + glyph.range.start as usize;
                            let g_end = range.start + glyph.range.end as usize;
                            
                            // Determine the distance to the target offset.
                            // A zero difference indicates an exact match within the glyph's range.
                            let diff = if target >= g_start && target <= g_end {
                                0
                            } else {
                                target.abs_diff(g_start).min(target.abs_diff(g_end))
                            };

                            if diff < min_diff {
                                min_diff = diff;
                                let x_pos = if target >= g_end { current_x + glyph_width } else { current_x };
                                best = Some((base_x + item_x + x_pos, base_y + item_y - asc, height, diff));
                            }
                        }
                    }
                    current_x += glyph_width;
                }
            }
            _ => {}
        }
    }
    best
}
