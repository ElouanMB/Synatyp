import { invoke } from "@tauri-apps/api/core";
import type React from "react";
import { useState } from "react";
import { useEditorStore } from "../../store/editorStore";
import { ProjectModal } from "./ProjectModal";
import styles from "./WelcomeScreen.module.css";

export const WelcomeScreen: React.FC = () => {
	const { initProject } = useEditorStore();
	const [isModalOpen, setIsModalOpen] = useState(false);

	const handleOpenProject = async () => {
		try {
			const projectsDir = await invoke<string>("get_projects_dir");
			const { open } = await import("@tauri-apps/plugin-dialog");
			const path = await open({
				directory: true,
				multiple: false,
				defaultPath: projectsDir,
			});

			if (path && typeof path === "string") {
				// If it's a directory inside projects, load it as a project
				// Extract project name from path
				const projectName = path.split(/[/\\]/).pop();
				if (projectName) {
					const { loadProject } = useEditorStore.getState();
					await loadProject(projectName);
				}
			}
		} catch (err) {
			console.error("Failed to open project", err);
		}
	};

	return (
		<div className={styles.welcomeContainer}>
			<div className={styles.hero}>
				<img src="/logo_full.svg" alt="Synatyp" className={styles.logo} />
				<h1 className={styles.title}>Bienvenue sur Synatyp</h1>
				<p className={styles.subtitle}>
					L'éditeur Typst pour l'association Synaptik RDR
				</p>
			</div>

			<div className={styles.actions}>
				<div className={styles.section}>
					<h3>Démarrer</h3>
					<button type="button" onClick={() => setIsModalOpen(true)}>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<title>Nouveau Projet</title>
							<path d="M12 5v14M5 12h14" />
						</svg>
						Nouveau Projet
					</button>
					<button type="button" onClick={handleOpenProject}>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<title>Ouvrir un Projet</title>
							<path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v2" />
						</svg>
						Ouvrir un Projet
					</button>
				</div>

				<div className={styles.section}>
					<h3>Raccourcis</h3>
					<div className={styles.shortcut}>
						<span>Barre latérale</span>
						<kbd>Ctrl + B</kbd>
					</div>
					<div className={styles.shortcut}>
						<span>Console / Terminal</span>
						<kbd>Ctrl + `</kbd>
					</div>
					<div className={styles.shortcut}>
						<span>Sauvegarder</span>
						<kbd>Ctrl + S</kbd>
					</div>
					<div className={styles.shortcut}>
						<span>Ouvrir un fichier</span>
						<kbd>Ctrl + O</kbd>
					</div>
				</div>
			</div>

			<ProjectModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				onSubmit={initProject}
			/>
		</div>
	);
};
