import { invoke } from "@tauri-apps/api/core";
import type * as monaco from "monaco-editor";
import { create } from "zustand";

export interface TypstError {
	message: string;
	line: number | null;
	column: number | null;
}

export interface PageMetadata {
	id: string;
	width: number;
	height: number;
}

interface CompileResult {
	page_count: number;
	pages: PageMetadata[];
	errors: TypstError[];
	text_ranges: { start: number; end: number; text: string }[];
	active_page_data?: RenderResult;
	active_page_index?: number;
}

interface RenderResult {
	svg: string;
	image: string;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export interface FileItem {
	name: string;
	path: string;
	is_dir: boolean;
	children?: FileItem[];
}

export interface ProjectInfo {
	name: string;
	path: string;
}

export interface SearchResult {
	project_name: string;
	file_name: string;
	file_path: string;
	line: number;
	content: string;
}

interface EditorStore {
	source: string;
	filePath: string | null;
	projectPath: string | null;
	projectFiles: FileItem[];
	projects: ProjectInfo[];
	isDirty: boolean;
	unsavedChanges: Record<string, string>; // path -> content
	isDirtyFiles: Record<string, boolean>; // path -> true
	pages: PageMetadata[];
	pageCache: Record<number, RenderResult>;
	renderedCompileIds: Record<number, number>;
	errors: TypstError[];
	textRanges: { start: number; end: number; text: string }[];
	isCompiling: boolean;
	mode: "wysiwyg" | "split";
	currentPage: number;
	compileId: number;
	editorView: monaco.editor.IStandaloneCodeEditor | null;
	cursorPosition: {
		page: number;
		x: number;
		y: number;
		height: number;
		offset: number;
		byte_offset: number;
	} | null;
	editorStatus: { ln: number; col: number };
	stats: { lines: number; chars: number };
	showTerminal: boolean;
	showSidebar: boolean;
	showChat: boolean;
	isAiUnlocked: boolean;
	unlockAi: (password: string) => Promise<boolean>;
	searchResults: SearchResult[];
	isSearching: boolean;

	setSource: (source: string) => void;
	setMode: (mode: "wysiwyg" | "split") => void;
	setCursorPosition: (
		pos: {
			page: number;
			x: number;
			y: number;
			height: number;
			offset: number;
			byte_offset: number;
		} | null,
	) => void;
	toggleTerminal: () => void;
	toggleSidebar: () => void;
	toggleChat: () => void;
	compile: () => Promise<void>;
	renderPage: (index: number) => Promise<RenderResult | null>;
	openFile: (path: string) => Promise<void>;
	openFileDialog: () => Promise<void>;
	createNewFile: () => void;
	saveFile: () => Promise<void>;
	saveFileAs: () => Promise<void>;
	exportPdf: () => Promise<void>;
	resolveClick: (
		page: number,
		x: number,
		y: number,
	) => Promise<SourcePosition | null>;
	resolvePosition: (offset: number) => Promise<void>;
	insertText: (before: string, after: string) => void;
	setEditorView: (view: monaco.editor.IStandaloneCodeEditor) => void;
	triggerAction: (actionId: string) => void;
	undo: () => void;
	redo: () => void;
	openCommandPalette: () => void;
	updateStats: (content: string) => void;
	updateEditorStatus: (ln: number, col: number) => void;

