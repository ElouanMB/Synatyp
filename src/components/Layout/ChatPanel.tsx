import { invoke } from "@tauri-apps/api/core";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../../store/editorStore";
import styles from "./ChatPanel.module.css";

interface Message {
	role: "user" | "assistant";
	content: string;
	isThinking?: boolean;
}

export const ChatPanel: React.FC = () => {
	const {
		source,
		setSource,
		showChat,
		toggleChat,
		compile,
		isAiUnlocked,
		unlockAi,
	} = useEditorStore();
	const [notes, setNotes] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [password, setPassword] = useState("");
	const [isUnlocking, setIsUnlocking] = useState(false);
	const [unlockError, setUnlockError] = useState<string | null>(null);

	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (showChat && isAiUnlocked && textareaRef.current) {
			textareaRef.current.focus();
		}
	}, [showChat, isAiUnlocked]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll whenever messages change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages.length]);

	const handleUnlock = async () => {
		if (!password.trim() || isUnlocking) return;
		setIsUnlocking(true);
		setUnlockError(null);
		const success = await unlockAi(password);
		if (!success) {
			setUnlockError("Mot de passe incorrect");
		}
		setIsUnlocking(false);
	};

	const handleSend = async () => {
		if (!notes.trim() || isLoading) return;

		const userNote = notes.trim();
		setMessages((prev) => [...prev, { role: "user", content: userNote }]);
		setNotes("");
		setIsLoading(true);
		setError(null);

		// Add a thinking message
		setMessages((prev) => [
			...prev,
			{ role: "assistant", content: "", isThinking: true },
		]);

		try {
			const result = await invoke<string>("call_gemini", {
				currentCode: source,
				notes: userNote,
				templateContext: null,
			});

			if (result) {
				setSource(result);
				// Replace thinking message with result
				setMessages((prev) => {
					const newMessages = [...prev];
					const lastIdx = newMessages.length - 1;
					if (newMessages[lastIdx]?.isThinking) {
						newMessages[lastIdx] = {
							role: "assistant",
							content: "Document mis à jour avec succès.",
						};
					}
					return newMessages;
				});
				await compile();
			}
		} catch (err) {
			console.error("Chat error:", err);
			setError(
				typeof err === "string"
					? err
					: "Une erreur est survenue lors de la génération.",
			);
			// Remove thinking message on error
			setMessages((prev) => prev.filter((m) => !m.isThinking));
		} finally {
			setIsLoading(false);
		}
	};

	if (!showChat) return null;

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<div className={styles.titleGroup}>
					<span className={styles.title}>ASSISTANT IA</span>
				</div>
				<div className={styles.headerActions}>
					<button
						type="button"
						className={styles.actionBtn}
						onClick={toggleChat}
						title="Fermer"
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							width="14"
							height="14"
						>
							<title>Fermer</title>
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			{!isAiUnlocked ? (
				<div className={styles.unlockView}>
					<div className={styles.aiAvatar}>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							width="24"
							height="24"
						>
							<title>Icône IA</title>
							<path d="M12 11V7a4 4 0 0 1 8 0v4h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1V7a4 4 0 0 1 4-4 4 4 0 0 1 4 4v4" />
						</svg>
					</div>
					<h3>Assistant Verrouillé</h3>
					<p>
						Veuillez entrer le mot de passe de déverrouillage pour utiliser
						l'IA.
					</p>

					<div className={styles.unlockInputWrapper}>
						<input
							type="password"
							className={styles.vscodeInput}
							placeholder="Mot de passe..."
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
						/>
						{unlockError && (
							<div className={styles.unlockError}>{unlockError}</div>
						)}
						<button
							type="button"
							className={styles.unlockBtn}
							onClick={handleUnlock}
							disabled={isUnlocking}
						>
							{isUnlocking ? "Déverrouillage..." : "Déverrouiller"}
						</button>
					</div>
				</div>
			) : (
				<>
					<div className={styles.messageList}>
						{messages.length === 0 && (
							<div className={styles.emptyState}>
								<div className={styles.aiAvatar}>
									<svg
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										width="24"
										height="24"
									>
										<title>Assistant IA</title>
										<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
									</svg>
								</div>
								<h4 className={styles.emptyTitle}>Assistant Typst</h4>
								<p>
									Envoyez vos notes pour que l'IA structure ou modifie votre
									document automatiquement.
								</p>

								<div className={styles.suggestions}>
									<button
										type="button"
										onClick={() =>
											setNotes(
												"Ajoute une section conclusion avec une liste à puces...",
											)
										}
										className={styles.suggestionBtn}
									>
										"Ajoute une section conclusion..."
									</button>
									<button
										type="button"
										onClick={() =>
											setNotes(
												"Formate les noms des intervenants en gras et ajoute une date...",
											)
										}
										className={styles.suggestionBtn}
									>
										"Formate les noms en gras..."
									</button>
									<button
										type="button"
										onClick={() =>
											setNotes(
												"Transforme mes notes brutes en un rapport bien structuré...",
											)
										}
										className={styles.suggestionBtn}
									>
										"Structure mes notes brutes..."
									</button>
								</div>
							</div>
						)}

						{messages.map((msg, i) => (
							<div
								key={`msg-${i}-${msg.role}`}
								className={`${styles.message} ${styles[msg.role]}`}
							>
								<div className={styles.avatar}>
									{msg.role === "user" ? "U" : "AI"}
								</div>
								<div className={styles.messageContent}>
									{msg.isThinking ? (
										<div className={styles.thinking}>
											<span />
											<span />
											<span />
										</div>
									) : (
										msg.content
									)}
								</div>
							</div>
						))}
						<div ref={messagesEndRef} />
					</div>

					<div className={styles.inputArea}>
						{error && <div className={styles.error}>{error}</div>}
						<div className={styles.inputWrapper}>
							<textarea
								ref={textareaRef}
								className={styles.textarea}
								placeholder="Envoyez vos notes ou demandez une modification..."
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !e.shiftKey) {
										e.preventDefault();
										handleSend();
									}
								}}
							/>
							<button
								type="button"
								className={styles.sendButton}
								onClick={handleSend}
								disabled={isLoading || !notes.trim()}
								title="Envoyer"
							>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2.5"
									width="16"
									height="16"
								>
									<title>Envoyer</title>
									<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
								</svg>
							</button>
						</div>
						<div className={styles.inputFooter}>
							Appuyez sur Entrée pour envoyer
						</div>
					</div>
				</>
			)}
		</div>
	);
};
