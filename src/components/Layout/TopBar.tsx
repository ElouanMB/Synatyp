import { Window } from "@tauri-apps/api/window";
import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../../store/editorStore";
import styles from "./TopBar.module.css";

const appWindow = Window.getCurrent();

interface MenuAction {
	label?: string;
	onClick?: () => void;
	shortcut?: string;
	divider?: boolean;
	highlight?: boolean;
	disabled?: boolean;
}

interface MenuCategory {
	id: string;
	label: string;
	items: MenuAction[];
}

export const TopBar: React.FC = () => {
	const {
		mode,
		setMode,
		isDirty,
		filePath,
		saveFile,
		saveFileAs,
		openFileDialog,
		createNewFile,
		exportPdf,
		openCommandPalette,
		undo,
		redo,
		triggerAction,
		toggleChat,
	} = useEditorStore();
	const [activeMenu, setActiveMenu] = useState<string | null>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	const handleMinimize = () => appWindow.minimize();
	const handleMaximize = async () => {
		const isMaximized = await appWindow.isMaximized();
		if (isMaximized) appWindow.unmaximize();
		else appWindow.maximize();
	};
	const handleClose = () => appWindow.close();

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setActiveMenu(null);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const menuItems: MenuCategory[] = [
		{
			id: "file",
			label: "Fichier",
			items: [
				{ label: "Nouveau", onClick: createNewFile, shortcut: "Ctrl+N" },
				{ label: "Ouvrir...", onClick: openFileDialog, shortcut: "Ctrl+O" },
				{ divider: true },
				{ label: "Enregistrer", onClick: saveFile, shortcut: "Ctrl+S" },
				{ label: "Enregistrer sous...", onClick: saveFileAs },
				{ divider: true },
				{ label: "Exporter en PDF", onClick: exportPdf, highlight: true },
			],
		},
		{
			id: "edit",
			label: "Édition",
			items: [
				{ label: "Annuler", onClick: undo, shortcut: "Ctrl+Z" },
				{ label: "Rétablir", onClick: redo, shortcut: "Ctrl+Y" },
				{ divider: true },
				{
					label: "Rechercher et remplacer",
					onClick: () => triggerAction("editor.action.startFindReplaceAction"),
					shortcut: "Ctrl+H",
				},
				{
					label: "Aller à la ligne",
					onClick: () => triggerAction("editor.action.gotoLine"),
					shortcut: "Ctrl+G",
				},
				{ divider: true },
				{
					label: "Commenter la ligne",
					onClick: () => triggerAction("editor.action.commentLine"),
					shortcut: "Ctrl+/",
				},
				{
					label: "Commenter le bloc",
					onClick: () => triggerAction("editor.action.blockComment"),
					shortcut: "Shift+Alt+A",
				},
			],
		},
		{
			id: "view",
			label: "Affichage",
			items: [
				{
					label: "Barre latérale",
					onClick: useEditorStore.getState().toggleSidebar,
					shortcut: "Ctrl+B",
				},
				{ label: "Assistant IA", onClick: toggleChat, shortcut: "Ctrl+L" },
				{
					label: "Terminal",
					onClick: useEditorStore.getState().toggleTerminal,
					shortcut: "Ctrl+` ",
				},
			],
		},
		{
			id: "parameter",
			label: "Paramètres",
			items: [
				{
					label: "Palette de commandes",
					onClick: openCommandPalette,
					shortcut: "F1",
				},
				{ divider: true },
				{ label: "Bientôt disponible...", disabled: true },
			],
		},
	];

	return (
		<div className={styles.topBar} data-tauri-drag-region>
			<div className={styles.left}>
				<img
					src="/logo_transparent.svg"
					className={styles.logoImg}
					alt="Logo"
				/>
				<span className={styles.brand}>Synatyp</span>

				<div className={styles.menus} ref={menuRef}>
					{menuItems.map((menu) => (
						<div key={menu.id} className={styles.menuWrapper}>
							<button
								type="button"
								className={`${styles.menuBtn} ${activeMenu === menu.id ? styles.activeMenu : ""}`}
								onClick={() =>
									setActiveMenu(activeMenu === menu.id ? null : menu.id)
								}
								onMouseEnter={() => activeMenu && setActiveMenu(menu.id)}
							>
								{menu.label}
							</button>
							{activeMenu === menu.id && (
								<div className={styles.dropdown}>
									{menu.items.map((item, idx) =>
										item.divider ? (
											<div
												key={`div-${menu.id}-${idx}`}
												className={styles.divider}
											/>
										) : (
											<button
												key={`item-${menu.id}-${item.label}-${idx}`}
												type="button"
												className={`${styles.dropdownItem} ${item.highlight ? styles.highlight : ""} ${item.disabled ? styles.disabled : ""}`}
												onClick={() => {
													if (!item.disabled) {
														console.log(`[TopBar] Clicking ${item.label}`);
														item.onClick?.();
														setActiveMenu(null);
													}
												}}
											>
												<span className={styles.itemLabel}>{item.label}</span>
												{item.shortcut && (
													<span className={styles.shortcut}>
														{item.shortcut}
													</span>
												)}
											</button>
										),
									)}
								</div>
							)}
						</div>
					))}
				</div>
			</div>

			<div className={styles.center}>
				<span className={styles.fileName}>
					{filePath ? filePath.split(/[/\\]/).pop() : "Sans titre.typ"}
					{isDirty && <span className={styles.dirty}>●</span>}
				</span>
			</div>

			<div className={styles.right}>
				<div className={styles.modeToggle}>
					<button
						type="button"
						className={mode === "wysiwyg" ? styles.active : ""}
						onClick={() => setMode("wysiwyg")}
					>
						Visuel
					</button>
					<button
						type="button"
						className={mode === "split" ? styles.active : ""}
						onClick={() => setMode("split")}
					>
						Code
					</button>
				</div>

				<button
					type="button"
					className={`${styles.iconBtn} ${useEditorStore.getState().showChat ? styles.activeIcon : ""}`}
					onClick={toggleChat}
					title="Assistant IA (Ctrl+L)"
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						width="18"
						height="18"
					>
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
					</svg>
				</button>

				<div className={styles.windowControls}>
					<button
						type="button"
						onClick={handleMinimize}
						className={styles.controlBtn}
					>
						—
					</button>
					<button
						type="button"
						onClick={handleMaximize}
						className={styles.controlBtn}
					>
						▢
					</button>
					<button
						type="button"
						onClick={handleClose}
						className={`${styles.controlBtn} ${styles.closeBtn}`}
					>
						×
					</button>
				</div>
			</div>
		</div>
	);
};
