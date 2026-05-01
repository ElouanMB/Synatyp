import type React from "react";
import styles from "./WelcomeScreen.module.css";

export const NoFileSelected: React.FC = () => {
	return (
		<div className={styles.welcomeContainer}>
			<div className={styles.hero}>
				<h2 className={styles.title}>Aucun fichier ouvert</h2>
				<p className={styles.subtitle}>
					Sélectionnez un fichier dans l'explorateur pour commencer à rédiger.
				</p>
			</div>

			<div className={styles.actions}>
				<div className={styles.section}>
					<h3>Astuces</h3>
					<p style={{ color: "#888", fontSize: "13px" }}>
						Vous pouvez créer de nouveaux fichiers en faisant un clic droit dans
						la barre latérale.
					</p>
				</div>
			</div>
		</div>
	);
};