	// Project methods
	initProject: (name: string) => Promise<void>;
	loadProject: (name: string | null) => Promise<void>;
	listProjects: () => Promise<void>;
	importAsset: () => Promise<void>;
	refreshProjectFiles: () => Promise<void>;
	deleteProject: (name: string) => Promise<void>;
	renameProject: (oldName: string, newName: string) => Promise<void>;
	searchProjects: (query: string) => Promise<void>;
	jumpToLine: (line: number) => void;
	createFile: (path: string) => Promise<void>;
	createDir: (path: string) => Promise<void>;
	renameFile: (oldPath: string, newPath: string) => Promise<void>;
	deleteFile: (path: string) => Promise<void>;
	setSearchQuery: (query: string) => void;
	searchQuery: string;
	patchSource: (start: number, end: number, newText: string) => Promise<void>;
	checkUnsavedChanges: () => Promise<boolean>;
	saveAll: () => Promise<void>;
	clearSession: () => void;
	unlockedTemplates: any | null;
	setUnlockedTemplates: (templates: any | null) => void;
}

export interface SourcePosition {
	offset: number;
	byte_offset: number;
	x: number;
	y: number;
	height: number;
	page: number;
}

const DEFAULT_SOURCE = `#set page(margin: 2cm)

= My Typst Document

Start writing here.`;

// Load initial source from localStorage if available
const getInitialSource = () => {
	const saved = localStorage.getItem("Synatyp-draft");
	return saved || DEFAULT_SOURCE;
};

export const useEditorStore = create<EditorStore>((set, get) => ({
	source: getInitialSource(),
	filePath: localStorage.getItem("Synatyp-file-path"),
	projectPath: localStorage.getItem("Synatyp-project-path"),
	projectFiles: [],
	projects: [],
	isDirty: false,
	unsavedChanges: {},
	isDirtyFiles: {},
	pages: [],
	pageCache: {},
	renderedCompileIds: {},
	errors: [],
	textRanges: [],
	isCompiling: false,
	compileId: 0,
	mode: "split",
	currentPage: 1,
	editorView: null,
	cursorPosition: null,
	editorStatus: { ln: 1, col: 1 },
	stats: { lines: 1, chars: 0 },
	showTerminal: false,
	showSidebar: true,
	showChat: false,
	isAiUnlocked: localStorage.getItem("Synatyp-ai-unlocked") === "true",
	searchResults: [],
	isSearching: false,
	unlockedTemplates: null,

	setUnlockedTemplates: (unlockedTemplates) => set({ unlockedTemplates }),
	setEditorView: (view) => set({ editorView: view }),

	setSource: (source) => {
		const { filePath, isDirtyFiles } = get();

		// Immediate update for UI responsiveness
		set((state) => {
			const nextState: Partial<EditorStore> = { source, isDirty: true };

			// Update session tracking
			if (filePath) {
				nextState.unsavedChanges = {
					...state.unsavedChanges,
					[filePath]: source,
				};
				// Only update dirty map if not already dirty to minimize re-renders of the sidebar
				if (!isDirtyFiles[filePath]) {
					nextState.isDirtyFiles = { ...state.isDirtyFiles, [filePath]: true };
				}
			}

			return nextState;
		});

		// Debounced auto-save to prevent hitching during typing
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			localStorage.setItem("Synatyp-draft", source);
			if (filePath) {
				localStorage.setItem("Synatyp-file-path", filePath);
			}
		}, 500);
	},

	setMode: (mode) => set({ mode }),

	setCursorPosition: (cursorPosition) => set({ cursorPosition }),

	toggleTerminal: () => set((state) => ({ showTerminal: !state.showTerminal })),
	toggleSidebar: () => set((state) => ({ showSidebar: !state.showSidebar })),
	toggleChat: () => set((state) => ({ showChat: !state.showChat })),
	unlockAi: async (password: string) => {
		try {
			const success = await invoke<boolean>("unlock_ai", { password });
			if (success) {
				set({ isAiUnlocked: true });
				localStorage.setItem("Synatyp-ai-unlocked", "true");
				return true;
			}
			return false;
		} catch (err) {
			console.error("Failed to unlock AI", err);
			return false;
		}
	},

	compile: async () => {
		const { source, isCompiling, currentPage, compileId } = get();
		if (isCompiling) return;

		set({ isCompiling: true });
		try {
			const nextCompileId = compileId + 1;
			// Use current projectPath from store
			const currentProjectPath = get().projectPath;

			const result = await invoke<CompileResult>("compile", {
				source,
				projectPath: currentProjectPath,
				active_page: currentPage - 1,
			});

			// Commit updates to global state: pages, cached data, and diagnostics.
			set((state) => {
				const newCache = { ...state.pageCache };
				const newRenderedIds = { ...state.renderedCompileIds };

				// If the backend provided pre-rendered data for the active page,
				// cache it immediately to speed up the initial display.
				if (result.active_page_data && result.active_page_index !== undefined) {
					newCache[result.active_page_index] = result.active_page_data;
					newRenderedIds[result.active_page_index] = nextCompileId;
				}

				return {
					pages: result.pages.map((p, i) => ({ ...p, id: `page-${i}` })),
					pageCache: newCache,
					renderedCompileIds: newRenderedIds,
					errors: result.errors,
					textRanges: result.text_ranges,
					isCompiling: false,
					compileId: nextCompileId,
					showTerminal: result.errors.length > 0 ? true : state.showTerminal,
				};
			});
		} catch (err) {
			console.error("Compilation failure:", err);
			set({ isCompiling: false });
		}
	},

	renderPage: async (index: number) => {
		const { pageCache, renderedCompileIds, compileId } = get();

		// Only return cached if it matches the current compile version
		if (renderedCompileIds[index] === compileId && pageCache[index]) {
			return pageCache[index];
		}

		try {
			const result = await invoke<RenderResult>("render_page", {
				pageIndex: index,
			});
			set((state) => ({
				pageCache: { ...state.pageCache, [index]: result },
				renderedCompileIds: { ...state.renderedCompileIds, [index]: compileId },
			}));
			return result;
		} catch (err) {
			console.error(`Failed to render page ${index}`, err);
			return null;
		}
	},

	openFile: async (path) => {
		const { unsavedChanges, isDirtyFiles } = get();
		try {
			let content: string;
			let dirty = false;

			// Check if we have unsaved changes for this file in session
			if (unsavedChanges[path]) {
				content = unsavedChanges[path];
				dirty = isDirtyFiles[path] || false;
			} else {
				content = await invoke<string>("open_file", { path });
				dirty = false;
			}

			set({
				source: content,
				filePath: path,
				isDirty: dirty,
			});

			// Update draft when opening a real file
			localStorage.setItem("Synatyp-draft", content);
			localStorage.setItem("Synatyp-file-path", path);

			// If we don't have a project path, try to infer it from the file path
			if (!get().projectPath && path.includes("projects")) {
				const projectsIdx = path.indexOf("projects");
				const pathAfterProjects = path.substring(projectsIdx + 9);
				const projectName = pathAfterProjects.split(/[/\\]/)[0];
				const projectPath = path.substring(
					0,
					projectsIdx + 9 + projectName.length,
				);
				set({ projectPath });
				localStorage.setItem("Synatyp-project-path", projectPath);
				get().refreshProjectFiles();
			}

			get().compile();
		} catch (err) {
			console.error("Failed to open file", err);
		}
	},

	createNewFile: () =>
		set({
			source: `#set page(margin: 2cm)\n\n= Nouveau Document\n\nCommencez à écrire ici.`,
			filePath: null,
			isDirty: false,
		}),

	saveFile: async () => {
		const { filePath, source } = get();
		if (!filePath) {
			await get().saveFileAs();
			return;
		}
		try {
			await invoke("save_file", { path: filePath, content: source });
			set((state) => {
				const newUnsaved = { ...state.unsavedChanges };
				const newDirtyFiles = { ...state.isDirtyFiles };
				delete newUnsaved[filePath];
				delete newDirtyFiles[filePath];

				return {
					isDirty: false,
					unsavedChanges: newUnsaved,
					isDirtyFiles: newDirtyFiles,
				};
			});
		} catch (err) {
			console.error("Failed to save file", err);
		}
	},

	saveFileAs: async () => {
		const { source } = get();
		try {
			const { save } = await import("@tauri-apps/plugin-dialog");
			const path = await save({
				filters: [{ name: "Fichiers Typst", extensions: ["typ"] }],
				defaultPath: "document.typ",
			});

			if (path) {
				await invoke("save_file", { path, content: source });
				set((state) => {
					const newUnsaved = { ...state.unsavedChanges };
					const newDirtyFiles = { ...state.isDirtyFiles };
					delete newUnsaved[path];
					delete newDirtyFiles[path];

					return {
						filePath: path,
						isDirty: false,
						unsavedChanges: newUnsaved,
						isDirtyFiles: newDirtyFiles,
					};
				});
			}
		} catch (err) {
			console.error("Failed to save file as", err);
		}
	},

	openFileDialog: async () => {
		try {
			const { open } = await import("@tauri-apps/plugin-dialog");
			const path = await open({
				filters: [{ name: "Fichiers Typst", extensions: ["typ"] }],
				multiple: false,
			});

			if (path && typeof path === "string") {
				await get().openFile(path);
			}
		} catch (err) {
			console.error("Failed to open file dialog", err);
		}
	},

	exportPdf: async () => {
		const { source, projectPath } = get();
		try {
			const { save, message } = await import("@tauri-apps/plugin-dialog");
			const path = await save({
				filters: [{ name: "Fichier PDF", extensions: ["pdf"] }],
				defaultPath: "document.pdf",
			});

			if (path) {
				await invoke("export_pdf", { source, projectPath, path });
				await message("Document exporté avec succès !", {
					title: "Exportation PDF",
					kind: "info",
				});
			}
		} catch (err) {
			console.error("Failed to export PDF", err);
			const { message } = await import("@tauri-apps/plugin-dialog");
			await message(`Erreur d'exportation : ${err}`, {
				title: "Erreur",
				kind: "error",
			});
		}
	},

	resolveClick: async (page, x, y) => {
		const { source, projectPath } = get();
		try {
			const result = await invoke<SourcePosition | null>("resolve_click", {
				page,
				x,
				y,
				source,
				projectPath,
			});
			if (result) {
				set({
					cursorPosition: {
						page,
						x: result.x,
						y: result.y,
						height: result.height,
						offset: result.offset,
						byte_offset: result.byte_offset,
					},
				});
				return result;
			}
			return null;
		} catch (err) {
			console.error("Store: Failed to resolve click", err);
			return null;
		}
	},

	resolvePosition: async (offset) => {
		const { source, projectPath } = get();
		try {
			const result = await invoke<SourcePosition | null>("resolve_position", {
				offset,
				source,
				projectPath,
			});
			if (result) {
				set({
					cursorPosition: {
						page: result.page,
						x: result.x,
						y: result.y,
						height: result.height,
						offset: result.offset,
						byte_offset: result.byte_offset,
					},
				});
			}
		} catch (err) {
			console.error("Store: Failed to resolve position", err);
		}
	},

	// Project Methods
	initProject: async (name: string) => {
		if (!(await get().checkUnsavedChanges())) return;

		try {
			const projectPath = await invoke<string>("init_project", { name });
			set({
				projectPath,
				projectFiles: [],
				filePath: `${projectPath}/main.typ`,
				unsavedChanges: {},
				isDirtyFiles: {},
			});
			localStorage.setItem("Synatyp-project-path", projectPath);
			localStorage.setItem("Synatyp-file-path", `${projectPath}/main.typ`);
			await get().openFile(`${projectPath}/main.typ`);
			await get().listProjects();
		} catch (err) {
			console.error("Failed to init project", err);
		}
	},

	loadProject: async (name: string | null) => {
		if (!(await get().checkUnsavedChanges())) return;

		if (!name) {
			set({
				projectPath: null,
				projectFiles: [],
				filePath: null,
				source: "",
				unsavedChanges: {},
				isDirtyFiles: {},
			});
			localStorage.removeItem("Synatyp-project-path");
			localStorage.removeItem("Synatyp-file-path");
			return;
		}
		try {
			const projectPath = await invoke<string>("init_project", { name });
			set({
				projectPath,
				projectFiles: [],
				filePath: `${projectPath}/main.typ`,
				unsavedChanges: {},
				isDirtyFiles: {},
			});
			localStorage.setItem("Synatyp-project-path", projectPath);
			localStorage.setItem("Synatyp-file-path", `${projectPath}/main.typ`);
			await get().openFile(`${projectPath}/main.typ`);
			await get().refreshProjectFiles();
		} catch (err) {
			console.error("Failed to load project", err);
		}
	},

	checkUnsavedChanges: async () => {
		const { isDirtyFiles, isDirty } = get();
		const dirtyPaths = Object.keys(isDirtyFiles).filter((p) => isDirtyFiles[p]);

		if (dirtyPaths.length === 0 && !isDirty) return true;

		try {
			const { ask } = await import("@tauri-apps/plugin-dialog");
			const confirmed = await ask(
				`Vous avez ${dirtyPaths.length} fichier(s) non sauvegardé(s). Voulez-vous sauvegarder les modifications avant de continuer ?`,
				{
					title: "Fichiers non sauvegardés",
					kind: "warning",
					okLabel: "Sauvegarder tout",
					cancelLabel: "Ignorer les changements",
				},
			);

			if (confirmed) {
				await get().saveAll();
				return true;
			} else {
				// User clicked the secondary action (Cancel label in our 'ask' call, but we styled it as Ignore)
				// Wait, 'ask' returns boolean: true for OK, false for Cancel.
				// If false, it means they clicked 'Ignorer les changements'
				set({ unsavedChanges: {}, isDirtyFiles: {} });
				return true;
			}
		} catch (err) {
			console.error("Error checking unsaved changes", err);
			return false;
		}
	},

	saveAll: async () => {
		const { unsavedChanges, isDirtyFiles } = get();
		const paths = Object.keys(isDirtyFiles);

		if (paths.length === 0) return;

		try {
			for (const path of paths) {
				const content = unsavedChanges[path];
				if (content !== undefined) {
					await invoke("save_file", { path, content });
				}
			}

			set({
				isDirty: false,
				unsavedChanges: {},
				isDirtyFiles: {},
			});
		} catch (err) {
			console.error("Failed to save all files", err);
		}
	},

	clearSession: () => set({ unsavedChanges: {}, isDirtyFiles: {} }),

	listProjects: async () => {
		try {
			const projects = await invoke<ProjectInfo[]>("list_projects");
			set({ projects });
		} catch (err) {
			console.error("Failed to list projects", err);
		}
	},

	importAsset: async () => {
		const { projectPath } = get();
		if (!projectPath) {
			const { message } = await import("@tauri-apps/plugin-dialog");
			await message(
				"Veuillez enregistrer votre projet ou en créer un avant d'importer des images.",
				{ title: "Aucun Projet", kind: "warning" },
			);
			return;
		}

		try {
			const { open } = await import("@tauri-apps/plugin-dialog");
			const path = await open({
				filters: [
					{ name: "Images", extensions: ["png", "jpg", "jpeg", "svg"] },
				],
				multiple: false,
			});

			if (path && typeof path === "string") {
				await invoke("import_asset", { projectPath, assetPath: path });
				await get().refreshProjectFiles();
			}
		} catch (err) {
			console.error("Failed to import asset", err);
		}
	},

	refreshProjectFiles: async () => {
		const { projectPath } = get();
		if (!projectPath) return;
		try {
			console.log("[Store] Refreshing files for:", projectPath);
			const files = await invoke<FileItem[]>("list_project_files", {
				projectPath,
			});
			console.log("[Store] Received files:", files);

			// Basic validation to prevent crashes if backend returns unexpected data
			if (!Array.isArray(files)) {
				console.error(
					"[Store] Expected array from list_project_files, got:",
					files,
				);
				return;
			}

			set({ projectFiles: files });
		} catch (err) {
			console.error("Failed to list project files", err);
		}
	},

	deleteProject: async (name: string) => {
		try {
			await invoke("delete_project", { name });
			const { projectPath } = get();
			if (projectPath?.endsWith(name)) {
				set({
					projectPath: null,
					projectFiles: [],
					filePath: null,
					source: DEFAULT_SOURCE,
				});
			}
			await get().listProjects();
		} catch (err) {
			console.error("Failed to delete project", err);
		}
	},

	renameProject: async (oldName, newName) => {
		try {
			await invoke("rename_project", { oldName, newName });
			const { projectPath } = get();
			// If the renamed project was active, update its path
			if (projectPath?.endsWith(oldName)) {
				const newPath = projectPath.replace(oldName, newName);
				set({ projectPath: newPath });
			}
			await get().listProjects();
		} catch (err) {
			console.error("Failed to rename project", err);
			const { message } = await import("@tauri-apps/plugin-dialog");
			await message(`Error: ${err}`, {
				title: "Rename Project",
				kind: "error",
			});
		}
	},

	searchProjects: async (query) => {
		if (!query.trim()) {
			set({ searchResults: [], isSearching: false });
			return;
		}
		set({ isSearching: true });
		try {
			const results = await invoke<SearchResult[]>("search_projects", {
				query,
			});
			set({ searchResults: results, isSearching: false });
		} catch (err) {
			console.error("Failed to search projects", err);
			set({ isSearching: false });
		}
	},

	jumpToLine: (line) => {
		const { editorView } = get();
		if (editorView) {
			editorView.revealLineInCenter(line);
			editorView.setPosition({ lineNumber: line, column: 1 });
			editorView.focus();
		}
	},

	createFile: async (path) => {
		try {
			await invoke("create_file", { path });
			await get().refreshProjectFiles();
		} catch (err) {
			console.error("Failed to create file", err);
		}
	},

	createDir: async (path) => {
		try {
			await invoke("create_dir", { path });
			await get().refreshProjectFiles();
		} catch (err) {
			console.error("Failed to create directory", err);
		}
	},

	renameFile: async (oldPath, newPath) => {
		try {
			await invoke("rename_file", { oldPath, newPath });
			const { filePath } = get();
			if (filePath === oldPath) {
				set({ filePath: newPath });
			}
			await get().refreshProjectFiles();
		} catch (err) {
			console.error("Failed to rename file", err);
		}
	},

	deleteFile: async (path) => {
		try {
			await invoke("delete_file", { path });
			const { filePath } = get();
			if (filePath === path) {
				set({ filePath: null, source: "" });
			}
			await get().refreshProjectFiles();
		} catch (err) {
			console.error("Failed to delete file", err);
		}
	},

	setSearchQuery: (searchQuery) => set({ searchQuery }),
	searchQuery: "",

	patchSource: async (start, end, newText) => {
		const { source } = get();
		try {
			const updated = await invoke<string>("apply_text_edit", {
				source,
				start,
				end,
				newText,
			});
			set({ source: updated, isDirty: true });
			localStorage.setItem("Synatyp-draft", updated);
			// Sync Monaco without moving its cursor awkwardly
			const { editorView } = get();
			if (editorView) {
				const model = editorView.getModel();
				if (model && model.getValue() !== updated) {
					// Preserve cursor position across the programmatic update
					const pos = editorView.getPosition();
					model.setValue(updated);
					if (pos) editorView.setPosition(pos);
				}
			}
		} catch (err) {
			console.error("Failed to patch source", err);
		}
	},

	insertText: (before, after) => {
		const { editorView } = get();
		if (!editorView) return;

		const selection = editorView.getSelection();
		const model = editorView.getModel();
		if (!selection || !model) return;

		const text = model.getValueInRange(selection);
		editorView.executeEdits("insertText", [
			{
				range: selection,
				text: `${before}${text}${after}`,
				forceMoveMarkers: true,
			},
		]);

		editorView.focus();
	},

	openCommandPalette: () => {
		const { editorView } = get();
		if (editorView) {
			editorView.focus();
			editorView.trigger("keyboard", "editor.action.quickCommand", {});
		}
	},

	triggerAction: (actionId: string) => {
		const { editorView } = get();
		if (!editorView) {
			console.warn(`[Store] Cannot trigger ${actionId}: editorView is null`);
			return;
		}

		console.log(`[Store] Triggering action: ${actionId}`);

		// Ensure the editor is focused first
		editorView.focus();

		// Use a slightly longer timeout to ensure focus has stabilized
		// and the browser has processed the focus event
		setTimeout(() => {
			try {
				// Method 1: Get the action and run it (Preferred for Monaco)
				if (editorView.getAction) {
					const action = editorView.getAction(actionId);
					if (action) {
						console.log(`[Store] Running action via getAction: ${actionId}`);
						action.run();
						return;
					}
				}

				// Method 2: Trigger as a command
				console.log(`[Store] Falling back to trigger method for: ${actionId}`);
				editorView.trigger("menu", actionId, null);
			} catch (err) {
				console.error(`[Store] Failed to execute action ${actionId}:`, err);
			}
		}, 100); // 100ms is safer for focus transitions
	},

	undo: () => {
		const { triggerAction } = get();
		console.log("[Store] Undo requested");
		triggerAction("undo");
	},

	redo: () => {
		const { triggerAction } = get();
		console.log("[Store] Redo requested");
		triggerAction("redo");
	},

	updateStats: (content: string) => {
		const lines = content.split("\n").length;
		const chars = content.length;
		set({ stats: { lines, chars } });
	},

	updateEditorStatus: (ln: number, col: number) => {
		set({ editorStatus: { ln, col } });
	},
}));
