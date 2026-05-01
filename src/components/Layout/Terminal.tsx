import { useEditorStore } from "../../store/editorStore";
import styles from "./Terminal.module.css";

export const Terminal: React.FC = () => {
	const { errors, showTerminal, toggleTerminal } = useEditorStore();

	if (!showTerminal) return null;

	return (
		<div className={styles.terminalContainer}>
			<div className={styles.header}>
				<div className={styles.title}>
					<span>Terminal</span>
					{errors.length > 0 && (
						<span className={styles.errorCount}>
							{errors.length} erreur{errors.length > 1 ? "s" : ""}
						</span>
					)}
				</div>
				<button
					className={styles.closeButton}
					onClick={toggleTerminal}
					type="button"
				>
					×
				</button>
			</div>
			<div className={styles.content}>
				{errors.length === 0 ? (
					<div className={styles.empty}>
						Aucun problème détecté. Compilation réussie.
					</div>
				) : (
					errors.map((error, index) => (
						<div
							key={`${error.line}-${error.column}-${index}`}
							className={styles.errorItem}
						>
							<span className={styles.errorPrefix}>[ERROR]</span>
							{error.line && error.column && (
								<span className={styles.location}>
									{error.line}:{error.column}:
								</span>
							)}
							<span className={styles.message}>{error.message}</span>
						</div>
					))
				)}
			</div>
		</div>
	);
};
