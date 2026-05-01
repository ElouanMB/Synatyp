import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";
import { useEditorStore } from "../../store/editorStore";
import styles from "./StatusBar.module.css";

export const StatusBar: React.FC = () => {
	const { pages, errors, isCompiling, toggleTerminal, editorStatus, stats } =
		useEditorStore();
	const [appVersion, setAppVersion] = useState<string>("");

	useEffect(() => {
		getVersion().then(setAppVersion).catch(console.error);
	}, []);

	return (
		<div className={styles.statusBar}>
			<div className={styles.left}>
				<span className={styles.item}>Pages: {pages.length}</span>

				<div className={styles.divider} />

				<button
					className={styles.statusBtn}
					onClick={() => toggleTerminal()}
					type="button"
					title="Afficher/Masquer le terminal"
				>
					{errors.length > 0 ? (
						<span className={styles.errorText}>
							{errors.length} erreur{errors.length > 1 ? "s" : ""} détectée
							{errors.length > 1 ? "s" : ""}
						</span>
					) : (
						<span className={styles.successText}>Compilation réussie</span>
					)}
				</button>

				{isCompiling && <span className={styles.spinner}>⟳</span>}
			</div>

			<div className={styles.center} />

			<div className={styles.right}>
				<span className={styles.item}>
					Lig {editorStatus.ln}, Col {editorStatus.col}
				</span>
				<span className={styles.item}>{stats.lines} lignes</span>
				<span className={styles.item}>{stats.chars} caractères</span>
				<span className={styles.item}>Typst 0.13.0</span>
				<div className={styles.divider} />
				<span className={styles.item}>Synatyp v{appVersion}</span>
			</div>
		</div>
	);
};
