import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";
import { SplitView } from "./components/Editor/SplitView";
import { ChatPanel } from "./components/Layout/ChatPanel";
import { NoFileSelected } from "./components/Layout/NoFileSelected";
import { Sidebar } from "./components/Layout/Sidebar";
import { StatusBar } from "./components/Layout/StatusBar";
import { TopBar } from "./components/Layout/TopBar";
import { WelcomeScreen } from "./components/Layout/WelcomeScreen";
import { useEditorStore } from "./store/editorStore";
import "./styles/globals.css";

function App() {
	const {
		saveFile,
		openFileDialog,
		toggleSidebar,
		toggleTerminal,
		projectPath,
		filePath,
		refreshProjectFiles,
		openFile,
		compile,
		checkUnsavedChanges,
		toggleChat,
	} = useEditorStore();

	const isInitialized = useRef(false);

	// Intercept application close to check for unsaved changes
	useEffect(() => {
		let unlisten: (() => void) | null = null;

		const setupCloseInterceptor = async () => {
			try {
				const appWindow = getCurrentWindow();

				unlisten = await appWindow.onCloseRequested(async (event) => {
					console.log("Close requested intercepted");
					// Always prevent default first to allow async work
					event.preventDefault();

					try {
						const canClose = await checkUnsavedChanges();
						if (canClose) {
							console.log("Closing window via destroy()");
							// Use destroy to bypass the interceptor and force close
							await appWindow.destroy();
						}
					} catch (err) {
						console.error("Error during close check:", err);
						// Fallback: destroy anyway if the check fails to avoid blocking the user forever
						await appWindow.destroy();
					}
				});
			} catch (err) {
				console.error("Failed to setup close interceptor:", err);
			}
		};

		setupCloseInterceptor();
		return () => {
			if (unlisten) unlisten();
		};
	}, [checkUnsavedChanges]);

	// Restore session
	useEffect(() => {
		if (isInitialized.current) return;
		isInitialized.current = true;

		const init = async () => {
			if (projectPath) {
				await refreshProjectFiles();
			}
			if (filePath) {
				await openFile(filePath);
			} else {
				await compile();
			}
		};
		init();
	}, [projectPath, filePath, refreshProjectFiles, openFile, compile]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Sidebar: Ctrl+B
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
				e.preventDefault();
				toggleSidebar();
			}
			// Terminal: Ctrl+`
			if ((e.ctrlKey || e.metaKey) && e.key === "`") {
				e.preventDefault();
				toggleTerminal();
			}
			// Save: Ctrl+S
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
				e.preventDefault();
				saveFile();
			}
			// Open: Ctrl+O
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
				e.preventDefault();
				openFileDialog();
			}
			// Chat: Ctrl+L
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
				e.preventDefault();
				toggleChat();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [saveFile, openFileDialog, toggleSidebar, toggleTerminal, toggleChat]);

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				height: "100vh",
				overflow: "hidden",
			}}
		>
			<TopBar />
			<div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
				<Sidebar />
				<main
					style={{
						flex: 1,
						display: "flex",
						flexDirection: "column",
						overflow: "hidden",
					}}
				>
					<div
						style={{
							flex: 1,
							display: "flex",
							flexDirection: "column",
							minHeight: 0,
							background: "#121212",
						}}
					>
						{filePath ? (
							<SplitView />
						) : projectPath ? (
							<NoFileSelected />
						) : (
							<WelcomeScreen />
						)}
					</div>
				</main>
				<ChatPanel />
			</div>
			<StatusBar />
		</div>
	);
}

export default App;
