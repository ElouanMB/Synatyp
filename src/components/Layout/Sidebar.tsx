import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type FileItem, useEditorStore } from "../../store/editorStore";
import { ModelLibrary } from "../Models/ModelLibrary";
import styles from "./Sidebar.module.css";

// SVG Icons
const SidebarIcons = {
	Explorer: () => (
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Explorer</title>
			<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V17" />
			<path d="M19 13V5.5L15.5 2H9a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2Z" />
			<path d="M15.5 2v3.5H19" />
		</svg>
	),
	ExplorerSmall: () => (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Explorer</title>
			<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V17" />
			<path d="M19 13V5.5L15.5 2H9a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2Z" />
			<path d="M15.5 2v3.5H19" />
		</svg>
	),
	SearchSmall: () => (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Rechercher</title>
			<circle cx="11" cy="11" r="8" />
			<path d="m21 21-4.3-4.3" />
		</svg>
	),
	Folder: ({ open }: { open?: boolean }) => (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			style={{ color: "#e8a87c" }}
		>
			<title>{open ? "Open Folder" : "Closed Folder"}</title>
			<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
		</svg>
	),
	ChevronRight: () => (
		<svg
			width="12"
			height="12"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="3"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Réduire</title>
			<path d="m9 18 6-6-6-6" />
		</svg>
	),
	ChevronDown: () => (
		<svg
			width="12"
			height="12"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="3"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Aggrandir</title>
			<path d="m6 9 6 6 6-6" />
		</svg>
	),
	TypstFile: () => (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			style={{ color: "#519aba" }}
		>
			<title>Fichier Typst</title>
			<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
			<polyline points="14 2 14 8 20 8" />
		</svg>
	),
	ImageFile: () => (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			style={{ color: "#a074c4" }}
		>
			<title>Fichier image</title>
			<rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
			<circle cx="9" cy="9" r="2" />
			<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
		</svg>
	),
	Plus: () => (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Nouveau projet</title>
			<path d="M12 5v14M5 12h14" />
		</svg>
	),
	Import: () => (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Importer une image</title>
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<polyline points="7 10 12 15 17 10" />
			<line x1="12" y1="15" x2="12" y2="3" />
		</svg>
	),
	Back: () => (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Retour arrière</title>
			<path d="m15 18-6-6 6-6" />
		</svg>
	),
	Trash: () => (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Supprimer</title>
			<polyline points="3 6 5 6 21 6"></polyline>
			<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
			<line x1="10" y1="11" x2="10" y2="17"></line>
			<line x1="14" y1="11" x2="14" y2="17"></line>
		</svg>
	),
	PanelLeft: () => (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Activer la barre latéral</title>
			<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
			<line x1="9" y1="3" x2="9" y2="21"></line>
		</svg>
	),
	Edit: () => (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Renommer</title>
			<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
			<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
		</svg>
	),
	FileText: () => (
		<svg
			width="12"
			height="12"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Texte</title>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
			<line x1="16" y1="13" x2="8" y2="13" />
			<line x1="16" y1="17" x2="8" y2="17" />
			<polyline points="10 9 9 9 8 9" />
		</svg>
	),
	Model: () => (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Modèles</title>
			<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
		</svg>
	),
	UnsavedDot: () => (
		<svg
			width="8"
			height="8"
			viewBox="0 0 24 24"
			fill="#B86BF8"
			style={{ marginLeft: "auto", marginRight: "4px" }}
		>
			<title>Modifié</title>
			<circle cx="12" cy="12" r="10" />
		</svg>
	),
};

