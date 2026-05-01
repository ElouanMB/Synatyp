import { invoke } from "@tauri-apps/api/core";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "../../store/editorStore";
import styles from "../Layout/Sidebar.module.css";
import {
	processDeltaPlaneSetup,
	processSessionInfoTemplate,
	processSignaturesTemplate,
} from "./templates";

export interface SecureTemplates {
	delta_plane_setup: string;
	session_info_base: string;
	signatures_base: string;
	section: string;
	list: string;
	subtitle: string;
}

const Icons = {
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
			<title>Modèle Delta Plane</title>
			<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
		</svg>
	),
	Calendar: () => (
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
			<title>Calendrier</title>
			<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
			<line x1="16" y1="2" x2="16" y2="6" />
			<line x1="8" y1="2" x2="8" y2="6" />
			<line x1="3" y1="10" x2="21" y2="10" />
		</svg>
	),
	Users: () => (
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
			<title>Participants</title>
			<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
			<circle cx="9" cy="7" r="4" />
			<path d="M23 21v-2a4 4 0 0 0-3-3.87" />
			<path d="M16 3.13a4 4 0 0 1 0 7.75" />
		</svg>
	),
	PenTool: () => (
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
			<title>Signature</title>
			<path d="m12 19 7-7 3 3-7 7-3-3z" />
			<path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
			<path d="m2 2 5 5" />
			<path d="m11 11 5 5" />
		</svg>
	),
	Layers: () => (
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
			<title>Éléments</title>
			<polygon points="12 2 2 7 12 12 22 7 12 2" />
			<polyline points="2 17 12 22 22 17" />
			<polyline points="2 12 12 17 22 12" />
		</svg>
	),
	X: () => (
		<svg
			width="10"
			height="10"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="3"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Supprimer</title>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	),
	Plus: () => (
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
			<title>Ajouter</title>
			<path d="M12 5v14M5 12h14" />
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
	Type: () => (
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
			<title>Sous-titre</title>
			<polyline points="4 7 4 4 20 4 20 7" />
			<line x1="9" y1="20" x2="15" y2="20" />
			<line x1="12" y1="4" x2="12" y2="20" />
		</svg>
	),
	List: () => (
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
			<title>Liste</title>
			<line x1="8" y1="6" x2="21" y2="6" />
			<line x1="8" y1="12" x2="21" y2="12" />
			<line x1="8" y1="18" x2="21" y2="18" />
			<line x1="3" y1="6" x2="3.01" y2="6" />
			<line x1="3" y1="12" x2="3.01" y2="12" />
			<line x1="3" y1="18" x2="3.01" y2="18" />
		</svg>
	),
	ChevronDown: () => (
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
			<title>Développer</title>
			<polyline points="6 9 12 15 18 9" />
		</svg>
	),
	ChevronRight: () => (
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
			<title>Réduire</title>
			<polyline points="9 18 15 12 9 6" />
		</svg>
	),
};

const unescapeNewlines = (str: string) => str.replace(/\\n/g, "\n");

