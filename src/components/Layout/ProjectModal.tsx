import type React from "react";
import { useEffect, useRef, useState } from "react";
import styles from "./ProjectModal.module.css";

interface ProjectModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (name: string) => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
	isOpen,
	onClose,
	onSubmit,
}) => {
	const [name, setName] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isOpen && inputRef.current) {
			inputRef.current.focus();
		}
	}, [isOpen]);

	if (!isOpen) return null;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (name.trim()) {
			onSubmit(name.trim());
			setName("");
			onClose();
		}
	};

	return (
		<button
			type="button"
			className={styles.overlay}
			onClick={onClose}
			onKeyDown={(e) => e.key === "Escape" && onClose()}
			aria-label="Fermer le modal"
		>
			<div
				className={styles.modal}
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-labelledby="modal-title"
			>
				<div className={styles.header}>
					<h2 id="modal-title">Nouveau Projet</h2>
					<button
						type="button"
						className={styles.closeBtn}
						onClick={onClose}
						aria-label="Fermer"
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
						>
							<title>Fermer</title>
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>
				</div>
				<form onSubmit={handleSubmit}>
					<div className={styles.body}>
						<label htmlFor="projectName">Nom du nouveau dossier</label>
						<input
							ref={inputRef}
							id="projectName"
							type="text"
							placeholder="Ex: Mon Rapport"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className={styles.input}
						/>
					</div>
					<div className={styles.footer}>
						<button
							type="button"
							className={styles.cancelBtn}
							onClick={onClose}
						>
							Annuler
						</button>
						<button
							type="submit"
							className={styles.submitBtn}
							disabled={!name.trim()}
						>
							Créer le projet
						</button>
					</div>
				</form>
			</div>
		</button>
	);
};