export const Sidebar: React.FC = () => {
	const [newProjectName, setNewProjectName] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
		new Set(),
	);
	const [activeTab, setActiveTab] = useState<"explorer" | "search" | "models">(
		"explorer",
	);
	const [hoveredImage, setHoveredImage] = useState<{
		path: string;
		x: number;
		y: number;
	} | null>(null);
	const [sidebarWidth, setSidebarWidth] = useState(150);
	const [isResizing, setIsResizing] = useState(false);

	const [renamingProject, setRenamingProject] = useState<string | null>(null);
	const [tempName, setTempName] = useState("");

	const {
		projectPath,
		projectFiles,
		initProject,
		loadProject,
		listProjects,
		projects,
		importAsset,
		refreshProjectFiles,
		filePath,
		searchQuery,
		setSearchQuery,
		openFile,
		deleteProject,
		renameProject,
		showSidebar,
		toggleSidebar,
		searchProjects,
		isSearching,
		searchResults,
		jumpToLine,
		createFile,
		renameFile,
		deleteFile,
		createDir,
		isDirtyFiles,
	} = useEditorStore();

	const [isCreatingFile, setIsCreatingFile] = useState(false);
	const [isCreatingFolder, setIsCreatingFolder] = useState(false);
	const [newFileName, setNewFileName] = useState("");
	const [renamingFilePath, setRenamingFilePath] = useState<string | null>(null);
	const [tempFileName, setTempFileName] = useState("");
	const [contextMenu, setContextMenu] = useState<{
		x: number;
		y: number;
		item: FileItem | null;
	} | null>(null);
	const draggedItemPathRef = useRef<string | null>(null);
	const [dragOverPath, setDragOverPath] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		listProjects();
	}, [listProjects]);

	useEffect(() => {
		if (projectPath) {
			refreshProjectFiles();
			setExpandedFolders(new Set());
		}
	}, [projectPath, refreshProjectFiles]);

	useEffect(() => {
		if (activeTab === "search" && searchQuery.trim()) {
			const timer = setTimeout(() => {
				searchProjects(searchQuery);
			}, 300);
			return () => clearTimeout(timer);
		} else if (activeTab === "search" && !searchQuery.trim()) {
			// Clear results if search query is empty
			searchProjects("");
		}
	}, [searchQuery, activeTab, searchProjects]);

	const handleMouseDown = (e: React.MouseEvent) => {
		setIsResizing(true);
		e.preventDefault();
	};

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (!isResizing) return;
			const newWidth = Math.max(160, Math.min(600, e.clientX));
			setSidebarWidth(newWidth);
		};

		const handleMouseUp = () => {
			setIsResizing(false);
		};

		if (isResizing) {
			window.addEventListener("mousemove", handleMouseMove);
			window.addEventListener("mouseup", handleMouseUp);
		}

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [isResizing]);

	const toggleFolder = useCallback((path: string) => {
		setExpandedFolders((prev) => {
			const next = new Set(prev);
			if (next.has(path)) {
				next.delete(path);
			} else {
				next.add(path);
			}
			return next;
		});
	}, []);

	const handleCreateProject = async (e: React.FormEvent) => {
		e.preventDefault();
		const name = newProjectName.trim();
		if (name) {
			// Check if project already exists
			if (projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
				alert(`A project named "${name}" already exists.`);
				return;
			}

			await initProject(name);
			setNewProjectName("");
			setIsCreating(false);
		}
	};

	const handleRenameSubmit = async (e: React.FormEvent, oldName: string) => {
		e.preventDefault();
		const newName = tempName.trim();
		if (newName && newName !== oldName) {
			if (
				projects.some((p) => p.name.toLowerCase() === newName.toLowerCase())
			) {
				alert(`A project named "${newName}" already exists.`);
				return;
			}
			await renameProject(oldName, newName);
		}
		setRenamingProject(null);
	};

	const handleFileRenameSubmit = useCallback(
		async (e: React.FormEvent, oldPath: string) => {
			e.preventDefault();
			if (tempFileName?.trim()) {
				const parts = oldPath.split(/[/\\]/);
				parts.pop();
				const newPath = [...parts, tempFileName.trim()].join("/");
				if (newPath !== oldPath) {
					await renameFile(oldPath, newPath);
				}
			}
			setRenamingFilePath(null);
		},
		[tempFileName, renameFile],
	);

	const handleCreateFileSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			if (newFileName.trim() && projectPath) {
				let name = newFileName.trim();
				const isFolder = isCreatingFolder;
				if (!isFolder && !name.includes(".")) name += ".typ";
				const path = `${projectPath}/${name}`;

				if (isFolder) {
					await createDir(path);
				} else {
					await createFile(path);
				}

				setNewFileName("");
				setIsCreatingFile(false);
				setIsCreatingFolder(false);
			}
		},
		[newFileName, projectPath, createFile, createDir, isCreatingFolder],
	);

	const handleContextMenu = useCallback(
		(e: React.MouseEvent, item: FileItem | null) => {
			e.preventDefault();
			e.stopPropagation();
			setContextMenu({ x: e.clientX, y: e.clientY, item });
		},
		[],
	);

	const handleDragStart = useCallback((e: React.DragEvent, path: string) => {
		e.stopPropagation();
		console.clear();
		console.log("[DND] Drag Start:", path);
		draggedItemPathRef.current = path;
		e.dataTransfer.setData("text/plain", path);
		e.dataTransfer.effectAllowed = "move";
	}, []);

	const handleDragOver = useCallback(
		(e: React.DragEvent, path: string) => {
			e.preventDefault();
			e.stopPropagation();

			const draggedPath = draggedItemPathRef.current;
			console.log(`[DND] DragOver on ${path}. Dragged: ${draggedPath}`);

			if (draggedPath && draggedPath !== path) {
				if (dragOverPath !== path) {
					setDragOverPath(path);
				}
				e.dataTransfer.dropEffect = "move";
			} else {
				e.dataTransfer.dropEffect = "none";
			}

			return false;
		},
		[dragOverPath],
	);

	const handleDragEnd = useCallback(() => {
		console.log("[DND] Drag End");
		draggedItemPathRef.current = null;
		setDragOverPath(null);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setDragOverPath(null);
	}, []);

	const handleDrop = useCallback(
		async (e: React.DragEvent, targetPath: string, isTargetFolder: boolean) => {
			e.preventDefault();
			e.stopPropagation();
			console.log(
				"[DND] Drop on target:",
				targetPath,
				"isFolder:",
				isTargetFolder,
			);
			setDragOverPath(null);

			const draggedPath =
				draggedItemPathRef.current || e.dataTransfer.getData("text/plain");
			console.log("[DND] Dragged item path:", draggedPath);

			if (!draggedPath || draggedPath === targetPath) {
				console.log("[DND] Drop cancelled: same path or no path");
				return;
			}

			const fileName = draggedPath.split(/[/\\]/).pop();
			if (!fileName) return;

			let destinationPath = targetPath;
			if (!isTargetFolder) {
				const parts = targetPath.split(/[/\\]/);
				parts.pop();
				destinationPath = parts.join("/");
			}

			const finalPath = `${destinationPath}/${fileName}`;
			console.log("[DND] Moving to:", finalPath);

			if (finalPath !== draggedPath) {
				try {
					await renameFile(draggedPath, finalPath);
					console.log("[DND] Rename successful");
				} catch (err) {
					console.error("[DND] Rename failed:", err);
				}
			}
			draggedItemPathRef.current = null;
		},
		[renameFile],
	);

	const handleDropToRoot = useCallback(
		async (e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setDragOverPath(null);

			const draggedPath =
				draggedItemPathRef.current || e.dataTransfer.getData("text/plain");
			if (!draggedPath || !projectPath) return;

			const fileName = draggedPath.split(/[/\\]/).pop();
			if (!fileName) return;

			const finalPath = `${projectPath}/${fileName}`;

			if (finalPath !== draggedPath) {
				console.log("[DND] Moving to root:", finalPath);
				try {
					await renameFile(draggedPath, finalPath);
				} catch (err) {
					console.error("[DND] Move to root failed:", err);
				}
			}
			draggedItemPathRef.current = null;
		},
		[projectPath, renameFile],
	);

	useEffect(() => {
		const handleClick = () => setContextMenu(null);
		const handleGlobalDragOver = (e: DragEvent) => {
			if (draggedItemPathRef.current) {
				e.preventDefault();
				if (e.dataTransfer) {
					e.dataTransfer.dropEffect = "move";
				}
			} else {
				if (e.dataTransfer?.types.includes("Files")) {
					console.log("[DND] Global DragOver (External Files)");
				}
			}
		};

		const handleGlobalDragStart = (e: DragEvent) => {
			console.log("[DND] Global DragStart", e.target);
		};

		const handleGlobalDragEnd = (e: DragEvent) => {
			console.log("[DND] Global DragEnd", e.target);
		};

		window.addEventListener("click", handleClick);
		window.addEventListener("dragover", handleGlobalDragOver);
		window.addEventListener("dragstart", handleGlobalDragStart);
		window.addEventListener("dragend", handleGlobalDragEnd);
		return () => {
			window.removeEventListener("click", handleClick);
			window.removeEventListener("dragover", handleGlobalDragOver);
			window.removeEventListener("dragstart", handleGlobalDragStart);
			window.removeEventListener("dragend", handleGlobalDragEnd);
		};
	}, []);

	const getFileIcon = useCallback(
		(file: string | undefined, isFolder: boolean, isExpanded: boolean) => {
			const fileName = file || "";
			if (isFolder) return <SidebarIcons.Folder open={isExpanded} />;
			if (fileName.endsWith(".typ")) return <SidebarIcons.TypstFile />;
			if (/\.(png|jpg|jpeg|svg)$/i.test(fileName))
				return <SidebarIcons.ImageFile />;
			return <span style={{ width: 16 }}>📄</span>;
		},
		[],
	);

	useEffect(() => {
		if (
			isCreating ||
			isCreatingFile ||
			isCreatingFolder ||
			renamingFilePath ||
			renamingProject
		) {
			setTimeout(() => inputRef.current?.focus(), 10);
		}
	}, [
		isCreating,
		isCreatingFile,
		isCreatingFolder,
		renamingFilePath,
		renamingProject,
	]);

	const renderFileTree = useCallback(
		(files: FileItem[], depth = 0) => {
			if (!Array.isArray(files)) {
				console.warn("[Sidebar] renderFileTree called with non-array:", files);
				return null;
			}

			// Sort items: folders first, then alphabetically by name
			const sorted = [...files].sort((a, b) => {
				if (a.is_dir && !b.is_dir) return -1;
				if (!a.is_dir && b.is_dir) return 1;
				return (a.name || "").localeCompare(b.name || "");
			});

			return (
				<div className={styles.fileTree}>
					{(isCreatingFile || isCreatingFolder) && depth === 0 && (
						<form
							className={styles.renameForm}
							onSubmit={handleCreateFileSubmit}
						>
							<input
								className={styles.renameInput}
								placeholder={isCreatingFolder ? "folder name..." : "file.typ"}
								value={newFileName}
								onChange={(e) => setNewFileName(e.target.value)}
								onBlur={() => {
									setIsCreatingFile(false);
									setIsCreatingFolder(false);
								}}
								onKeyDown={(e) => {
									if (e.key === "Escape") {
										setIsCreatingFile(false);
										setIsCreatingFolder(false);
									}
								}}
							/>
						</form>
					)}
					{sorted.map((item) => {
						const isFolder = item.is_dir;
						const isExpanded = expandedFolders.has(item.path);
						const isActive = filePath === item.path;
						const isDirty = !isFolder && isDirtyFiles[item.path];

						if (renamingFilePath === item.path) {
							return (
								<form
									key={item.path}
									className={styles.renameForm}
									onSubmit={(e) => handleFileRenameSubmit(e, item.path)}
									style={{ marginLeft: `${depth * 12 + 12}px` }}
								>
									<input
										ref={inputRef}
										className={styles.renameInput}
										value={tempFileName}
										onChange={(e) => setTempFileName(e.target.value)}
										onBlur={() => setRenamingFilePath(null)}
										onKeyDown={(e) =>
											e.key === "Escape" && setRenamingFilePath(null)
										}
									/>
								</form>
							);
						}

						return (
							<div key={item.path}>
								<button
									type="button"
									className={`${styles.treeItem} ${isActive ? styles.activeFile : ""} ${dragOverPath === item.path ? styles.dragOver : ""}`}
									onContextMenu={(e) => handleContextMenu(e, item)}
									onDragOver={(e) => handleDragOver(e, item.path)}
									onDragEnter={(e) => {
										e.preventDefault();
										e.stopPropagation();
										if (
											draggedItemPathRef.current &&
											draggedItemPathRef.current !== item.path
										) {
											setDragOverPath(item.path);
										}
									}}
									onDragLeave={handleDragLeave}
									onDrop={(e) => handleDrop(e, item.path, isFolder)}
									draggable
									onDragStart={(e) => handleDragStart(e, item.path)}
									onDragEnd={handleDragEnd}
									onClick={() => {
										if (isFolder) {
											toggleFolder(item.path);
										} else {
											openFile(item.path);
										}
									}}
									onMouseEnter={(e) => {
										if (draggedItemPathRef.current) return; // Prevent re-renders during drag
										if (
											!isFolder &&
											/\.(png|jpg|jpeg|svg|webp)$/i.test(item.name)
										) {
											setHoveredImage({
												path: item.path,
												x: e.clientX,
												y: e.clientY,
											});
										}
									}}
									onMouseLeave={() => setHoveredImage(null)}
									style={{ paddingLeft: `${depth * 12 + 8}px` }}
								>
									<div className={styles.chevron}>
										{isFolder &&
											(isExpanded ? (
												<SidebarIcons.ChevronDown />
											) : (
												<SidebarIcons.ChevronRight />
											))}
									</div>
									<div className={styles.fileIcon}>
										{getFileIcon(item.name, isFolder, isExpanded)}
									</div>
									<span
										className={styles.fileName}
										style={{ color: isDirty ? "#B86BF8" : undefined }}
									>
										{item.name}
									</span>
									{isDirty && <SidebarIcons.UnsavedDot />}
								</button>
								{isExpanded &&
									isFolder &&
									item.children &&
									renderFileTree(item.children, depth + 1)}
							</div>
						);
					})}
				</div>
			);
		},
		[
			expandedFolders,
			filePath,
			openFile,
			toggleFolder,
			getFileIcon,
			isCreatingFile,
			isCreatingFolder,
			newFileName,
			renamingFilePath,
			tempFileName,
			handleCreateFileSubmit,
			handleFileRenameSubmit,
			handleContextMenu,
			handleDrop,
			handleDragStart,
			handleDragOver,
			handleDragLeave,
			dragOverPath,
			handleDragEnd,
			isDirtyFiles,
		],
	);

	const currentProjectName = projectPath
		? projectPath.split(/[/\\]/).pop()
		: null;

	if (!showSidebar) {
		return null;
	}

	return (
		<div className={styles.sidebar} style={{ width: `${sidebarWidth}px` }}>
			<div className={styles.sidebarHeader}>
				<div className={styles.headerMain}>
					<h2>EXPLORATEUR</h2>
					<div className={styles.headerActions}>
						<button
							type="button"
							className={styles.actionBtn}
							onClick={toggleSidebar}
							title="Masquer la barre latérale"
						>
							<SidebarIcons.PanelLeft />
						</button>
					</div>
				</div>
				<div className={styles.tabActions}>
					<button
						type="button"
						className={`${styles.tabBtn} ${activeTab === "explorer" ? styles.activeTab : ""}`}
						onClick={() => setActiveTab("explorer")}
						title="Explorateur"
					>
						<SidebarIcons.ExplorerSmall />
					</button>
					<button
						type="button"
						className={`${styles.tabBtn} ${activeTab === "search" ? styles.activeTab : ""}`}
						onClick={() => setActiveTab("search")}
						title="Rechercher"
					>
						<SidebarIcons.SearchSmall />
					</button>
					<button
						type="button"
						className={`${styles.tabBtn} ${activeTab === "models" ? styles.activeTab : ""}`}
						onClick={() => setActiveTab("models")}
						title="Modèles"
					>
						<SidebarIcons.Model />
					</button>
				</div>
			</div>

			<div className={styles.sidebarContent}>
				{activeTab === "search" ? (
					<div className={styles.searchView}>
						<div className={styles.searchContainer}>
							<form
								onSubmit={(e) => {
									e.preventDefault();
									searchProjects(searchQuery);
								}}
							>
								<input
									type="search"
									placeholder="Rechercher dans tous les projets..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className={styles.vscodeInput}
								/>
							</form>
						</div>
						<div className={styles.resultsView}>
							{isSearching ? (
								<p className={styles.emptyMsg}>Recherche en cours...</p>
							) : searchResults.length > 0 ? (
								<div className={styles.searchResults}>
									<div className={styles.resultsCount}>
										{searchResults.length} résultats trouvés
									</div>
									{searchResults.map((result, idx) => (
										<button
											type="button"
											key={`${result.file_path}-${result.line}-${idx}`}
											className={styles.searchResultItem}
											onClick={async () => {
												await openFile(result.file_path);
												// Small delay to ensure Monaco model is loaded
												setTimeout(() => jumpToLine(result.line), 100);
											}}
										>
											<div className={styles.resultHeader}>
												<span className={styles.resultFile}>
													{result.file_name}
												</span>
												<span className={styles.resultProject}>
													{result.project_name}
												</span>
											</div>
											<div className={styles.resultContent}>
												<span className={styles.resultLine}>
													{result.line}:
												</span>
												<span className={styles.resultText}>
													{result.content}
												</span>
											</div>
										</button>
									))}
								</div>
							) : (
								<p className={styles.emptyMsg}>
									{searchQuery
										? "Aucun résultat trouvé."
										: "Entrez un terme pour rechercher dans tous vos projets Typst."}
								</p>
							)}
						</div>
					</div>
				) : activeTab === "models" ? (
					<ModelLibrary />
				) : !projectPath ? (
					<div className={styles.projectManager}>
						{/* biome-ignore lint: Nested buttons are invalid HTML, so we use a div with role="button" here */}
						<div
							className={styles.sectionHeader}
							onContextMenu={(e) => handleContextMenu(e, null)}
							role="button"
							tabIndex={0}
							onKeyDown={(e) =>
								e.key === "Enter" &&
								handleContextMenu(
									{
										clientX: 0,
										clientY: 0,
										preventDefault: () => {},
										stopPropagation: () => {},
									} as unknown as React.MouseEvent,
									null,
								)
							}
						>
							<SidebarIcons.ChevronDown />
							<span className={styles.sectionTitle}>PROJETS</span>
							<div className={styles.headerActions}>
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										setIsCreating(true);
									}}
									title="Nouveau Projet"
									className={styles.actionBtn}
								>
									<SidebarIcons.Plus />
								</button>
							</div>
						</div>
						<div className={styles.managerContent}>
							{isCreating && (
								<form
									onSubmit={handleCreateProject}
									className={styles.createForm}
								>
									<input
										ref={inputRef}
										type="text"
										placeholder="Nom du projet..."
										value={newProjectName}
										onChange={(e) => setNewProjectName(e.target.value)}
										className={styles.vscodeInput}
										onBlur={() => !newProjectName && setIsCreating(false)}
									/>
								</form>
							)}

							<div className={styles.vscodeList}>
								{projects.map(
									(p: import("../../store/editorStore").ProjectInfo) => (
										<div
											key={p.path}
											className={`${styles.projectItem} ${projectPath === p.path ? styles.activeProject : ""}`}
										>
											{renamingProject === p.name ? (
												<form
													onSubmit={(e) => handleRenameSubmit(e, p.name)}
													className={styles.renameForm}
												>
													<input
														ref={inputRef}
														type="text"
														value={tempName}
														onChange={(e) => setTempName(e.target.value)}
														onBlur={() => setRenamingProject(null)}
														className={styles.renameInput}
													/>
												</form>
											) : (
												<>
													<button
														type="button"
														className={styles.projectMain}
														onClick={() => loadProject(p.name)}
													>
														<SidebarIcons.Folder />
														<span>{p.name}</span>
													</button>
													<div className={styles.projectActions}>
														<button
															type="button"
															className={styles.actionBtn}
															onClick={(e) => {
																e.stopPropagation();
																setRenamingProject(p.name);
																setTempName(p.name);
															}}
															title="Renommer"
														>
															<SidebarIcons.Edit />
														</button>
														<button
															type="button"
															className={styles.actionBtn}
															onClick={(e) => {
																e.stopPropagation();
																if (
																	confirm(`Supprimer le projet ${p.name} ?`)
																) {
																	deleteProject(p.name);
																}
															}}
															title="Supprimer"
														>
															<SidebarIcons.Trash />
														</button>
													</div>
												</>
											)}
										</div>
									),
								)}
							</div>
						</div>
					</div>
				) : (
					<div className={styles.explorerView}>
						<div className={styles.sectionHeader}>
							<SidebarIcons.ChevronDown />
							<span className={styles.projectTitle}>
								{currentProjectName?.toUpperCase()}
							</span>
							<div className={styles.headerActions}>
								<button
									type="button"
									onClick={importAsset}
									title="Importer un fichier"
								>
									<SidebarIcons.Import />
								</button>
								<button
									type="button"
									onClick={() => loadProject(null)}
									title="Retour"
								>
									<SidebarIcons.Back />
								</button>
							</div>
						</div>

						<div
							className={styles.treeView}
							onContextMenu={(e) => handleContextMenu(e, null)}
							onDragOver={(e) => {
								e.preventDefault();
								e.dataTransfer.dropEffect = "move";
							}}
							onDrop={handleDropToRoot}
							role="tree"
							tabIndex={0}
							aria-label="Explorateur de fichiers"
						>
							{renderFileTree(projectFiles)}
						</div>
					</div>
				)}
			</div>

			{hoveredImage && (
				<div
					className={styles.imagePreviewPopup}
					style={{
						left: `${hoveredImage.x + 20}px`,
						top: `${hoveredImage.y - 100}px`,
					}}
				>
					<img
						src={convertFileSrc(hoveredImage.path)}
						alt="Preview"
						onError={(e) =>
							console.error("Preview failed for:", hoveredImage.path, e)
						}
					/>
					<div className={styles.previewPath}>
						{hoveredImage.path.split("/").pop()}
					</div>
				</div>
			)}

			{contextMenu && (
				<div
					className={styles.contextMenu}
					style={{ left: contextMenu.x, top: contextMenu.y }}
					onMouseLeave={() => setContextMenu(null)}
					onKeyDown={(e) => e.key === "Escape" && setContextMenu(null)}
					role="menu"
					tabIndex={-1}
				>
					{contextMenu.item ? (
						<>
							<button
								type="button"
								onClick={() => {
									if (contextMenu.item) {
										setRenamingFilePath(contextMenu.item.path);
										setTempFileName(contextMenu.item.name);
									}
									setContextMenu(null);
								}}
							>
								Renommer
							</button>
							<button
								type="button"
								onClick={() => {
									if (
										contextMenu.item &&
										confirm(`Supprimer ${contextMenu.item.name} ?`)
									)
										deleteFile(contextMenu.item.path);
									setContextMenu(null);
								}}
							>
								Supprimer
							</button>
							<button
								type="button"
								onClick={() => {
									if (projectPath && contextMenu.item) {
										const relPath = contextMenu.item.path.replace(
											`${projectPath}/`,
											"",
										);
										navigator.clipboard.writeText(relPath);
									}
									setContextMenu(null);
								}}
							>
								Copier le chemin relatif
							</button>
							<div className={styles.menuSeparator} />
							<button
								type="button"
								onClick={() => {
									if (contextMenu.item)
										invoke("show_in_folder", { path: contextMenu.item.path });
									setContextMenu(null);
								}}
							>
								Afficher dans l'explorateur
							</button>
						</>
					) : !projectPath ? (
						<button
							type="button"
							onClick={() => {
								setIsCreating(true);
								setContextMenu(null);
							}}
						>
							Nouveau Projet
						</button>
					) : (
						<>
							<button
								type="button"
								onClick={() => {
									setIsCreatingFile(true);
									setIsCreatingFolder(false);
									setContextMenu(null);
								}}
							>
								Nouveau Fichier
							</button>
							<button
								type="button"
								onClick={() => {
									setIsCreatingFolder(true);
									setIsCreatingFile(false);
									setContextMenu(null);
								}}
							>
								Nouveau Dossier
							</button>
						</>
					)}
				</div>
			)}

			{/* biome-ignore lint: Resizer is mouse-only */}
			<div
				className={`${styles.sidebarResizer} ${isResizing ? styles.resizing : ""}`}
				onMouseDown={handleMouseDown}
			/>
		</div>
	);
};