export const ModelLibrary: React.FC = () => {
	const { insertText, unlockedTemplates, setUnlockedTemplates } =
		useEditorStore();
	const passwordInputRef = useRef<HTMLInputElement>(null);

	// Security Gate
	const [password, setPassword] = useState("");
	const [error, setError] = useState(false);
	const [isDecrypting, setIsDecrypting] = useState(false);

	// The definitive unlocked state comes from the store
	const isUnlocked = !!unlockedTemplates;

	const handleUnlockAttempt = useCallback(
		async (pwd: string) => {
			if (isUnlocked) return;
			setIsDecrypting(true);
			try {
				const templates = await invoke<SecureTemplates>("unlock_models", {
					password: pwd,
				});
				setUnlockedTemplates(templates);
				setError(false);
				localStorage.setItem("Synatyp-models-password", pwd);
			} catch (_) {
				setError(true);
				setPassword("");
				localStorage.removeItem("Synatyp-models-password");
			} finally {
				setIsDecrypting(false);
			}
		},
		[isUnlocked, setUnlockedTemplates],
	);

	// Attempt automatic unlock ONLY if not already unlocked
	useEffect(() => {
		if (isUnlocked) return;

		const saved = localStorage.getItem("Synatyp-models-password");
		if (saved) {
			handleUnlockAttempt(saved);
		}
	}, [handleUnlockAttempt, isUnlocked]);

	// Focus password field on mount if not unlocked
	useEffect(() => {
		if (!isUnlocked && !isDecrypting && passwordInputRef.current) {
			passwordInputRef.current.focus();
		}
	}, [isUnlocked, isDecrypting]);

	const handleUnlock = (e: React.FormEvent) => {
		e.preventDefault();
		handleUnlockAttempt(password);
	};

	// Doc Initialization state
	const [docTitle, setDocTitle] = useState("");
	const [docSubtitle, setDocSubtitle] = useState("");
	const [docDate, setDocDate] = useState(
		new Date().toLocaleDateString("fr-FR"),
	);

	const handleInitialize = () => {
		if (!unlockedTemplates) return;
		const processed = processDeltaPlaneSetup(
			unlockedTemplates.delta_plane_setup,
			docTitle,
			docSubtitle,
			docDate,
		);
		insertText(unescapeNewlines(processed), "");
	};

	const [showSessionConfig, setShowSessionConfig] = useState(false);
	const [sessionFields, setSessionFields] = useState({
		date: true,
		lieu: true,
		heure: true,
		ref: true,
		objet: true,
	});

	const [showSigConfig, setShowSigConfig] = useState(false);
	const [signatories, setSignatories] = useState([
		{ id: 1, name: "", role: "" },
	]);

	if (!isUnlocked) {
		return (
			<div
				className={styles.modelsView}
				style={{ justifyContent: "center", padding: "20px" }}
			>
				<div style={{ textAlign: "center", color: "#888" }}>
					<div style={{ marginBottom: "16px", color: "#B86BF8" }}>
						<Icons.Model />
					</div>
					<h3 style={{ fontSize: "13px", color: "#ccc", marginBottom: "8px" }}>
						Accès Réservé
					</h3>
					<p style={{ fontSize: "11px", marginBottom: "16px" }}>
						Veuillez saisir le mot de passe pour déchiffrer les modèles
						sécurisés.
					</p>

					<form onSubmit={handleUnlock}>
						<input
							ref={passwordInputRef}
							type="password"
							placeholder="Mot de passe"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className={styles.vscodeInput}
							style={{
								textAlign: "center",
								border: error ? "1px solid #f44" : undefined,
							}}
							disabled={isDecrypting}
						/>
						{error && (
							<p style={{ color: "#f44", fontSize: "10px", marginTop: "4px" }}>
								Mot de passe incorrect
							</p>
						)}
						<button
							type="submit"
							className={styles.insertBtn}
							style={{ marginTop: "12px", width: "100%" }}
							disabled={isDecrypting}
						>
							{isDecrypting ? "Déchiffrement..." : "Déverrouiller"}
						</button>
					</form>
				</div>
			</div>
		);
	}

	return (
		<div className={styles.modelsView}>
			<div
				className={styles.deltaPlaneContent}
				style={{ borderTop: "none", paddingTop: 0 }}
			>
				<div className={styles.modelGroup}>
					<span className={styles.groupLabel}>Structure</span>
					<div
						className={styles.configBox}
						style={{ background: "transparent", paddingLeft: "14px" }}
					>
						<input
							placeholder="Titre du document"
							value={docTitle}
							onChange={(e) => setDocTitle(e.target.value)}
							className={styles.vscodeInput}
							style={{ marginBottom: "4px" }}
						/>
						<input
							placeholder="Sous-titre"
							value={docSubtitle}
							onChange={(e) => setDocSubtitle(e.target.value)}
							className={styles.vscodeInput}
							style={{ marginBottom: "4px" }}
						/>
						<input
							placeholder="Date (jj/mm/aaaa)"
							value={docDate}
							onChange={(e) => setDocDate(e.target.value)}
							className={styles.vscodeInput}
						/>
						<button
							type="button"
							className={styles.insertBtn}
							onClick={handleInitialize}
						>
							<Icons.FileText />
							Initialiser le Document
						</button>
					</div>
				</div>

				<div className={styles.modelGroup}>
					<button
						type="button"
						className={styles.subToggle}
						onClick={() => setShowSessionConfig(!showSessionConfig)}
					>
						{showSessionConfig ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
						<Icons.Calendar />
						Informations de Séance
					</button>

					{showSessionConfig && (
						<div className={styles.configBox}>
							{Object.entries(sessionFields).map(([key, val]) => (
								<label key={key} className={styles.checkboxLabel}>
									<input
										type="checkbox"
										checked={val}
										onChange={() =>
											setSessionFields((prev) => ({
												...prev,
												[key as keyof typeof sessionFields]: !val,
											}))
										}
									/>
									{key.charAt(0).toUpperCase() + key.slice(1)}
								</label>
							))}
							<button
								type="button"
								className={styles.insertBtn}
								onClick={() =>
									unlockedTemplates &&
									insertText(
										unescapeNewlines(
											processSessionInfoTemplate(
												unlockedTemplates.session_info_base,
												sessionFields,
											),
										),
										"",
									)
								}
							>
								Insérer le Bloc
							</button>
						</div>
					)}
				</div>

				<div className={styles.modelGroup}>
					<button
						type="button"
						className={styles.subToggle}
						onClick={() => setShowSigConfig(!showSigConfig)}
					>
						{showSigConfig ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
						<Icons.PenTool />
						Bloc de Signatures
					</button>

					{showSigConfig && (
						<div className={styles.configBox}>
							{signatories.map((sig, idx) => (
								<div key={sig.id} className={styles.sigRow}>
									<input
										placeholder="Nom du signataire"
										value={sig.name}
										onChange={(e) => {
											const next = [...signatories];
											next[idx].name = e.target.value;
											setSignatories(next);
										}}
										className={styles.vscodeInput}
									/>
									<input
										placeholder="Rôle / Titre"
										value={sig.role}
										onChange={(e) => {
											const next = [...signatories];
											next[idx].role = e.target.value;
											setSignatories(next);
										}}
										className={styles.vscodeInput}
									/>
									{signatories.length > 1 && (
										<button
											type="button"
											className={styles.miniBtn}
											onClick={() =>
												setSignatories(
													signatories.filter((s) => s.id !== sig.id),
												)
											}
										>
											<Icons.X />
										</button>
									)}
								</div>
							))}
							<div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
								<button
									type="button"
									className={styles.addBtn}
									onClick={() =>
										setSignatories([
											...signatories,
											{ id: Date.now(), name: "", role: "" },
										])
									}
								>
									<Icons.Plus /> Ajouter
								</button>
								<button
									type="button"
									className={styles.insertBtn}
									onClick={() =>
										unlockedTemplates &&
										insertText(
											unescapeNewlines(
												processSignaturesTemplate(
													unlockedTemplates.signatures_base,
													signatories.filter((s) => s.name || s.role),
												),
											),
											"",
										)
									}
								>
									Insérer
								</button>
							</div>
						</div>
					)}
				</div>

				<div className={styles.modelGroup}>
					<span className={styles.groupLabel}>Éléments rapides</span>
					<button
						type="button"
						className={styles.modelBtn}
						onClick={() =>
							unlockedTemplates &&
							insertText(unescapeNewlines(unlockedTemplates.section), "")
						}
					>
						<Icons.Layers />
						Nouvelle Section
					</button>
					<button
						type="button"
						className={styles.modelBtn}
						onClick={() =>
							unlockedTemplates &&
							insertText(unescapeNewlines(unlockedTemplates.subtitle), "")
						}
					>
						<Icons.Type />
						Sous-titre bold
					</button>
					<button
						type="button"
						className={styles.modelBtn}
						onClick={() =>
							unlockedTemplates &&
							insertText(unescapeNewlines(unlockedTemplates.list), "")
						}
					>
						<Icons.List />
						Liste à points
					</button>
				</div>
			</div>
		</div>
	);
};
